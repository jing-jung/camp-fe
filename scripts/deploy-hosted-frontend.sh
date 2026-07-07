#!/usr/bin/env bash
set -euo pipefail

TARGET_ENV="${TARGET_ENV:-dev}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
TF_DIR="${TF_DIR:-camp-be/infra/terraform}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SKIP_INVALIDATION="${SKIP_INVALIDATION:-false}"

if [[ ! -d "${TF_DIR}" ]]; then
  echo "Terraform directory not found: ${TF_DIR}" >&2
  exit 1
fi

TF_BACKEND_CONFIG="${TF_BACKEND_CONFIG:-backends/${TARGET_ENV}.hcl}"
if [[ ! -f "${TF_DIR}/${TF_BACKEND_CONFIG}" ]]; then
  echo "Terraform backend config not found: ${TF_DIR}/${TF_BACKEND_CONFIG}" >&2
  exit 1
fi

terraform -chdir="${TF_DIR}" init -input=false -backend-config="${TF_BACKEND_CONFIG}" >/dev/null
OUTPUT_JSON="$(terraform -chdir="${TF_DIR}" output -json)"

read_output() {
  python - <<'PY' "${OUTPUT_JSON}" "$1"
import json
import sys
payload = json.loads(sys.argv[1])
key = sys.argv[2]
value = payload.get(key, {}).get("value", "")
print(value)
PY
}

ECR_REPOSITORY_URL="$(read_output "${OUTPUT_JSON}" frontend_ecr_repository_url)"
ECS_CLUSTER_NAME="$(read_output "${OUTPUT_JSON}" frontend_ecs_cluster_name)"
ECS_SERVICE_NAME="$(read_output "${OUTPUT_JSON}" frontend_ecs_service_name)"
CLOUDFRONT_DISTRIBUTION_ID="$(read_output "${OUTPUT_JSON}" cloudfront_distribution_id)"
API_BASE_URL="$(read_output "${OUTPUT_JSON}" api_base_url)"
COGNITO_USER_POOL_ID="$(read_output "${OUTPUT_JSON}" cognito_user_pool_id)"
COGNITO_APP_CLIENT_ID="$(read_output "${OUTPUT_JSON}" cognito_app_client_id)"
COGNITO_HOSTED_UI_DOMAIN="$(read_output "${OUTPUT_JSON}" cognito_hosted_ui_domain)"
FRONTEND_HOSTED_URL="$(read_output "${OUTPUT_JSON}" frontend_hosted_url)"

for required_name in ECR_REPOSITORY_URL ECS_CLUSTER_NAME ECS_SERVICE_NAME API_BASE_URL; do
  required_value="${!required_name}"
  if [[ -z "${required_value}" ]]; then
    echo "Missing Terraform output required for frontend deploy: ${required_name}" >&2
    exit 1
  fi
done

if [[ "${API_BASE_URL}" != */v1 ]]; then
  API_BASE_URL="${API_BASE_URL%/}/v1"
fi

if [[ -z "${FRONTEND_HOSTED_URL}" ]]; then
  FRONTEND_HOSTED_URL="http://localhost:3000"
fi
COGNITO_REDIRECT_URI="${FRONTEND_HOSTED_URL%/}/auth/callback"

echo "Building frontend image for ${ECR_REPOSITORY_URL}:${IMAGE_TAG}"
docker build \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}" \
  --build-arg "NEXT_PUBLIC_COGNITO_REGION=${AWS_REGION}" \
  --build-arg "NEXT_PUBLIC_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}" \
  --build-arg "NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID}" \
  --build-arg "NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN=${COGNITO_HOSTED_UI_DOMAIN}" \
  --build-arg "NEXT_PUBLIC_COGNITO_REDIRECT_URI=${COGNITO_REDIRECT_URI}" \
  -t "${ECR_REPOSITORY_URL}:${IMAGE_TAG}" \
  .

aws ecr get-login-password --region "${AWS_REGION}" | docker login \
  --username AWS \
  --password-stdin "${ECR_REPOSITORY_URL%/*}"

docker push "${ECR_REPOSITORY_URL}:${IMAGE_TAG}"
if [[ "${IMAGE_TAG}" != "latest" ]]; then
  docker tag "${ECR_REPOSITORY_URL}:${IMAGE_TAG}" "${ECR_REPOSITORY_URL}:latest"
  docker push "${ECR_REPOSITORY_URL}:latest"
fi

echo "Forcing ECS deployment for ${ECS_CLUSTER_NAME}/${ECS_SERVICE_NAME}"
aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER_NAME}" \
  --service "${ECS_SERVICE_NAME}" \
  --force-new-deployment \
  --desired-count 1 >/dev/null

if [[ "${SKIP_INVALIDATION}" != "true" && -n "${CLOUDFRONT_DISTRIBUTION_ID}" ]]; then
  echo "Invalidating CloudFront distribution ${CLOUDFRONT_DISTRIBUTION_ID}"
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/*" >/dev/null
fi

if [[ -n "${FRONTEND_HOSTED_URL}" && "${FRONTEND_HOSTED_URL}" != http://localhost:3000 ]]; then
  echo "Running hosted smoke against ${FRONTEND_HOSTED_URL}"
  STOCKBRIEF_HOSTED_URL="${FRONTEND_HOSTED_URL}" pnpm run smoke:hosted-evidence
fi

echo "Frontend deploy completed."
