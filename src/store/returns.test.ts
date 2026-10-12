import { describe, it, expect } from "vitest";
import { timeWeightedReturn, hypotheticalBenchmark } from "./returns";
import { emptyState } from "./state";
import { AppState, Transaction, PriceObservation } from "../types";
import { round2 } from "../engine/money";

function stateWith(txns: Array<[string, number]>, navs: Array<[string, number]>): AppState {
  const instId = "inst_eq";
  const transactions: Transaction[] = txns.map(([date, units], i) => ({
    id: `t${i}`, accountId: "ac", instrumentId: instId, eventDate: date, type: "sip",
    unitsDelta: units, investorCashFlow: -(units * (navs.find((n) => n[0] === date)?.[1] ?? 0)),
  }));
  const prices: PriceObservation[] = navs.map(([date, price], i) => ({
    id: `p${i}`, instrumentId: instId, date, price, source: "test", quality: "package",
  }));
  return {
    ...emptyState(),
    instruments: [{ id: instId, name: "Eq", isin: "INFEQ", assetClass: "equity_mf", plan: "direct", option: "growth" }],
    accounts: [{ id: "ac", ownerId: "owner_self", provider: "X", maskedNumber: "••1" }],
    transactions,
    prices,
  };
}

describe("time-weighted return (POR05)", () => {
  it("isolates pure NAV return from contribution timing (10%/mo × 2 → +21%)", () => {
    // Monthly SIP of 1000 at NAVs 100, 110, 121. Pure price return is 21%.
    const navs: Array<[string, number]> = [["2026-01-01", 100], ["2026-02-01", 110], ["2026-03-01", 121]];
    const txns: Array<[string, number]> = [["2026-01-01", 10], ["2026-02-01", 1000 / 110], ["2026-03-01", 1000 / 121]];
    const twr = timeWeightedReturn(stateWith(txns, navs));
    expect(twr.status === "ok" || twr.status === "short-period").toBe(true);
    expect(round2((twr.cumulative ?? 0) * 100)).toBe(21);
  });

  it("reports insufficient data when there's only one priced date", () => {
    const twr = timeWeightedReturn(stateWith([["2026-01-01", 10]], [["2026-01-01", 100]]));
    expect(twr.status).toBe("insufficient");
    expect(twr.cumulative).toBeNull();
  });

  it("flat NAV yields ~0% TWR regardless of how much was contributed", () => {
    const navs: Array<[string, number]> = [["2026-01-01", 50], ["2026-06-01", 50], ["2026-12-01", 50]];
    const txns: Array<[string, number]> = [["2026-01-01", 20], ["2026-06-01", 40], ["2026-12-01", 10]];
    const twr = timeWeightedReturn(stateWith(txns, navs));
    expect(Math.abs(twr.cumulative ?? 1)).toBeLessThan(1e-9);
  });
});

describe("hypothetical benchmark (POR05)", () => {
  it("grows the investor's own cash flows at a constant rate", () => {
    // One ₹12,000 investment exactly one year before the terminal date at 10% → 13,200.
    const s = stateWith([["2025-10-01", 100]], [["2025-10-01", 120], ["2026-10-01", 132]]);
    const b = hypotheticalBenchmark(s, 0.1, 13200, "2026-10-01");
    expect(round2(b.investedTotal)).toBe(12000);
    expect(Math.round(b.investorFinalIfBenchmarked)).toBe(13200);
    expect(Math.round(b.difference ?? -1)).toBe(0);
  });

  it("reports the gap between the portfolio and the hypothetical", () => {
    const s = stateWith([["2025-10-01", 100]], [["2025-10-01", 100], ["2026-10-01", 100]]);
    const b = hypotheticalBenchmark(s, 0.1, 10000, "2026-10-01");
    // invested 10,000; benchmark grows to 11,000; portfolio is 10,000 → −1,000.
    expect(Math.round(b.investorFinalIfBenchmarked)).toBe(11000);
    expect(Math.round(b.difference ?? 0)).toBe(-1000);
  });
});
