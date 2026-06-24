import { describe, expect, it } from "vitest";

import { readRiskProfile, riskProfileQueryValue } from "./risk-profile";

describe("risk profile helpers", () => {
  it("accepts supported API risk profile values", () => {
    expect(readRiskProfile("conservative")).toBe("conservative");
    expect(readRiskProfile("balanced")).toBe("balanced");
    expect(readRiskProfile("aggressive")).toBe("aggressive");
  });

  it("rejects unsupported risk profile values", () => {
    expect(readRiskProfile("growth")).toBeNull();
    expect(readRiskProfile(["aggressive"])).toBeNull();
    expect(readRiskProfile(null)).toBeNull();
  });

  it("uses balanced as the query fallback", () => {
    expect(riskProfileQueryValue("conservative")).toBe("conservative");
    expect(riskProfileQueryValue("growth")).toBe("balanced");
    expect(riskProfileQueryValue(["aggressive"])).toBe("balanced");
    expect(riskProfileQueryValue(undefined)).toBe("balanced");
  });
});
