import { describe, it, expect } from "vitest";
import { allocationDrift } from "./allocation";
import { round2 } from "./money";

const MIX = [
  { assetClass: "equity_mf", value: 2200000 },
  { assetClass: "debt_mf", value: 500000 },
  { assetClass: "epf", value: 540000 },
  { assetClass: "ppf", value: 310000 },
  { assetClass: "gold", value: 180000 },
  { assetClass: "cash", value: 250000 },
]; // total 39,80,000

describe("allocation drift (rebalance lens)", () => {
  it("reports drift in percentage points and the rupee moves to reach target", () => {
    const r = allocationDrift(MIX, { equity_mf: 50, debt_mf: 15, epf: 12, ppf: 8, gold: 5, cash: 10 });
    expect(r.total).toBe(3980000);
    expect(r.hasTargets).toBe(true);
    const eq = r.rows.find((x) => x.assetClass === "equity_mf")!;
    expect(round2(eq.driftPp)).toBeCloseTo(5.28, 1); // 55.28% − 50%
    expect(Math.round(eq.deltaRupees)).toBe(-210000); // trim ₹2.1L of equity
    const cash = r.rows.find((x) => x.assetClass === "cash")!;
    expect(Math.round(cash.deltaRupees)).toBe(148000); // top up ₹1.48L of cash
  });

  it("rupee deltas net to zero — a rebalance keeps the total constant", () => {
    const r = allocationDrift(MIX, { equity_mf: 50, debt_mf: 15, epf: 12, ppf: 8, gold: 5, cash: 10 });
    const net = r.rows.reduce((a, x) => a + x.deltaRupees, 0);
    expect(Math.abs(net)).toBeLessThan(1e-6);
    expect(Math.round(r.turnover)).toBe(272400); // one-way rebalance size (sum of buys)
  });

  it("normalises targets that don't sum to 100", () => {
    // Weights 2:1:1:1:1:1 (sum 7) → equity target = 2/7 ≈ 28.57%.
    const r = allocationDrift(MIX, { equity_mf: 2, debt_mf: 1, epf: 1, ppf: 1, gold: 1, cash: 1 });
    const eq = r.rows.find((x) => x.assetClass === "equity_mf")!;
    expect(eq.targetFraction).toBeCloseTo(2 / 7, 6);
  });

  it("with no targets, drift is zero everywhere", () => {
    const r = allocationDrift(MIX, {});
    expect(r.hasTargets).toBe(false);
    expect(r.maxAbsDriftPp).toBeCloseTo(0, 9);
    expect(r.rows.every((x) => Math.abs(x.deltaRupees) < 1e-9)).toBe(true);
  });

  it("ignores a target for a class that isn't held", () => {
    const r = allocationDrift([{ assetClass: "equity_mf", value: 100000 }], { equity_mf: 60, nps: 40 });
    const eq = r.rows.find((x) => x.assetClass === "equity_mf")!;
    // Only equity is held, so it normalises to 100% of the (single-class) book.
    expect(eq.targetFraction).toBeCloseTo(1, 9);
    expect(Math.abs(eq.deltaRupees)).toBeLessThan(1e-9);
  });
});
