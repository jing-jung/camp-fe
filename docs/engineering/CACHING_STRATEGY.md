# 대규모 트래픽 캐싱 전략

## 목표

100만 PV/월 규모에서 안정적인 성능과 비용 효율성 달성

## 캐싱 레이어

```
사용자
  ↓
1. CloudFront (CDN) ← 정적 리소스, API 응답 캐싱
  ↓
2. Next.js Server ← 페이지 캐싱, ISR
  ↓
3. API Gateway Cache ← API 응답 캐싱
  ↓
4. Lambda (Backend) ← Redis 캐싱 (선택)
  ↓
5. RDS PostgreSQL
```

## 캐싱 정책

### CloudFront 레벨

| 경로 패턴 | TTL | 전략 |
|----------|-----|------|
| `/_next/static/*` | 365일 | Immutable (빌드 해시) |
| `/*.png, /*.jpg, /*.svg` | 7일 | 정적 이미지 |
| `/api/v1/recommendations/candidates` | 5분 | 자주 변경되는 추천 목록 |
| `/api/v1/stocks/*/evidence` | 1시간 | 상대적으로 안정적인 근거 |
| `/api/v1/stocks/search` | 30분 | 검색 결과 |
| `/` (HTML) | 5분 | SSR 페이지 |

### Next.js 레벨

```typescript
// ISR (Incremental Static Regeneration) 활용
export const revalidate = 300; // 5분

// 동적 API 라우트 캐싱
export const dynamic = 'force-cache';
export const fetchCache = 'force-cache';
```

### API 레벨

```typescript
// 추천 후보 목록: 5분 캐시
fetch('/v1/recommendations/candidates', {
  next: { revalidate: 300 }
})

// 종목 상세: 1시간 캐시
fetch(`/v1/stocks/${ticker}`, {
  next: { revalidate: 3600 }
})

// 실시간 데이터: 캐시 안 함
fetch('/v1/me/watchlist', {
  cache: 'no-store'
})
```

## 캐시 무효화 전략

### 배포 시
- `/*` 전체 무효화 (현재 구현됨)

### 데이터 업데이트 시
- 추천 엔진 재계산: `/api/v1/recommendations/*` 무효화
- 뉴스/공시 추가: `/api/v1/stocks/*/evidence` 무효화
- 종목 정보 변경: `/api/v1/stocks/${ticker}` 무효화

## 예상 효과

### 트래픽 절감

| 시나리오 | Before | After | 절감율 |
|---------|--------|-------|-------|
| 정적 리소스 | 100% Origin | 1% Origin | 99% |
| 추천 목록 API | 100% Lambda | 10% Lambda | 90% |
| 종목 상세 API | 100% DB | 5% DB | 95% |

### 비용 절감 (100만 PV 기준)

| 항목 | Before | After | 절감 |
|------|--------|-------|------|
| Lambda 호출 | 100만 회 | 10만 회 | $15 → $1.5 |
| CloudFront | $86 | $86 | 동일 |
| RDS CPU | 80% | 10% | 부하 감소 |
| **총 비용** | **$115** | **$100** | **13% 절감** |

### 성능 개선

- **TTFB**: 500ms → 50ms (10배)
- **페이지 로드**: 2s → 0.5s (4배)
- **동시 접속**: 100 → 10,000+ (100배)

## 구현 우선순위

1. **P0: CloudFront 캐싱 설정** - Terraform 수정
2. **P0: API fetch 캐싱 정책** - src/lib/api.ts 수정
3. **P1: ISR 적용** - 추천 목록 페이지 정적 생성
4. **P1: ECS Auto Scaling** - 트래픽 급증 대응
5. **P2: Redis 캐시** - 백엔드 DB 쿼리 캐싱

## 모니터링

- CloudWatch: Cache Hit Ratio 모니터링
- CloudFront: 캐시 통계 대시보드
- 목표: Cache Hit Rate > 85%
