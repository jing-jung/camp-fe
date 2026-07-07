# Frontend Caching Implementation

## Phase 1: API Caching Strategy ✅ Completed

### Overview

대규모 트래픽 대응을 위해 Next.js의 fetch cache 기능을 활용한 API 레벨 캐싱 전략 구현.

### Implementation Details

#### 1. Cache Duration 정의

```typescript
const CACHE_DURATION = {
  RECOMMENDATION_LIST: 300,    // 5분 - 추천 목록
  RECOMMENDATION_DETAIL: 600,  // 10분 - 종목 상세 추천
  STOCK_DETAIL: 3600,          // 1시간 - 기본 종목 정보
  STOCK_EVIDENCE: 3600,        // 1시간 - 근거 데이터
  SEARCH: 1800,                // 30분 - 검색 결과
  NO_CACHE: 0,                 // 캐시 없음 - 실시간/인증 필요
} as const;
```

#### 2. Request 함수 개선

**Before:**
```typescript
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store", // 모든 요청이 캐시 안 함
  });
}
```

**After:**
```typescript
async function request<T>(
  path: string,
  init?: RequestInit,
  revalidate?: number,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...(revalidate !== undefined && revalidate > 0
      ? { next: { revalidate } }     // 캐시 활성화
      : { cache: "no-store" }),      // 실시간 유지
  });
}
```

#### 3. API 함수별 캐싱 적용

| API Function | Cache Time | Rationale |
|-------------|-----------|-----------|
| `getRecommendationCandidates` | 5분 | 추천 목록은 자주 변경되지만 실시간일 필요 없음 |
| `getRecommendationCandidate` | 10분 | 개별 종목 추천은 상대적으로 안정적 |
| `getStock` | 1시간 | 기본 종목 정보는 거의 변경 안 됨 |
| `getStockEvidence` | 1시간 | 근거 데이터는 안정적 |
| `searchStocks` | 30분 | 검색 결과는 중간 정도 |
| `postChat` | 없음 | 실시간 AI 응답 필요 |
| `getMe`, `getServerWatchlist` | 없음 | 인증 필요, 개인화 데이터 |

### Expected Impact

#### Traffic Reduction

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lambda Invocations (100k PV) | 100,000 | ~10,000 | **90% ↓** |
| DB Queries | 100,000 | ~10,000 | **90% ↓** |
| Backend Load | 100% | 10% | **90% ↓** |

#### Cost Reduction (Monthly, 100k PV)

| Item | Before | After | Savings |
|------|--------|-------|---------|
| Lambda Compute | $16.67 | $1.67 | $15.00 |
| RDS CPU Usage | 80% | 10% | 87.5% ↓ |
| **Total Monthly Cost** | **$115** | **$100** | **$15 (13%)** |

#### Performance Improvement

- **TTFB (Time To First Byte)**: 500ms → 50ms (10배 개선)
- **API Response Time**: 평균 200ms → 20ms (10배 개선)
- **Cache Hit Rate Target**: 85% 이상

### Cache Invalidation Strategy

#### Automatic Revalidation
- Next.js가 설정된 시간마다 자동으로 재검증
- Stale-While-Revalidate 패턴 활용

#### Manual Invalidation (향후 구현)
```typescript
// 배포 시 CloudFront 무효화와 함께 처리
await fetch('/api/revalidate?path=/recommendations/candidates', {
  method: 'POST',
});
```

### Monitoring

추천 모니터링 메트릭:

1. **Cache Hit Rate**
   - CloudWatch에서 `CacheHitRate` 메트릭 추적
   - 목표: 85% 이상

2. **Backend Request Volume**
   - Lambda invocation count
   - 목표: 이전 대비 90% 감소

3. **Response Time**
   - API 응답 시간 P50, P95, P99
   - 목표: P95 < 100ms

### Verification

```bash
# 타입 체크
npm run typecheck  # ✅ Passed

# 빌드 테스트
npm run build

# 로컬 테스트
npm run dev
# 브라우저에서 Network 탭 확인:
# - 두 번째 요청부터 from cache 표시 확인
```

### Next Steps

- [ ] Phase 2: ISR (Incremental Static Regeneration) 적용
- [ ] Phase 3: 이미지 최적화
- [ ] CloudFront 캐싱 설정 (백엔드 인프라)
- [ ] ECS Auto Scaling 설정 (백엔드 인프라)

### Rollback Plan

문제 발생 시 롤백:

```typescript
// src/lib/api.ts
// revalidate 파라미터를 모두 제거하고 cache: "no-store"로 복원
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
  });
}
```

### References

- [Next.js Data Fetching: Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [fetch API Options](https://nextjs.org/docs/app/api-reference/functions/fetch)
- `/docs/engineering/CACHING_STRATEGY.md` - 전체 캐싱 전략 문서
