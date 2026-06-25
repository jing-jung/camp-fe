import type { RiskProfile } from "@/types/api";

export function readRiskProfile(value: unknown): RiskProfile | null {
  if (value === "conservative" || value === "balanced" || value === "aggressive") {
    return value;
  }
  return null;
}

export function riskProfileQueryValue(value: string | string[] | undefined): RiskProfile {
  return readRiskProfile(value) ?? "balanced";
}
