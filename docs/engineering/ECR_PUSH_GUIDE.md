# ECR 푸시 가이드

프론트엔드 Docker 이미지를 AWS ECR에 푸시하는 가이드입니다.

## 사전 요구사항

- Docker Desktop 설치 및 실행 중
- AWS CLI 설치 및 구성 완료
- AWS 자격 증명 설정 (`aws configure`)
- ECR 리포지토리가 Terraform으로 생성되어 있어야 함

## 빠른 시작

### 1. 환경 변수 설정 (선택)

백엔드 API 엔드포인트와 Cognito 설정을 사용하려면 환경 변수를 설정하세요:

```powershell
# API Base URL (필수)
$env:API_BASE_URL = "https://your-api-gateway-url.amazonaws.com/v1"

# Cognito 설정 (선택 - MVP는 로컬 스토리지 사용)
$env:COGNITO_USER_POOL_ID = "ap-northeast-2_XXXXXXXXX"
$env:COGNITO_APP_CLIENT_ID = "your-app-client-id"
$env:COGNITO_HOSTED_UI_DOMAIN = "your-cognito-domain"
$env:COGNITO_REDIRECT_URI = "https://your-frontend-url.com/auth/callback"
```

환경 변수를 설정하지 않으면 기본값이 사용됩니다.

### 2. ECR에 푸시

```powershell
# 프로젝트 루트에서 실행
.\scripts\push-to-ecr.ps1
```

### 3. 특정 태그로 푸시

```powershell
$env:IMAGE_TAG = "v1.0.0"
.\scripts\push-to-ecr.ps1
```

## 수동 실행 (단계별)

PowerShell 스크립트를 사용하지 않고 수동으로 실행하려면:

```powershell
# 1. ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | `
  docker login --username AWS --password-stdin `
  389998437416.dkr.ecr.ap-northeast-2.amazonaws.com

# 2. Docker 이미지 빌드
docker build `
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-api-url.com/v1 `
  -t stockbrief-frontend:latest `
  .

# 3. 이미지 태그
docker tag stockbrief-frontend:latest `
  389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest

# 4. ECR에 푸시
docker push `
  389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest
```

## 배포 프로세스

ECR에 푸시한 후:

### 방법 1: ECS 자동 업데이트 (권장)

ECS 서비스가 `latest` 태그를 사용하도록 설정되어 있다면 자동으로 새 이미지를 감지하고 롤링 업데이트를 수행합니다.

```bash
# ECS 서비스 강제 업데이트
aws ecs update-service \
  --region ap-northeast-2 \
  --cluster stockbrief-dev-frontend-cluster \
  --service stockbrief-dev-frontend-service \
  --force-new-deployment
```

### 방법 2: Terraform으로 배포

```bash
cd ../camp-be/infra/terraform/envs/dev
terraform apply -target=module.frontend_ecs
```

### 방법 3: 전체 배포 스크립트

```bash
# 프로젝트 루트에서
pnpm run deploy:hosted
```

## CloudFront 캐시 무효화

프론트엔드 업데이트 후 CloudFront 캐시를 무효화해야 사용자에게 즉시 반영됩니다:

```bash
# CloudFront Distribution ID 확인
cd ../camp-be/infra/terraform/envs/dev
terraform output cloudfront_distribution_id

# 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

## 트러블슈팅

### ECR 로그인 실패

```
Error: Cannot perform an interactive login from a non TTY device
```

해결:
```powershell
# PowerShell에서 파이프라인 사용
aws ecr get-login-password --region ap-northeast-2 | `
  docker login --username AWS --password-stdin `
  389998437416.dkr.ecr.ap-northeast-2.amazonaws.com
```

### Docker 빌드 실패

```
ERROR: failed to solve: failed to compute cache key
```

해결:
- Docker Desktop이 실행 중인지 확인
- `.dockerignore`가 올바른지 확인
- `node_modules`를 삭제하고 다시 시도

### ECR 푸시 권한 없음

```
denied: User is not authorized to perform: ecr:PutImage
```

해결:
- AWS 자격 증명 확인: `aws sts get-caller-identity`
- IAM 정책에 ECR 권한 추가
- ECR 리포지토리 정책 확인

### 빌드 시간이 너무 오래 걸림

해결:
- Docker BuildKit 사용: `$env:DOCKER_BUILDKIT=1`
- 멀티스테이지 빌드 캐시 활용
- `.dockerignore`에 불필요한 파일 추가

## 참고

- 백엔드 레포: https://github.com/jing-jung/camp-be
- Dockerfile: `./Dockerfile`
- 배포 스크립트: `./scripts/deploy-hosted-frontend.sh` (Bash)
- ECR 푸시 스크립트: `./scripts/push-to-ecr.ps1` (PowerShell)

## 비용

- ECR 스토리지: 이미지당 ~$0.10/월
- 데이터 전송: 외부로 전송 시 GB당 ~$0.09
- ECR에 저장된 이미지는 정기적으로 정리하는 것이 좋습니다 (lifecycle policy)
