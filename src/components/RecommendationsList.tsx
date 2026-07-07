"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CandidateTable } from "@/components/CandidateTable";
import { ErrorState } from "@/components/ErrorState";
import { getRecommendationCandidates } from "@/lib/api";
import { riskProfileLabel } from "@/lib/format";
import { riskProfileQueryValue } from "@/lib/risk-profile";
import { getRiskProfileCookie } from "@/lib/preference-cookie";
import type { RecommendationCandidateList } from "@/types/api";

export function RecommendationsList() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<RecommendationCandidateList | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

            try {
        let rawProfile: string | null | undefined = searchParams.get("risk_profile");
        if (!rawProfile) {
          rawProfile = getRiskProfileCookie() ?? undefined;
        }
        const riskProfile = riskProfileQueryValue(rawProfile);

        const market = searchParams.get("market");
        const sector = searchParams.get("sector");

        const data = await getRecommendationCandidates({
          riskProfile,
          market: market === "KOSPI" || market === "KOSDAQ" ? market : undefined,
          sector: typeof sector === "string" ? sector : undefined,
          limit: 20,
        });

        if (!cancelled) {
          setCandidates(data);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="text-center text-sm text-muted">로딩 중...</div>
      </div>
    );
  }

  if (error || !candidates) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <ErrorState href="/" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <section className="mb-6 flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">오늘의 추천 후보</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">추천 후보 리스트</h1>
          <p className="mt-2 text-sm text-muted">
            공개 데이터 기준으로 추천 이유, 근거, 리스크, 누락 데이터를 함께 확인합니다.
          </p>
        </div>
        <div className="text-sm text-muted">
          성향: {riskProfileLabel(candidates.risk_profile)} · 후보 {candidates.count}개
        </div>
      </section>
      <CandidateTable items={candidates.items} />
    </div>
  );
}
