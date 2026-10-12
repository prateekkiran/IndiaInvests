// POR05 — time-weighted return (TWR) and a clearly-labelled hypothetical
// benchmark. TWR removes the distorting effect of contribution TIMING that XIRR
// includes, so it answers "how did the investments themselves perform" rather
// than "what did my cash-flow schedule earn". The two are different measures by
// design and are always labelled as such — never compared naively.
//
// TWR is computed self-contained from the NAV series + transactions: at each
// fully-priced date we value the portfolio just BEFORE that date's flow and
// just AFTER it, then chain sub-period returns V_before(dᵢ) / V_after(dᵢ₋₁).
//
// The benchmark here is explicitly a HYPOTHETICAL constant-rate investment of
// the user's own cash flows — not a real index (the app fetches no market
// data). It answers "what if the same money had grown at a steady r%".

import { AppState } from "../types";
import { latestPrice } from "./portfolio";

export type TwrStatus = "ok" | "insufficient" | "short-period";

export interface TwrResult {
  status: TwrStatus;
  cumulative: number | null; // e.g. 0.21 = +21% over the whole measured span
  annualized: number | null;
  periods: number;
  elapsedDays: number;
  startDate: string | null;
  endDate: string | null;
  message: string;
}

/** Units held with eventDate strictly before (`<`) or up to and including (`<=`) a date. */
function unitsHeld(state: AppState, instrumentId: string, date: string, inclusive: boolean): number {
  return state.transactions
    .filter((t) => !t.reversed && t.instrumentId === instrumentId && (inclusive ? t.eventDate <= date : t.eventDate < date))
    .reduce((acc, t) => acc + (t.unitsDelta || 0), 0);
}

export function timeWeightedReturn(state: AppState): TwrResult {
  const heldIds = [...new Set(state.transactions.filter((t) => !t.reversed).map((t) => t.instrumentId))];
  const base: TwrResult = { status: "insufficient", cumulative: null, annualized: null, periods: 0, elapsedDays: 0, startDate: null, endDate: null, message: "" };

  if (heldIds.length === 0) {
    return { ...base, message: "TWR needs dated transactions and a NAV series." };
  }

  // Dates where EVERY currently-held instrument has a price (fully-valued points).
  const priceDates = [...new Set(state.prices.filter((p) => heldIds.includes(p.instrumentId)).map((p) => p.date))].sort();
  const fullyPriced = priceDates.filter((d) => {
    for (const id of heldIds) {
      // only require a price for instruments already held (units > 0) as of d
      if (unitsHeld(state, id, d, true) > 1e-9 && !latestPrice(state, id, d)) return false;
    }
    return true;
  });

  if (fullyPriced.length < 2) {
    return { ...base, message: "TWR needs at least two fully-priced dates (import a NAV-history package covering your funds)." };
  }

  const valueBefore = (d: string) =>
    heldIds.reduce((acc, id) => {
      const u = unitsHeld(state, id, d, false);
      if (u <= 1e-9) return acc;
      const p = latestPrice(state, id, d);
      return acc + (p ? u * p.price : 0);
    }, 0);
  const valueAfter = (d: string) =>
    heldIds.reduce((acc, id) => {
      const u = unitsHeld(state, id, d, true);
      if (u <= 1e-9) return acc;
      const p = latestPrice(state, id, d);
      return acc + (p ? u * p.price : 0);
    }, 0);

  let cum = 1;
  let periods = 0;
  let prevAfter: number | null = null;
  let firstActive: string | null = null;
  for (const d of fullyPriced) {
    const vb = valueBefore(d);
    const va = valueAfter(d);
    if (prevAfter !== null && prevAfter > 0) {
      cum *= vb / prevAfter;
      periods++;
    }
    if (va > 0) {
      prevAfter = va;
      if (!firstActive) firstActive = d;
    }
  }

  if (periods === 0 || !firstActive) {
    return { ...base, message: "Not enough valued sub-periods to compute TWR yet." };
  }

  const endDate = fullyPriced[fullyPriced.length - 1];
  const elapsedDays = Math.max(1, Math.round((new Date(endDate + "T00:00:00").getTime() - new Date(firstActive + "T00:00:00").getTime()) / 86400000));
  const cumulative = cum - 1;
  const annualized = Math.pow(cum, 365 / elapsedDays) - 1;

  if (elapsedDays < 30) {
    return { status: "short-period", cumulative, annualized: null, periods, elapsedDays, startDate: firstActive, endDate, message: "Span under 30 days — annualising would be volatile; showing the cumulative figure only." };
  }

  return { status: "ok", cumulative, annualized, periods, elapsedDays, startDate: firstActive, endDate, message: "Time-weighted return over the fully-priced span." };
}

export interface BenchmarkResult {
  benchmarkAnnual: number;
  investorFinalIfBenchmarked: number; // the user's cash flows grown at the benchmark rate
  investedTotal: number;
  portfolioCurrentValue: number | null;
  difference: number | null; // portfolio − hypothetical benchmark
}

/**
 * Hypothetical benchmark: grow each of the user's actual investment cash flows
 * at a steady annual rate to the terminal date. This is NOT a real index — it's
 * a constant-rate "what if", clearly labelled, offered because the app fetches
 * no market data.
 */
export function hypotheticalBenchmark(state: AppState, benchmarkAnnual: number, portfolioCurrentValue: number | null, terminalDate: string): BenchmarkResult {
  const flows = state.transactions.filter((t) => !t.reversed && typeof t.investorCashFlow === "number" && (t.investorCashFlow as number) < 0);
  const end = new Date(terminalDate + "T00:00:00").getTime();
  let grown = 0;
  let invested = 0;
  for (const t of flows) {
    const amt = -(t.investorCashFlow as number); // positive invested amount
    invested += amt;
    const years = Math.max(0, (end - new Date(t.eventDate + "T00:00:00").getTime()) / (365 * 86400000));
    grown += amt * Math.pow(1 + benchmarkAnnual, years);
  }
  return {
    benchmarkAnnual,
    investorFinalIfBenchmarked: grown,
    investedTotal: invested,
    portfolioCurrentValue,
    difference: portfolioCurrentValue != null ? portfolioCurrentValue - grown : null,
  };
}
