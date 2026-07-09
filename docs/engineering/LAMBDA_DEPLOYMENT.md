# Lambda + CloudFront 배포 완료 가이드

## ✅ 완료된 작업

### 1. Lambda Web Adapter 이미지 빌드 및 ECR 푸시 완료

- **ECR URI**: `389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest`
- **이미지 타입**: Lambda Web Adapter (컨테이너 기반 Lambda)
- **Digest**: `sha256:bd628dbc841a290c0bc95b08fbf1f338549984b88135c1603bfcf33a46c0a160`
- **크기**: ~90 MB (Alpine 기반)

### 2. 빌드 환경 변수 (실제 백엔드 연동)

- ✅ `NEXT_PUBLIC_API_BASE_URL`: `https://sgg6hmfaij.execute-api.ap-northeast-2.amazonaws.com/v1`
- ✅ `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: `ap-northeast-2_MT59vnjQg`
- ✅ `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`: `3vhl76s71q3r4r53t05ms29m5f`
- ✅ `NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN`: `https://stockbrief-dev-389998437416.auth.ap-northeast-2.amazoncognito.com`

### 3. Terraform 설정 확인

현재 `deploy.auto.tfvars.json` 설정:
- ✅ `enable_frontend_lambda`: `true`
- ✅ `enable_frontend_cloudfront_lambda`: `true`
- ✅ `enable_frontend_ecs`: `false` (올바름, Lambda 사용)
- ✅ `frontend_container_image`: `389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend`

## 🚀 다음 단계: Terraform Apply

### 1단계: Terraform Plan 확인

```powershell
cd C:\Users\한국전파진흥협회\Desktop\camp-be\camp-be\infra\terraform

# 변경사항 미리보기
terraform plan -var-file=envs/dev/deploy.auto.tfvars.json -out=tfplan
```

예상 생성 리소스:
- AWS Lambda Function (Next.js)
- Lambda Function URL
- CloudFront Distribution
- CloudFront Origin Access Control
- CloudWatch Log Group
- IAM Roles & Policies

### 2단계: Terraform Apply

```powershell
# 배포 실행
terraform apply tfplan

# 또는 승인 프롬프트와 함께 실행
terraform apply -var-file=envs/dev/deploy.auto.tfvars.json
```

배포 시간: 약 5-10분 (CloudFront 생성 시간 포함)

### 3단계: 배포 확인

```powershell
# Lambda 함수 확인
terraform output frontend_lambda_function_name
terraform output frontend_lambda_function_url

# CloudFront URL 확인 (최종 접속 URL)
terraform output frontend_hosted_url

# 예시 출력:
# frontend_lambda_function_name = "stockbrief-dev-frontend"
# frontend_lambda_function_url = "https://abc123xyz.lambda-url.ap-northeast-2.on.aws/"
# frontend_hosted_url = "https://d1234567890abc.cloudfront.net"
```

### 4단계: 접속 테스트

```powershell
# CloudFront URL 확인
$CF_URL = terraform output -raw frontend_hosted_url

# 헬스 체크
curl -I $CF_URL

# 브라우저에서 접속
Start-Process $CF_URL
```

## 📊 Lambda vs ECS 비교

| 항목 | Lambda (현재) | ECS (이전) |
|------|--------------|-----------|
| **아키텍처** | Lambda Web Adapter | ECS Fargate Container |
| **고정 비용** | $0/월 | ~$30/월 |
| **스케일링** | 자동 (무제한) | 수동 설정 필요 |
| **Cold Start** | 3-5초 | 없음 |
| **유지보수** | 간단 | 복잡 (ALB, ECS 관리) |
| **비용 효율** | 트래픽 기반 | 고정 비용 |
| **배포 속도** | 빠름 (~2분) | 느림 (~5-10분) |

**결론**: 월 10만 PV 이하에서 Lambda가 약 70% 비용 절감!

## 🔄 재배포 방법

프론트엔드 코드 수정 후 재배포:

```powershell
# 1. Lambda 이미지 다시 빌드 및 푸시
cd C:\Users\한국전파진흥협회\Desktop\camp-fe
.\scripts\push-to-ecr-lambda.ps1

# 2. Lambda 함수 업데이트
cd C:\Users\한국전파진흥협회\Desktop\camp-be\camp-be\infra\terraform
$LAMBDA_NAME = terraform output -raw frontend_lambda_function_name

aws lambda update-function-code `
  --function-name $LAMBDA_NAME `
  --image-uri 389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest `
  --region ap-northeast-2

# 3. CloudFront 캐시 무효화
$DIST_ID = terraform output -raw cloudfront_distribution_id
aws cloudfront create-invalidation `
  --distribution-id $DIST_ID `
  --paths "/*"
```

## ⚠️ 주의사항

1. **Cold Start**
   - 처음 요청 시 3-5초의 지연 발생 가능
   - 자주 사용되는 서비스는 warm-up 로직 추가 권장

2. **Lambda 제한사항**
   - 메모리: 최대 10GB (현재 2048MB 설정)
   - 타임아웃: 최대 30초 (현재 30초 설정)
   - 패키지 크기: 최대 10GB (컨테이너)

3. **CloudFront 캐시**
   - HTML은 기본 5분 캐시
   - 정적 리소스는 1년 캐시
   - 배포 후 캐시 무효화 필요

4. **비용 예상** (10만 PV/월)
   - Lambda 실행: ~$5/월
   - CloudFront: ~$3/월
   - 총: **~$8/월** (ECS 대비 70% 절감)

## 📚 관련 문서

- [Lambda Web Adapter 공식 문서](https://github.com/awslabs/aws-lambda-web-adapter)
- [백엔드 레포](https://github.com/jing-jung/camp-be)
- [프론트엔드 Lambda 배포 가이드](https://github.com/jing-jung/camp-be/blob/main/docs/FRONTEND_LAMBDA_DEPLOYMENT.md)

## 🎯 체크리스트

- [x] Lambda Web Adapter Dockerfile 작성
- [x] 프론트엔드 이미지 빌드 (Lambda용)
- [x] ECR에 이미지 푸시
- [x] 올바른 API URL로 빌드
- [x] Cognito 설정 주입
- [x] Terraform 설정 확인 (`enable_frontend_lambda: true`)
- [ ] Terraform plan 확인
- [ ] Terraform apply 실행
- [ ] Lambda 함수 생성 확인
- [ ] CloudFront 배포 확인
- [ ] 브라우저에서 접속 테스트
- [ ] API 연동 확인
- [ ] Cold Start 성능 테스트

## 🔧 트러블슈팅

### Lambda 함수가 시작되지 않는 경우

```powershell
# Lambda 로그 확인
aws logs tail /aws/lambda/stockbrief-dev-frontend --follow

# Lambda 함수 상태 확인
aws lambda get-function --function-name stockbrief-dev-frontend --region ap-northeast-2
```

### CloudFront에서 502 에러 발생

1. Lambda Function URL이 활성화되어 있는지 확인
2. Lambda가 정상 실행되는지 로그 확인
3. CloudFront Origin 설정 확인

```powershell
# Lambda Function URL 직접 테스트
$LAMBDA_URL = terraform output -raw frontend_lambda_function_url
curl -I $LAMBDA_URL
```

### 환경 변수가 반영되지 않는 경우

환경 변수는 빌드 타임에 고정되므로, 변경 시 이미지를 다시 빌드해야 합니다:

```powershell
# 환경 변수 설정 후 재빌드
$env:API_BASE_URL = "새로운-API-URL"
.\scripts\push-to-ecr-lambda.ps1

# Lambda 업데이트
aws lambda update-function-code --function-name ... --image-uri ...
```

---

**다음 작업**: Terraform apply를 실행하여 Lambda + CloudFront를 배포하세요! 🚀
