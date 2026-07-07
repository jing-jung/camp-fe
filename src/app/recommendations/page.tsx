"use client";

import { Suspense } from "react";

import { MissingCookiePreferenceSync } from "@/components/MissingCookiePreferenceSync";
import { RecommendationsList } from "@/components/RecommendationsList";

export default function RecommendationsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <MissingCookiePreferenceSync />
      </Suspense>
      <Suspense fallback={<div className="mx-auto max-w-7xl px-5 py-8 text-center text-sm text-muted">로딩 중...</div>}>
        <RecommendationsList />
      </Suspense>
    </>
  );
}
