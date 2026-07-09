# 프론트엔드 ECR 푸시 및 배포 완료

## 📦 ECR 푸시 완료

프론트엔드 Docker 이미지가 성공적으로 빌드되고 ECR에 푸시되었습니다!

### 이미지 정보
- **ECR URI**: `389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest`
- **Digest**: `sha256:0910e4d43c4eb13b79f51782aed82073db2da8e67f5ba0f3afdac8f62fe29186`
- **크기**: ~88 MB
- **푸시 시간**: 2026-07-08 오후

### 빌드 환경 변수 (실제 백엔드 연동)
- ✅ `NEXT_PUBLIC_API_BASE_URL`: `https://sgg6hmfaij.execute-api.ap-northeast-2.amazonaws.com/v1`
- ✅ `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: `ap-northeast-2_MT59vnjQg`
- ✅ `NEXT_PUBLIC_COGNITO_APP_CLIENT_ID`: `3vhl76s71q3r4r53t05ms29m5f`
- ✅ `NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN`: `https://stockbrief-dev-389998437416.auth.ap-northeast-2.amazoncognito.com`

## 🚀 다음 단계: ECS 배포

프론트엔드를 실제로 배포하려면 백엔드 Terraform 설정을 업데이트해야 합니다.

### 1단계: Terraform 설정 수정

`camp-be/infra/terraform/envs/dev/deploy.auto.tfvars.json` 파일을 수정:

```json
{
  "enable_frontend_ecs": true,              // false → true로 변경
  "frontend_desired_count": 1,              // 0 → 1로 변경
  "enable_frontend_cloudfront": true,       // false → true (선택, CDN 사용)
  "frontend_cloudfront_default_ttl": 300,   // 5분 캐시
  "frontend_cloudfront_max_ttl": 3600       // 1시간 캐시
}
```

### 2단계: Terraform Apply

```powershell
cd C:\Users\한국전파진흥협회\Desktop\camp-be\camp-be\infra\terraform

# 변경사항 미리보기
terraform plan -var-file=envs/dev/deploy.auto.tfvars.json -out=tfplan

# 배포 적용
terraform apply tfplan
```

### 3단계: 배포 확인

```powershell
# Output 확인
terraform output

# ECS 태스크 상태 확인
aws ecs list-tasks `
  --cluster (terraform output -raw frontend_ecs_cluster_name) `
  --region ap-northeast-2

# ALB DNS 확인
terraform output frontend_alb_dns_name

# 브라우저에서 접속
# http://<alb-dns-name>
```

## 📝 생성된 파일 요약

### 프론트엔드 레포 (camp-fe)

```
camp-fe/
├── scripts/
│   └── push-to-ecr.ps1                    # ECR 푸시 자동화 스크립트
├── docs/engineering/
│   ├── ECR_PUSH_GUIDE.md                  # 상세 가이드
│   ├── ECR_PUSH_COMPLETE.md               # 완료 보고서
│   └── NEXT_STEPS.md                      # 이 문서
├── public/
│   └── .gitkeep                           # placeholder
└── README.md                              # 배포 섹션 추가됨
```

## 🔄 재배포가 필요한 경우

프론트엔드 코드를 수정한 후 재배포:

```powershell
# 1. ECR에 새 이미지 푸시 (프론트엔드 레포)
cd C:\Users\한국전파진흥협회\Desktop\camp-fe
.\scripts\push-to-ecr.ps1

# 2. ECS 서비스 강제 업데이트 (백엔드 레포)
cd C:\Users\한국전파진흥협회\Desktop\camp-be\camp-be\infra\terraform
$CLUSTER = terraform output -raw frontend_ecs_cluster_name
$SERVICE = terraform output -raw frontend_ecs_service_name

aws ecs update-service `
  --cluster $CLUSTER `
  --service $SERVICE `
  --force-new-deployment `
  --region ap-northeast-2

# 3. CloudFront 캐시 무효화 (선택, CDN 사용 시)
$DIST_ID = terraform output -raw cloudfront_distribution_id
aws cloudfront create-invalidation `
  --distribution-id $DIST_ID `
  --paths "/*"
```

## ⚠️ 주의사항

1. **비용 최적화**
   - 개발 중이 아닐 때는 `frontend_desired_count`를 `0`으로 설정하여 비용 절감
   - CloudFront는 선택사항 (CDN 없이 ALB만 사용 가능)

2. **환경 변수**
   - API URL이나 Cognito 설정이 변경되면 이미지를 다시 빌드해야 함
   - `NEXT_PUBLIC_*` 환경 변수는 빌드 타임에 고정됨

3. **보안**
   - ALB는 현재 HTTP만 지원 (HTTPS는 CloudFront 또는 ALB 리스너 추가 필요)
   - 프로덕션에서는 HTTPS 필수

## 📚 참고 자료

- [ECR 푸시 가이드](docs/engineering/ECR_PUSH_GUIDE.md)
- [백엔드 레포](https://github.com/jing-jung/camp-be)
- [프론트엔드 Lambda 배포 가이드](https://github.com/jing-jung/camp-be/blob/main/docs/FRONTEND_LAMBDA_DEPLOYMENT.md)

## ✅ 체크리스트

- [x] 프론트엔드 이미지 빌드
- [x] ECR에 이미지 푸시
- [x] 올바른 API URL로 빌드
- [x] Cognito 설정 주입
- [ ] Terraform 설정 수정 (`enable_frontend_ecs: true`)
- [ ] Terraform apply 실행
- [ ] ECS 태스크 시작 확인
- [ ] 브라우저에서 접속 테스트
- [ ] API 연동 확인
- [ ] (선택) CloudFront 설정
- [ ] (선택) HTTPS 설정

---

**다음 작업**: 백엔드 Terraform 설정을 수정하고 `terraform apply`를 실행하세요! 🚀
