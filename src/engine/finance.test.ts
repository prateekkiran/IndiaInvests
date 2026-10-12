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
  emi,
  amortize,
  fdMaturity,
  rdMaturityGeneric,
  drawdownProjection,
  sequenceStress,
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


describe("decumulation & more calculators (P1)", () => {
  it("EMI: 100000 @ 0% over 10 months -> 10,000", () => {
    expect(round2(emi(100000, 0, 10))).toBe(10000);
  });

  it("EMI: 100000 @ 12% nominal over 12 months -> 8,884.88", () => {
    expect(round2(emi(100000, 0.12, 12))).toBe(8884.88);
  });

  it("EMI rejects non-positive tenure", () => {
    expect(() => emi(100000, 0.1, 0)).toThrow();
  });

  it("Amortization pays the loan off exactly on schedule with no prepayment", () => {
    const a = amortize(100000, 0.12, 12);
    expect(a.payoffMonth).toBe(12);
    expect(round2(a.rows[a.rows.length - 1].balance)).toBe(0);
    expect(round2(a.totalInterest)).toBe(6618.55);
  });

  it("Monthly prepayment shortens the tenure and cuts interest", () => {
    const base = amortize(2500000, 0.09, 240);
    const pre = amortize(2500000, 0.09, 240, 5000);
    expect(pre.payoffMonth).toBeLessThan(base.payoffMonth);
    expect(pre.totalInterest).toBeLessThan(base.totalInterest);
    expect(pre.payoffMonth).toBe(154);
  });

  it("FD: 1,00,000 @ 8% nominal, quarterly, 1 year -> 1,08,243.22", () => {
    const r = fdMaturity(100000, 0.08, 1, 4);
    expect(round2(r.maturity)).toBe(108243.22);
    expect(round2(r.interest)).toBe(8243.22);
    expect(near(r.effectiveYield, 0.08243216, 1e-6)).toBe(true);
  });

  it("FD at 0% returns the principal", () => {
    expect(round2(fdMaturity(50000, 0, 5, 4).maturity)).toBe(50000);
  });

  it("RD (generic): 1,000/mo @ 12% nominal for 12 months -> 12,682.50", () => {
    const r = rdMaturityGeneric(1000, 0.12, 12);
    expect(round2(r.maturity)).toBe(12682.5);
    expect(round2(r.interest)).toBe(682.5);
  });

  it("Drawdown: 10,00,000 at 0% withdrawing 1,00,000/mo depletes in month 11", () => {
    const d = drawdownProjection({ openingCorpus: 1000000, months: 12, annualReturn: 0, firstMonthlyWithdrawal: 100000 });
    expect(d.depletionMonth).toBe(11);
    expect(round2(d.endingBalance)).toBe(0);
    expect(round2(d.totalUnmet)).toBe(200000);
  });

  it("Drawdown: a small withdrawal from a large corpus never depletes", () => {
    const d = drawdownProjection({ openingCorpus: 1000000, months: 12, annualReturn: 0.1, firstMonthlyWithdrawal: 5000 });
    expect(d.depletionMonth).toBeNull();
    expect(d.endingBalance).toBeGreaterThan(1000000);
  });

  it("Pension income reduces the net withdrawal from the corpus", () => {
    const withPension = drawdownProjection({ openingCorpus: 1000000, months: 12, annualReturn: 0, firstMonthlyWithdrawal: 100000, monthlyPension: 100000 });
    expect(withPension.depletionMonth).toBeNull();
    expect(round2(withPension.endingBalance)).toBe(1000000);
  });

  it("Sequence risk: bad-early depletes no later and ends no higher than good-early", () => {
    const s = sequenceStress(5000000, 360, 0.09, 35000, 0.06);
    const bad = s.badEarly.depletionMonth ?? Number.POSITIVE_INFINITY;
    const good = s.goodEarly.depletionMonth ?? Number.POSITIVE_INFINITY;
    expect(bad).toBeLessThanOrEqual(good);
    expect(s.badEarly.endingBalance).toBeLessThanOrEqual(s.goodEarly.endingBalance + 1e-6);
  });
});
