# ECR 푸시 완료 보고

## ✅ 완료된 작업

### 1. ECR에 프론트엔드 이미지 푸시 완료

- **ECR 리포지토리**: `389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest`
- **이미지 Digest**: `sha256:0910e4d43c4eb13b79f51782aed82073db2da8e67f5ba0f3afdac8f62fe29186`
- **빌드 환경 변수**:
  - `NEXT_PUBLIC_API_BASE_URL`: `https://sgg6hmfaij.execute-api.ap-northeast-2.amazonaws.com/v1` ✅
  - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: `ap-northeast-2_MT59vnjQg` ✅
  - `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`: `3vhl76s71q3r4r53t05ms29m5f` ✅

### 2. 백엔드 인프라 배포 확인

백엔드는 이미 배포되어 있습니다:
- ✅ API Gateway: `https://sgg6hmfaij.execute-api.ap-northeast-2.amazonaws.com`
- ✅ RDS PostgreSQL: `stockbrief-dev-postgres.c5s4g8sm0q35.ap-northeast-2.rds.amazonaws.com`
- ✅ ElastiCache Redis: `master.stockbrief-dev-redis.swzrk3.apn2.cache.amazonaws.com`
- ✅ AWS Cognito: User Pool과 App Client 생성 완료

## 생성된 파일

1. `scripts/push-to-ecr.ps1` - ECR 푸시 자동화 스크립트 (PowerShell)
2. `docs/engineering/ECR_PUSH_GUIDE.md` - ECR 푸시 가이드 문서
3. `public/.gitkeep` - public 디렉토리 placeholder
4. `README.md` - ECR 푸시 및 배포 섹션 추가

## 다음 단계

프론트엔드를 배포하려면 백엔드 Terraform 설정을 업데이트해야 합니다.

### 1. 백엔드 Terraform 설정 업데이트

`camp-be/infra/terraform/envs/dev/deploy.auto.tfvars.json` 파일을 열고 다음 값들을 변경하세요:

```json
{
  // ...
  "enable_frontend_ecs": true,                    // false → true
  "frontend_desired_count": 1,                     // 0 → 1
  "enable_frontend_cloudfront": true,              // false → true (선택)
  "frontend_cloudfront_default_ttl": 300,          // 5분 캐시
  "frontend_cloudfront_max_ttl": 3600,             // 1시간 캐시
  // ...
}
```

### 2. Terraform Apply

```bash
cd C:\Users\한국전파진흥협회\Desktop\camp-be\camp-be\infra\terraform

# 계획 확인
terraform plan -var-file=envs/dev/deploy.auto.tfvars.json -out=tfplan

# 적용
terraform apply tfplan
```

### 3. 배포 확인

```bash
# ECS 클러스터 및 서비스 확인
terraform output frontend_ecs_cluster_name
terraform output frontend_ecs_service_name

# ECS 태스크 상태 확인
aws ecs list-tasks `
  --cluster $(terraform output -raw frontend_ecs_cluster_name) `
  --service-name $(terraform output -raw frontend_ecs_service_name) `
  --region ap-northeast-2

# ALB DNS 이름 확인
terraform output frontend_alb_dns_name

# CloudFront URL 확인 (활성화한 경우)
terraform output frontend_hosted_url
```

### 4. 헬스 체크

```bash
# ALB를 통해 직접 접속
$ALB_DNS = terraform output -raw frontend_alb_dns_name
curl -I "http://$ALB_DNS"

# CloudFront를 통해 접속 (활성화한 경우)
$CF_URL = terraform output -raw frontend_hosted_url
curl -I $CF_URL
```

## 트러블슈팅

### ECR 이미지는 푸시되었지만 ECS 태스크가 시작되지 않는 경우

1. ECS 태스크 정의에 올바른 이미지 URI가 설정되어 있는지 확인
2. ECS 서비스의 desired count가 0이 아닌지 확인
3. ECS 태스크 로그 확인 (CloudWatch Logs)

```bash
aws ecs describe-services \
  --cluster <cluster-name> \
  --services <service-name> \
  --region ap-northeast-2
```

### CloudFront에서 404 또는 502 에러가 발생하는 경우

1. ALB 헬스 체크 확인
2. ECS 태스크가 정상 실행 중인지 확인
3. ALB 리스너 규칙 확인
4. CloudFront origin 설정 확인

```bash
# ALB 타겟 그룹 헬스 확인
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn> \
  --region ap-northeast-2
```

## 참고 자료

- [ECR 푸시 가이드](docs/engineering/ECR_PUSH_GUIDE.md)
- [백엔드 레포](https://github.com/jing-jung/camp-be)
- [프론트엔드 Lambda 배포 가이드](https://github.com/jing-jung/camp-be/blob/main/docs/FRONTEND_LAMBDA_DEPLOYMENT.md)

## 환경 변수 설정 확인

현재 빌드에 포함된 환경 변수:

- `NEXT_PUBLIC_API_BASE_URL`: `https://api.stockbrief.example.com/v1` (기본값)
- `NEXT_PUBLIC_COGNITO_REGION`: `ap-northeast-2`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: (비어있음 - MVP는 로컬 스토리지 사용)
- `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`: (비어있음)
- `NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN`: (비어있음)
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`: `http://localhost:3000/auth/callback`

**중요**: 실제 배포 시에는 백엔드 API Gateway URL로 `API_BASE_URL`을 설정해야 합니다.

```powershell
# 환경 변수 설정 후 다시 빌드
$env:API_BASE_URL = "https://your-real-api-gateway-url.amazonaws.com/v1"
.\scripts\push-to-ecr.ps1
```
