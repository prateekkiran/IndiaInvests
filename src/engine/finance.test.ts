import { describe, it, expect } from "vitest";
import {
  monthlyRateFromAnnual,
  lumpSumFV,
  sipFV,
  stepUpContribution,
  futureGoalValue,
  realValue,
  requiredEndMonthSIP,
  cagr,
  periodInvestmentGain,
  fundingRatio,
  project,
  projectedFinalValue,
} from "./finance";
import { round2 } from "./money";
import { xirr } from "./xirr";

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

describe("golden calculation fixtures (PRD §7)", () => {
  it("INR 1,000 end-month SIP for 12 months at 0% -> 12,000", () => {
    expect(round2(sipFV(1000, 0, 12, "end"))).toBe(12000);
  });

  it("INR 10,000 lump sum for 12 months at 12% annual effective -> 11,200", () => {
    const i = monthlyRateFromAnnual(0.12);
    expect(round2(lumpSumFV(10000, i, 12))).toBe(11200);
  });

  it("INR 1,000 SIP for 2 months at 1% monthly -> end 2,010.00; begin 2,030.10", () => {
    expect(round2(sipFV(1000, 0.01, 2, "end"))).toBe(2010);
    expect(round2(sipFV(1000, 0.01, 2, "begin"))).toBe(2030.1);
  });

  it("INR 1,000 monthly with 10% step up over 24 months at 0% -> 25,200; month 13 = 1,100", () => {
    expect(round2(stepUpContribution(1000, 0.1, 13))).toBe(1100);
    const final = projectedFinalValue({
      openingBalance: 0,
      months: 24,
      monthlyRate: 0,
      baseContribution: 1000,
      timing: "end",
      annualStepUp: 0.1,
    });
    expect(round2(final)).toBe(25200);
  });

  it("INR 1,00,000 goal in today's money after 1 year at 6% inflation -> 1,06,000", () => {
    expect(round2(futureGoalValue(100000, 0.06, 12))).toBe(106000);
  });

  it("Required SIP for INR 1,20,000 in 12 months, no initial balance, 0% -> 10,000/month", () => {
    const r = requiredEndMonthSIP(120000, 0, 0, 12);
    expect(round2(r.requiredContribution)).toBe(10000);
    expect(r.immediateGap).toBeNull();
  });

  it("XIRR -10,000 on 1 Jan 2025 and +11,000 on 1 Jan 2026 -> ~10%", () => {
    const r = xirr([
      { date: "2025-01-01", amount: -10000 },
      { date: "2026-01-01", amount: 11000 },
    ]);
    expect(r.status).toBe("ok");
    expect(near(r.rate!, 0.1, 1e-4)).toBe(true);
  });

  it("Balance 100, withdrawal 150, zero growth -> pay 100, unmet 50, closing 0", () => {
    const rows = project({
      openingBalance: 100,
      months: 1,
      monthlyRate: 0,
      baseContribution: 0,
      timing: "end",
      withdrawals: new Map([[1, 150]]),
    });
    const row = rows[0];
    expect(round2(row.withdrawalPaid)).toBe(100);
    expect(round2(row.withdrawalUnmet)).toBe(50);
    expect(round2(row.closingBalance)).toBe(0);
  });
});

describe("edge cases and conventions", () => {
  it("rejects R <= -100% for monthly rate", () => {
    expect(() => monthlyRateFromAnnual(-1)).toThrow();
  });

  it("lump sum with n = 0 returns PV", () => {
    expect(lumpSumFV(5000, 0.01, 0)).toBe(5000);
  });

  it("supports negative returns in projection", () => {
    const i = monthlyRateFromAnnual(-0.1);
    const final = projectedFinalValue({
      openingBalance: 10000,
      months: 12,
      monthlyRate: i,
      baseContribution: 0,
      timing: "end",
    });
    expect(round2(final)).toBe(9000);
  });

  it("real value strips inflation back out of a future-goal amount", () => {
    const fv = futureGoalValue(100000, 0.06, 12);
    expect(round2(realValue(fv, 0.06, 12))).toBe(100000);
  });

  it("required SIP at n = 0 reports an immediate gap, not a division", () => {
    const r = requiredEndMonthSIP(120000, 50000, 0.01, 0);
    expect(r.requiredContribution).toBe(0);
    expect(r.immediateGap).toBe(70000);
  });

  it("CAGR handles zero terminal value as -100%", () => {
    expect(cagr(10000, 0, 365)).toBe(-1);
  });

  it("CAGR of doubling over exactly one year is 100%", () => {
    expect(near(cagr(10000, 20000, 365), 1, 1e-9)).toBe(true);
  });

  it("period investment gain separates flows from performance", () => {
    expect(periodInvestmentGain(12000, 10000, 1500, 0)).toBe(500);
  });

  it("funding ratio reports overfunding rather than capping", () => {
    expect(fundingRatio(150000, 100000)).toBe(1.5);
    expect(() => fundingRatio(100, 0)).toThrow();
  });

  it("leap-year XIRR stays close to the simple-interest expectation", () => {
    const r = xirr([
      { date: "2024-01-01", amount: -10000 },
      { date: "2024-12-31", amount: 11000 },
    ]);
    expect(r.status === "ok" || r.status === "short-period").toBe(true);
    expect(r.rate! > 0.08 && r.rate! < 0.12).toBe(true);
  });

  it("flags no-root XIRR histories", () => {
    const r = xirr([
      { date: "2025-01-01", amount: -10000 },
      { date: "2026-01-01", amount: -5000 },
    ]);
    expect(r.status).toBe("insufficient-flows");
  });

  it("flags ambiguous (multiple sign change) histories", () => {
    const r = xirr([
      { date: "2020-01-01", amount: -10000 },
      { date: "2021-01-01", amount: 25000 },
      { date: "2022-01-01", amount: -20000 },
      { date: "2023-01-01", amount: 8000 },
    ]);
    expect(["ambiguous", "no-sign-change"]).toContain(r.status);
    expect(r.rate).toBeNull();
  });

  it("aggregates same-date flows", () => {
    const r = xirr([
      { date: "2025-01-01", amount: -5000 },
      { date: "2025-01-01", amount: -5000 },
      { date: "2026-01-01", amount: 11000 },
    ]);
    expect(r.status).toBe("ok");
    expect(near(r.rate!, 0.1, 1e-4)).toBe(true);
  });

  it("begin-of-month SIP exceeds end-of-month SIP at positive rates", () => {
    const end = sipFV(1000, 0.01, 12, "end");
    const begin = sipFV(1000, 0.01, 12, "begin");
    expect(begin).toBeGreaterThan(end);
    expect(round2(begin)).toBe(round2(end * 1.01));
  });
});
