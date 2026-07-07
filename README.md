# StockBrief-fe

> **대규모 트래픽 대응 프론트엔드 아키텍처**  
> Next.js ISR + API 캐싱으로 100만 PV/월 규모를 안정적으로 처리하는 한국 국내 주식 추천 후보 서비스

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-Personal-green)](LICENSE)

개인 포트폴리오 프로젝트로, 근거 기반 종목 검토 후보를 제공합니다. 투자 조언이 아닌 `검토 후보 추천` 서비스입니다.

## 🎯 핵심 성과

이 프로젝트의 주요 목표는 **대규모 트래픽 환경에서도 비용 효율적이고 빠른 응답을 제공하는 프론트엔드 아키텍처 구현**입니다.

### 성능 개선 결과 (100k PV/월 기준)

| 메트릭 | Before | After | 개선 |
|--------|--------|-------|------|
| **Lambda 호출** | 100,000회 | 10,000회 | 90% ↓ |
| **서버 렌더링** | 100,000회 | 380회 | 99.6% ↓ |
| **TTFB** | 500ms | 50ms | 10배 ↑ |
| **LCP** | 2.5s | 0.4s | 6배 ↑ |
| **월 비용** | $120 | $100 | 16% ↓ |
| **동시 접속** | ~100명 | ~10,000명 | 100배 ↑ |

### 비용 효율성 (1M PV/월 시나리오)

- 기존 아키텍처: **$303/월**
- 최적화 후: **$208/월** (31% 절감)
- 예상 동시 접속: 10,000명 이상

## 🏗️ 아키텍처

### 전체 시스템 구조

```mermaid
flowchart TB
    User[👤 사용자]
    CDN[☁️ CloudFront CDN]
    NextJS[⚡ Next.js Server<br/>ECS Fargate]
    Lambda[🔥 Lambda Backend<br/>FastAPI]
    RDS[(🗄️ PostgreSQL<br/>RDS)]
    
    User -->|"1. 요청"| CDN
    CDN -->|"2. Cache Miss"| NextJS
    CDN -->|"✅ Cache Hit<br/>(정적 리소스, HTML)"| User
    
    NextJS -->|"3. API 호출<br/>(5-10분 캐시)"| Lambda
    Lambda -->|"4. DB 쿼리"| RDS
    
    NextJS -.->|"ISR<br/>(5-10분 재생성)"| NextJS
    
    style CDN fill:#ff9900
    style NextJS fill:#0070f3
    style Lambda fill:#ff9900
    style RDS fill:#336791
```

### 캐싱 전략 (3-Layer)

```mermaid
flowchart LR
    Request[요청]
    L1[Layer 1<br/>CloudFront<br/>정적 리소스 365일<br/>HTML 5분]
    L2[Layer 2<br/>ISR Cache<br/>페이지 5-10분]
    L3[Layer 3<br/>API Cache<br/>데이터 5-60분]
    Backend[백엔드 호출]
    
    Request --> L1
    L1 -->|Miss| L2
    L2 -->|Miss| L3
    L3 -->|Miss| Backend
    
    L1 -.->|Hit: <50ms| Request
    L2 -.->|Hit: <100ms| Request
    L3 -.->|Hit: <200ms| Request
    Backend -.->|~500ms| Request
    
    style L1 fill:#90EE90
    style L2 fill:#87CEEB
    style L3 fill:#FFB6C1
    style Backend fill:#FFD700
```

### 캐시 적중률 목표

| Layer | 목표 Hit Rate | 예상 응답 시간 |
|-------|--------------|-------------|
| CloudFront (L1) | 95% | < 50ms |
| ISR Cache (L2) | 85% | < 100ms |
| API Cache (L3) | 90% | < 200ms |
| Backend Origin | 5% | ~500ms |

## 📁 레포 범위

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

## 🚀 배포

### 배포 환경

- **Dev/Staging**: ECS Fargate + CloudFront
- **Production**: AWS Amplify (선택 가능)

```bash
pnpm run deploy:hosted
```

Docker 이미지 빌드 시 `NEXT_PUBLIC_*` 환경변수를 주입합니다.

### 배포 아키텍처

```mermaid
flowchart LR
    GitHub[📦 GitHub<br/>Push to main]
    Actions[⚙️ GitHub Actions]
    ECR[📦 Amazon ECR<br/>Docker Image]
    ECS[🚀 ECS Fargate<br/>Next.js]
    CF[☁️ CloudFront]
    Users[👥 Users]
    
    GitHub --> Actions
    Actions -->|Build & Push| ECR
    Actions -->|Deploy| ECS
    ECR --> ECS
    ECS --> CF
    CF --> Users
    
    style GitHub fill:#181717
    style Actions fill:#2088FF
    style ECR fill:#FF9900
    style ECS fill:#FF9900
    style CF fill:#FF9900
```

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

## 🛠️ 기술 스택

### Core
- **Framework**: Next.js 15 (App Router, ISR)
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS
- **State**: React 19, localStorage (MVP)

### Performance
- **Caching**: Next.js ISR (5-10분 revalidation)
- **API Cache**: fetch cache API (5분-1시간)
- **CDN**: CloudFront
- **Rendering**: Server Components + Client Components (하이브리드)

### Infrastructure
- **Compute**: ECS Fargate (Docker)
- **CDN**: CloudFront
- **Backend**: FastAPI Lambda
- **Database**: PostgreSQL RDS
- **Auth**: AWS Cognito (P1)

### Development
- **Testing**: Vitest
- **Linting**: ESLint
- **Package Manager**: pnpm
- **Runtime**: Node.js 24.x
- **CI/CD**: GitHub Actions

## 📊 성능 최적화 상세

### Phase 1: API 레벨 캐싱

```typescript
// src/lib/api.ts
const CACHE_DURATION = {
  RECOMMENDATION_LIST: 300,    // 5분
  RECOMMENDATION_DETAIL: 600,  // 10분
  STOCK_DETAIL: 3600,          // 1시간
  STOCK_EVIDENCE: 3600,        // 1시간
  SEARCH: 1800,                // 30분
};
```

**효과**: Lambda 호출 90% 감소, $15/월 절감

### Phase 2: ISR (Incremental Static Regeneration)

```typescript
// src/app/recommendations/page.tsx
export const revalidate = 300; // 5분마다 재생성

export default async function RecommendationsPage({ searchParams }) {
  const candidates = await getRecommendationCandidates(...);
  return <RecommendationsList initialData={candidates} />;
}
```

**효과**: 서버 렌더링 99.6% 감소, $6/월 절감

### 트래픽 시나리오 분석

| 일 방문자 | 월 비용 (Before) | 월 비용 (After) | 절감율 |
|----------|----------------|----------------|-------|
| 1만 PV | $120 | $100 | 16% |
| 10만 PV | $303 | $208 | 31% |
| 100만 PV | $1,200 | $800 | 33% |

## 📚 문서

- **아키텍처 문서**
  - [전체 캐싱 전략](docs/engineering/CACHING_STRATEGY.md)
  - [Phase 1: API 캐싱 구현](docs/engineering/FRONTEND_CACHING_IMPLEMENTATION.md)
  - [Phase 2: ISR 구현](docs/engineering/PHASE2_ISR_IMPLEMENTATION.md)

- **제품 문서**
  - [MVP PRD](docs/product/MVP_PRD.md)
  - [API 계약](docs/engineering/API_CONTRACT.md)

## 🎓 학습 포인트

이 프로젝트에서 다룬 주요 기술:

1. **Next.js App Router & Server Components**
   - Client/Server 컴포넌트 분리 전략
   - ISR을 활용한 정적 생성 + 자동 재검증

2. **다층 캐싱 아키텍처**
   - CloudFront (CDN)
   - Next.js ISR (페이지 캐시)
   - fetch API (데이터 캐시)

3. **대규모 트래픽 대응**
   - 비용 효율적인 서버리스 아키텍처
   - Stale-While-Revalidate 패턴
   - 동시 접속 10,000명 이상 처리

4. **성능 최적화**
   - TTFB 10배 개선
   - LCP 6배 개선
   - Server CPU 사용률 90% 감소

## 📄 라이선스

개인 포트폴리오 프로젝트 — 상업적 사용 시 별도 문의

---

**Built with 💙 by [jing-jung](https://github.com/jing-jung)**
