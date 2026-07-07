# StockBrief-fe

Next.js App Router 기반의 한국 국내 주식 추천 후보 서비스 프론트엔드.

개인 프로젝트로, 근거 기반 종목 검토 후보를 제공합니다. 투자 조언, 매수·매도 지시, 목표가 제시가 아닌 `검토 후보 추천` 서비스입니다.

## 레포 범위

| 구분 | 내용 |
| --- | --- |
| `src/app/` | Next.js App Router 페이지 |
| `src/components/` | UI 컴포넌트 (CandidateCard, EvidenceBadge, RiskTag 등) |
| `src/lib/` | API 클라이언트, Cognito 인증, watchlist 스토리지/싱크 |
| `src/types/` | TypeScript API 및 watchlist 타입 정의 |
| `docs/product/` | MVP PRD, 제품 정책 |
| `docs/engineering/` | API 계약 (BE 참조용) |

## 로컬 셋업

Node.js 24.x 기준으로 개발한다. `mise install`로 런타임을 맞춘 뒤 `pnpm`으로 의존성을 설치한다.

```bash
mise install
pnpm install
```

환경변수 설정:

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL 등 설정
```

백엔드 개발 환경이 준비되면 AWS 계정의 Terraform 출력값으로 로컬 환경변수를 생성할 수 있습니다.

```bash
pnpm run sync:dev-env -- --terraform-dir ../StockBrief-be/infra/terraform
```

## 개발 서버 실행

```bash
pnpm run dev
```

기본 주소: [http://localhost:3000](http://localhost:3000)

백엔드 API는 `http://localhost:8000` 에서 실행되어야 한다.

## 주요 페이지

| 경로 | 설명 |
| --- | --- |
| `/` | 메인 (추천 후보 목록으로 리다이렉트) |
| `/recommendations` | 추천 후보 목록 |
| `/stocks/[ticker]` | 종목 상세 및 에비던스 |
| `/watchlist` | 관심목록 (localStorage 기반, MVP) |
| `/onboarding` | 온보딩 |
| `/account` | 계정 (P1, Cognito 인증 필요) |

## 배포

AWS Amplify 또는 ECS Fargate + CloudFront로 배포할 수 있습니다.

```bash
pnpm run deploy:hosted
```

Docker 이미지 빌드 시 `NEXT_PUBLIC_*` 환경변수를 주입합니다.

## 검증 명령어

```bash
pnpm run lint       # ESLint
pnpm run typecheck  # TypeScript 타입 체크
pnpm run build      # 프로덕션 빌드
```

## 브랜치 정책

개인 프로젝트이지만 체계적인 브랜치 관리를 위해 다음 규칙을 따릅니다:

- `main`: 안정 브랜치
- `feat/<issue>-<slug>`: 새 기능
- `fix/<issue>-<slug>`: 버그 수정
- `docs/<slug>`: 문서 변경

커밋 타입: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`

## API 계약

API 계약은 `docs/engineering/API_CONTRACT.md`를 참조하며, 타입은 `src/types/api.ts`에서 관리합니다.

- Backend canonical API base: `/v1`
- Recommendation candidates: `GET /v1/recommendations/candidates`

## 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **State**: localStorage (MVP), AWS Cognito (P1)
- **Deployment**: AWS Amplify / ECS Fargate + CloudFront
- **Testing**: Vitest
- **Tooling**: ESLint, TypeScript, pnpm

## 라이선스

개인 프로젝트 — 상업적 사용 시 별도 문의
