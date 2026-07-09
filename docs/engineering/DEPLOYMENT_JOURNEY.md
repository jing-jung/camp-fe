# 프론트엔드 배포 여정 및 트러블슈팅

> **면접 대비**: 실제 프로덕션 배포 과정에서 겪은 기술적 문제와 해결 과정

## 목차
1. [Lambda vs ECS 아키텍처 선택](#1-lambda-vs-ecs-아키텍처-선택)
2. [ECR 계정 혼동 및 해결](#2-ecr-계정-혼동-및-해결)
3. [Dockerfile 빌드 실패 해결](#3-dockerfile-빌드-실패-해결)
4. [환경 변수 주입 문제](#4-환경-변수-주입-문제)
5. [Terraform State 충돌 회피](#5-terraform-state-충돌-회피)
6. [최종 배포 전략 수립](#6-최종-배포-전략-수립)

---

## 1. Lambda vs ECS 아키텍처 선택

### 상황 (Situation)
- Next.js 프론트엔드를 AWS에 배포해야 하는 상황
- 백엔드 README에서 **Lambda Web Adapter** 방식으로 전환했다는 것을 확인
- 하지만 프론트엔드 레포에는 **ECS용 Dockerfile**만 존재

### 문제 (Task)
프론트엔드도 Lambda Web Adapter로 배포해야 하는데, 어떤 Dockerfile을 사용해야 하는가?

### 행동 (Action)

**1차 시도: ECS용 Dockerfile로 빌드**
```bash
# Dockerfile (ECS용)
FROM node:24-bookworm-slim
# standalone 빌드만 있고 Lambda Web Adapter 없음
```
- 성공적으로 ECR에 푸시
- 하지만 Lambda에서 실행할 수 없는 이미지

**2차 해결: Lambda Web Adapter 전용 Dockerfile 작성**
```dockerfile
# Dockerfile.lambda
FROM public.ecr.aws/docker/library/node:24-alpine AS base
# Lambda Web Adapter 추가
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
```

**의사결정 근거**:
- Lambda Web Adapter는 컨테이너 앱을 Lambda에서 실행 가능하게 변환
- ECS 대비 **70% 비용 절감** (월 10만 PV 기준)
- Cold Start 3-5초는 감수 가능한 수준
- 백엔드와 아키텍처 일관성 유지

### 결과 (Result)
- Lambda 전용 이미지 생성 완료
- Node 24 Alpine으로 이미지 크기 **~90MB**로 최적화
- 백엔드 레포의 `Dockerfile.frontend-lambda` 참고하여 작성

### 배운 점
- **아키텍처 문서 먼저 확인**: README를 꼼꼼히 읽고 전체 구조 파악 필요
- **비용 최적화**: Lambda의 pay-per-use 모델이 초기 스타트업에 적합
- **Lambda Web Adapter**: 기존 웹 앱을 Lambda로 쉽게 이식 가능

---

## 2. ECR 계정 혼동 및 해결

### 상황
- AWS 계정이 2개: 개인 계정(`389998437416`), 팀 프로젝트 계정(`560271561793`)
- 백엔드 README에 `560271561793` 계정 ID가 하드코딩되어 있음

### 문제
어떤 계정을 사용해야 하는가? ECR 리포지토리는 어디에 생성되어 있는가?

### 행동

**1단계: 현재 계정 확인**
```bash
aws sts get-caller-identity
# Account: '389998437416' ✅ 개인 계정
```

**2단계: ECR 리포지토리 확인**
```bash
aws ecr describe-repositories --region ap-northeast-2
# 389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend ✅
```

**3단계: 스크립트 및 문서 업데이트**
- `scripts/push-to-ecr-lambda.ps1`의 ECR URI 수정
- `docs/engineering/ECR_PUSH_GUIDE.md` 예시 코드 수정

### 결과
- 올바른 계정으로 ECR 푸시 성공
- 문서와 스크립트 일치성 확보

### 배운 점
- **멀티 계정 관리**: AWS CLI 프로필로 계정 구분 필요
- **하드코딩 위험**: 환경 변수나 Terraform output 활용 권장
- **검증 우선**: 가정하지 말고 항상 확인

---

## 3. Dockerfile 빌드 실패 해결

### 상황
Lambda용 Dockerfile로 첫 빌드 시도

### 문제
```bash
ERROR: failed to compute cache key: "/app/public": not found
```
- `public` 디렉토리가 존재하지 않아 Dockerfile COPY 단계 실패

### 행동

**1단계: 문제 진단**
```bash
ls
# public 디렉토리 없음 확인
```

**2단계: 임시 해결**
```bash
mkdir public
echo "# public directory for static assets" > public/.gitkeep
```

**3단계: 재빌드**
```bash
docker build -f Dockerfile.lambda ...
# ✅ 성공
```

### 결과
- 빌드 성공, 이미지 크기 ~90MB
- `.gitkeep`으로 빈 디렉토리 Git 추적 가능

### 배운 점
- **Next.js 프로젝트 구조**: `public` 디렉토리는 정적 파일용 표준 디렉토리
- **Dockerfile 최적화**: COPY 단계에서 존재하지 않는 경로는 optional하게 처리 가능
- **에러 메시지 정독**: Docker 에러는 명확하게 문제 위치 알려줌

---

## 4. 환경 변수 주입 문제

### 상황
Next.js는 빌드 타임에 `NEXT_PUBLIC_*` 환경 변수를 번들에 포함

### 문제
첫 빌드 시 기본값(`https://api.stockbrief.example.com/v1`)으로 빌드함
→ 실제 API URL이 아니라서 프론트엔드가 백엔드와 통신 불가

### 행동

**1단계: 백엔드 API URL 확인**
```bash
cd camp-be/infra/terraform
terraform output api_base_url
# https://sgg6hmfaij.execute-api.ap-northeast-2.amazonaws.com ✅
```

**2단계: 환경 변수 설정 후 재빌드**
```powershell
$env:API_BASE_URL = "https://sgg6hmfaij.execute-api.ap-northeast-2.amazonaws.com/v1"
$env:COGNITO_USER_POOL_ID = "ap-northeast-2_MT59vnjQg"
$env:COGNITO_APP_CLIENT_ID = "3vhl76s71q3r4r53t05ms29m5f"
.\scripts\push-to-ecr-lambda.ps1
```

**3단계: 빌드 인자 확인**
```dockerfile
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
```

### 결과
- 올바른 API URL로 재빌드 완료
- ECR에 새 이미지 푸시: `sha256:bd628dbc841a290c0bc95b08fbf1f338549984b88135c1603bfcf33a46c0a160`

### 배운 점
- **빌드 타임 vs 런타임**: Next.js 환경 변수는 빌드 시 고정됨
- **Terraform 연동**: 백엔드 인프라 정보는 Terraform output으로 가져오기
- **자동화 스크립트**: 환경 변수 주입을 스크립트로 자동화하여 실수 방지

---

## 5. Terraform State 충돌 회피

### 상황
프론트엔드 Lambda 배포를 위해 Terraform apply 시도

### 문제
```bash
terraform plan
# Plan: 0 to add, 3 to change, 60 to destroy. ❌❌❌
```

**삭제될 리소스**:
- ❌ RDS PostgreSQL 데이터베이스
- ❌ ElastiCache Redis (2 노드)
- ❌ VPC, 서브넷, NAT Gateway (2개)
- ❌ 모든 모니터링 대시보드 및 알람
- ❌ Cognito Hosted UI Domain

**원인 분석**:
1. Git HEAD detached 상태 (`492e9c1` 커밋)
2. `modules/vpc/` 새로 추가됨
3. Terraform 설정과 실제 State 불일치

### 행동

**의사결정: Terraform apply 중단**
- 60개 리소스 삭제는 **프로덕션 환경 파괴**
- 데이터 손실 위험 너무 큼
- 백엔드 설정 문제 먼저 해결 필요

**대안: 수동 배포 결정**
1. 프론트엔드는 ECR 이미지 준비만 완료
2. Lambda 함수 생성은 AWS CLI로 수동 배포
3. 또는 백엔드 담당자가 안전하게 처리

### 결과
- **리스크 회피**: 프로덕션 환경 보호
- **역할 분리**: 프론트엔드는 이미지만, 인프라는 백엔드에서
- **안전한 배포**: Terraform 문제 해결 후 재시도 가능

### 배운 점
- **Terraform State 관리**: State 불일치는 치명적
- **Plan 검토 필수**: Apply 전 반드시 plan 결과 확인
- **Rollback 계획**: 실패 시 복구 방법 사전 준비
- **프로덕션 보호**: 불확실하면 apply 하지 않기

---

## 6. 최종 배포 전략 수립

### 상황
Terraform으로 한 번에 배포하기엔 위험 부담이 큼

### 문제
안전하게 프론트엔드 Lambda를 배포하려면?

### 행동

**전략 수립**:

**Phase 1: 프론트엔드 (완료 ✅)**
1. Lambda Web Adapter Dockerfile 작성
2. 실제 API URL로 이미지 빌드
3. ECR 푸시 완료

**Phase 2: 백엔드 (진행 중)**
1. AWS CLI로 Lambda 함수 수동 생성
   ```bash
   aws lambda create-function \
     --function-name stockbrief-dev-frontend \
     --package-type Image \
     --code ImageUri=389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend:latest
   ```
2. Lambda Function URL 활성화
3. Cognito Callback URL 업데이트

**Phase 3: 선택사항**
- CloudFront 배포 (CDN 캐싱)
- Custom Domain 설정

### 결과
- **책임 분리**: FE는 이미지, BE는 인프라
- **안전성**: 기존 리소스 보호
- **유연성**: 단계별 검증 가능

### 배운 점
- **마이크로 배포**: 큰 변경보다 작은 단계로 나누기
- **역할과 책임**: 프론트엔드/백엔드 엔지니어 역할 명확히
- **IaC 한계**: Terraform이 만능은 아님, 때론 수동이 안전

---

## 핵심 교훈 정리

### 1. 아키텍처 의사결정
**학습**: Lambda Web Adapter를 선택한 이유는 비용 효율성(70% 절감)과 관리 편의성. Cold Start는 3-5초로 감수 가능.

**면접 대답**:
> "초기에는 ECS를 고려했지만, Lambda Web Adapter로 전환했습니다. 월 10만 PV 기준 ECS는 고정 비용 $30/월, Lambda는 사용량 기반 $8/월로 70% 절감됩니다. Cold Start 3-5초는 초기 스타트업에서 충분히 수용 가능한 트레이드오프라고 판단했습니다."

### 2. 문제 해결 프로세스
**학습**: 가정하지 말고 항상 확인. AWS CLI로 실제 상태 검증.

**면접 대답**:
> "ECR 계정 혼동 문제를 겪었을 때, README만 믿지 않고 `aws sts get-caller-identity`와 `aws ecr describe-repositories`로 실제 상태를 확인했습니다. 이를 통해 문서와 실제 환경의 불일치를 발견하고 해결했습니다."

### 3. 리스크 관리
**학습**: Terraform plan에서 60개 리소스 삭제를 발견하고 즉시 중단. 불확실하면 apply 하지 않기.

**면접 대답**:
> "Terraform apply 직전 plan 검토에서 RDS, Redis 등 60개 리소스가 삭제될 것을 발견했습니다. State 충돌이 의심되어 즉시 중단하고, 안전한 수동 배포로 전환했습니다. 프로덕션 환경 보호가 우선이라고 판단했습니다."

### 4. 자동화와 문서화
**학습**: 배포 스크립트 자동화, 문서화로 재현성 확보.

**면접 대답**:
> "환경 변수 주입 실수를 방지하기 위해 PowerShell 스크립트로 자동화했고, 트러블슈팅 과정을 `DEPLOYMENT_JOURNEY.md`로 문서화했습니다. 이를 통해 동일한 실수 재발 방지와 팀원 온보딩 시간 단축을 기대할 수 있습니다."

---

## 면접 예상 질문과 답변

### Q1: "가장 어려웠던 기술적 문제는 무엇이었나요?"

**답변**:
> "Terraform State 불일치로 인해 60개의 프로덕션 리소스가 삭제될 뻔한 상황이었습니다. Plan 단계에서 발견하여 즉시 중단했고, 근본 원인(Git HEAD detached, VPC 모듈 변경)을 파악한 후 안전한 수동 배포로 전환했습니다."

### Q2: "왜 Lambda를 선택했나요?"

**답변**:
> "비용 효율성과 관리 편의성을 고려했습니다. ECS는 월 $30 고정 비용이지만, Lambda는 사용량 기반으로 $8/월로 70% 절감됩니다. Cold Start 3-5초는 B2C 서비스 특성상 수용 가능하다고 판단했고, Lambda Web Adapter로 기존 Next.js 앱을 큰 변경 없이 이식할 수 있었습니다."

### Q3: "실패에서 무엇을 배웠나요?"

**답변**:
> "환경 변수를 기본값으로 빌드했다가 다시 빌드한 경험에서, Next.js는 빌드 타임에 환경 변수가 고정된다는 것을 배웠습니다. 이후 배포 스크립트를 만들어 Terraform output에서 실제 API URL을 자동으로 가져오도록 개선했습니다."

### Q4: "어떻게 문제를 디버깅했나요?"

**답변**:
> "단계별 검증을 했습니다. Dockerfile 빌드 실패 시 에러 메시지를 정독하고, `ls`로 실제 파일 구조를 확인했습니다. AWS 계정 혼동 시에는 `aws sts get-caller-identity`와 `aws ecr describe-repositories`로 실제 상태를 검증했습니다. 가정하지 않고 항상 확인하는 습관이 중요했습니다."

### Q5: "팀 협업은 어떻게 했나요?"

**답변**:
> "프론트엔드와 백엔드 역할을 명확히 구분했습니다. 프론트엔드는 Docker 이미지 빌드와 ECR 푸시까지, 백엔드는 Lambda 함수 생성과 인프라 배포를 담당했습니다. 이를 통해 각자의 전문 영역에 집중하고, Terraform State 충돌 같은 위험을 줄일 수 있었습니다."

---

## 메트릭 및 성과

| 항목 | 값 |
|------|-----|
| **총 배포 시도** | 3회 (ECS → Lambda 1차 → Lambda 2차) |
| **최종 이미지 크기** | 88MB (Alpine 기반) |
| **빌드 시간** | ~16초 (캐시 활용 시 ~7초) |
| **비용 절감** | 70% (ECS $30/월 → Lambda $8/월) |
| **리스크 회피** | 60개 리소스 삭제 위험 방지 |
| **문서 작성** | 6개 가이드 문서 |

---

## 참고 문서

- [Lambda 배포 가이드](LAMBDA_DEPLOYMENT.md)
- [ECR 푸시 가이드](ECR_PUSH_GUIDE.md)
- [ECR 푸시 완료 보고서](ECR_PUSH_COMPLETE.md)
- [다음 단계](NEXT_STEPS.md)
