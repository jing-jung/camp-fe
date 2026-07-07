import { ErrorState } from "@/components/ErrorState";
import { getRecommendationCandidate, getStock, getStockEvidence } from "@/lib/api";
import { StockDetailClient } from "./StockDetailClient";

// ISR: 10분마다 재생성
export const revalidate = 600;

type PageProps = {
  params: Promise<{ ticker: string }>;
};

export default async function StockPage({ params }: PageProps) {
  const { ticker } = await params;

  try {
    // 서버에서 병렬로 데이터 fetch
    const [candidate, stock, evidence] = await Promise.all([
      getRecommendationCandidate(ticker),
      getStock(ticker),
      getStockEvidence(ticker),
    ]);

    return <StockDetailClient candidate={candidate} stock={stock} evidence={evidence} />;
  } catch {
    return (
      <div className="mx-auto max-w-7xl px-5 py-8">
        <ErrorState href="/recommendations" />
      </div>
    );
  }
}
