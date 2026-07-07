import { Suspense } from "react";
import { MissingCookiePreferenceSync } from "@/components/MissingCookiePreferenceSync";
import { RecommendationsList } from "@/components/RecommendationsList";
import { getRecommendationCandidates } from "@/lib/api";
import type { RiskProfile } from "@/types/api";

// ISR: 5분마다 재생성
export const revalidate = 300;

type PageProps = {
  searchParams: Promise<{
    risk_profile?: string;
    market?: string;
    sector?: string;
  }>;
};

export default async function ExplorePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const riskProfile = normalizeRiskProfile(params.risk_profile);
  const market = params.market === "KOSPI" || params.market === "KOSDAQ" ? params.market : undefined;
  const sector = params.sector;

  // 서버에서 데이터 fetch
  const candidates = await getRecommendationCandidates({
    riskProfile,
    market,
    sector,
    limit: 20,
  });

  return (
    <>
      <Suspense fallback={null}>
        <MissingCookiePreferenceSync />
      </Suspense>
      <RecommendationsList initialData={candidates} />
    </>
  );
}

function normalizeRiskProfile(value?: string): RiskProfile | undefined {
  if (value === "conservative" || value === "balanced" || value === "aggressive") {
    return value;
  }
  return undefined;
}
