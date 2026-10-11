// Deterministic financial calculation engine.
//
// Every function here maps to a formula in section 7 of the PRD (F01..F12) and
// is covered by golden-fixture tests in finance.test.ts. The projection engine
// (`project`) is the authoritative path for step-up / pause / one-time /
// withdrawal scenarios; the closed forms are used for simple cases and as
// cross-checks. Timing conventions are never mixed inside a single formula.

export const MONTHS_PER_YEAR = 12;
export type Timing = "end" | "begin";

function assertWholeNonNegative(n: number, label = "months"): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${label} must be a non-negative whole number (got ${n}).`);
  }
}

/** F01 — Monthly effective rate from an annual effective rate. Never R/12. */
export function monthlyRateFromAnnual(annualEffective: number): number {
  if (annualEffective <= -1) {
    throw new RangeError("Annual effective return must exceed -100%.");
  }
  return Math.pow(1 + annualEffective, 1 / MONTHS_PER_YEAR) - 1;
}

/** F02 — Lump sum future value. n = 0 returns PV. */
export function lumpSumFV(pv: number, monthlyRate: number, months: number): number {
  assertWholeNonNegative(months);
  return pv * Math.pow(1 + monthlyRate, months);
}

/** F03 — Level SIP future value. At i = 0 uses P × n; begin-of-month multiplies by (1 + i). */
export function sipFV(
  contribution: number,
  monthlyRate: number,
  months: number,
  timing: Timing = "end"
): number {
  assertWholeNonNegative(months);
  if (months === 0) return 0;
  if (Math.abs(monthlyRate) < 1e-15) return contribution * months;
  let fv = contribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  if (timing === "begin") fv *= 1 + monthlyRate;
  return fv;
}

/** F04 — Stepped contribution for a 1-based month index. First step occurs at month 13. */
export function stepUpContribution(
  firstMonthly: number,
  annualStepUp: number,
  month1Based: number
): number {
  assertWholeNonNegative(month1Based - 1, "month index");
  const years = Math.floor((month1Based - 1) / MONTHS_PER_YEAR);
  return firstMonthly * Math.pow(1 + annualStepUp, years);
}

/** F06 — Future value of a goal stated in today's rupees. */
export function futureGoalValue(todayAmount: number, annualInflation: number, months: number): number {
  assertWholeNonNegative(months);
  return todayAmount * Math.pow(1 + annualInflation, months / MONTHS_PER_YEAR);
}

/** F07 — Real (inflation-adjusted) value of a nominal future amount. */
export function realValue(nominalFV: number, annualInflation: number, months: number): number {
  assertWholeNonNegative(months);
  return nominalFV / Math.pow(1 + annualInflation, months / MONTHS_PER_YEAR);
}

/** F07 — Real annual return from nominal return and inflation. */
export function realAnnualReturn(annualReturn: number, annualInflation: number): number {
  return (1 + annualReturn) / (1 + annualInflation) - 1;
}

export interface RequiredSipResult {
  /** Required end-of-month contribution. 0 if the goal is already funded by PV growth. */
  requiredContribution: number;
  /** When n = 0, the plan cannot use a SIP; this is the immediate funding gap instead. */
  immediateGap: number | null;
}

/** F08 — Required end-of-month SIP to reach a future goal from a present value. */
export function requiredEndMonthSIP(
  futureGoal: number,
  presentValue: number,
  monthlyRate: number,
  months: number
): RequiredSipResult {
  assertWholeNonNegative(months);
  const grownPV = presentValue * Math.pow(1 + monthlyRate, months);
  if (months === 0) {
    return { requiredContribution: 0, immediateGap: Math.max(0, futureGoal - presentValue) };
  }
  const annuityFactor =
    Math.abs(monthlyRate) < 1e-15 ? months : (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  const required = Math.max(0, (futureGoal - grownPV) / annuityFactor);
  return { requiredContribution: required, immediateGap: null };
}

/** F09 — CAGR over d elapsed days. Valid only for positive start, positive days, no intervening flows. */
export function cagr(startValue: number, endValue: number, elapsedDays: number): number {
  if (startValue <= 0) throw new RangeError("CAGR requires a positive starting value.");
  if (elapsedDays <= 0) throw new RangeError("CAGR requires positive elapsed days.");
  if (endValue <= 0) return -1; // zero/negative terminal value gives -100%
  return Math.pow(endValue / startValue, 365 / elapsedDays) - 1;
}

/** F11 — Period investment gain, separating performance from external cash flows. */
export function periodInvestmentGain(
  endValue: number,
  startValue: number,
  externalInflows: number,
  externalOutflows: number
): number {
  return endValue - startValue - externalInflows + externalOutflows;
}

/** F12 — Funding ratio of a goal. A zero goal is invalid; overfunding is reported, not capped. */
export function fundingRatio(projectedAllocatedValue: number, futureGoalValue: number): number {
  if (futureGoalValue <= 0) throw new RangeError("Funding ratio requires a positive goal value.");
  return projectedAllocatedValue / futureGoalValue;
}

// ---------------------------------------------------------------------------
// Event engine (F05) — authoritative for step-up, pauses, one-time and withdrawals.
// ---------------------------------------------------------------------------

export interface ProjectionInput {
  openingBalance: number;
  months: number;
  /** Monthly effective rate, scalar or per-month array (length === months). */
  monthlyRate: number | number[];
  /** Base recurring contribution applied each non-paused month. */
  baseContribution: number;
  timing: Timing;
  /** Annual step-up applied to the base contribution; first step at month 13. */
  annualStepUp?: number;
  /** 1-based month indices where the base contribution is paused. */
  pauses?: Iterable<number>;
  /** 1-based month -> extra one-time contribution. */
  oneTime?: Map<number, number>;
  /** 1-based month -> requested withdrawal. */
  withdrawals?: Map<number, number>;
}

export interface MonthRow {
  month: number;
  openingBalance: number;
  contribution: number;
  withdrawalRequested: number;
  withdrawalPaid: number;
  withdrawalUnmet: number;
  growth: number;
  closingBalance: number;
  cumulativeContribution: number;
  cumulativeWithdrawalPaid: number;
}

function rateAt(rate: number | number[], monthIndex0: number): number {
  return Array.isArray(rate) ? rate[monthIndex0] ?? rate[rate.length - 1] ?? 0 : rate;
}

/**
 * F05 — Month-by-month balance evolution.
 *   end-of-month:   B_t = B_(t-1)·(1+i_t) + P_t − W_t
 *   begin-of-month: B_t = (B_(t-1) + P_t − W_t)·(1+i_t), affordability checked before growth.
 * Withdrawals stop at the available balance and report any unmet amount.
 */
export function project(input: ProjectionInput): MonthRow[] {
  assertWholeNonNegative(input.months);
  const pauses = new Set<number>(input.pauses ?? []);
  const oneTime = input.oneTime ?? new Map<number, number>();
  const withdrawals = input.withdrawals ?? new Map<number, number>();
  const g = input.annualStepUp ?? 0;

  const rows: MonthRow[] = [];
  let balance = input.openingBalance;
  let cumContribution = 0;
  let cumWithdrawalPaid = 0;

  for (let t = 1; t <= input.months; t++) {
    const i = rateAt(input.monthlyRate, t - 1);
    const stepped = pauses.has(t)
      ? 0
      : stepUpContribution(input.baseContribution, g, t);
    const contribution = stepped + (oneTime.get(t) ?? 0);
    const requested = Math.max(0, withdrawals.get(t) ?? 0);
    const opening = balance;

    let growth: number;
    let paid: number;
    let closing: number;

    if (input.timing === "end") {
      const grown = opening * (1 + i);
      growth = grown - opening;
      const available = grown + contribution;
      paid = Math.min(requested, Math.max(0, available));
      closing = available - paid;
    } else {
      const preGrowth = opening + contribution;
      paid = Math.min(requested, Math.max(0, preGrowth));
      const afterWithdrawal = preGrowth - paid;
      closing = afterWithdrawal * (1 + i);
      growth = closing - afterWithdrawal;
    }

    cumContribution += contribution;
    cumWithdrawalPaid += paid;

    rows.push({
      month: t,
      openingBalance: opening,
      contribution,
      withdrawalRequested: requested,
      withdrawalPaid: paid,
      withdrawalUnmet: requested - paid,
      growth,
      closingBalance: closing,
      cumulativeContribution: cumContribution,
      cumulativeWithdrawalPaid: cumWithdrawalPaid,
    });

    balance = closing;
  }

  return rows;
}

/** Convenience: terminal balance from a projection. */
export function projectedFinalValue(input: ProjectionInput): number {
  const rows = project(input);
  return rows.length ? rows[rows.length - 1].closingBalance : input.openingBalance;
}
