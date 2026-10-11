// F13 — XIRR with a bracketed numerical solver (no unchecked Newton).
//
// Investor contributions are negative, receipts (incl. terminal portfolio value)
// are positive. We aggregate same-date flows, require at least one positive and
// one negative flow with non-zero elapsed time, scan a log-spaced grid for sign
// changes, and bisect each bracket to a residual tolerance. Non-conventional
// histories (multiple sign changes) yield an ambiguity warning rather than an
// unqualified single rate.

export interface CashFlow {
  date: Date;
  amount: number;
}

export type XirrStatus =
  | "ok"
  | "ambiguous"
  | "no-sign-change"
  | "insufficient-flows"
  | "zero-elapsed"
  | "nonconvergent"
  | "root-at-limit"
  | "short-period";

export interface XirrResult {
  rate: number | null;
  status: XirrStatus;
  message: string;
  residual?: number;
  roots?: number[];
  elapsedDays?: number;
}

const LOWER = -0.999999;
const UPPER = 100; // 10,000% annual — scan bound, flagged if a root sits here
const DAY_MS = 86400000;

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Aggregate flows that fall on the same calendar date; sort ascending by date. */
export function normalizeFlows(flows: Array<{ date: Date | string | number; amount: number }>): CashFlow[] {
  const byDay = new Map<number, number>();
  for (const f of flows) {
    const d = toDate(f.date);
    const key = Math.floor(d.getTime() / DAY_MS);
    byDay.set(key, (byDay.get(key) ?? 0) + f.amount);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, amount]) => ({ date: new Date(key * DAY_MS), amount }));
}

function npv(rate: number, flows: CashFlow[], d0: number): number {
  let sum = 0;
  for (const f of flows) {
    const years = (f.date.getTime() - d0) / (365 * DAY_MS);
    sum += f.amount / Math.pow(1 + rate, years);
  }
  return sum;
}

function bisect(flows: CashFlow[], d0: number, lo: number, hi: number, tol: number): { rate: number; residual: number } | null {
  let fLo = npv(lo, flows, d0);
  let fHi = npv(hi, flows, d0);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  let a = lo;
  let b = hi;
  for (let k = 0; k < 200; k++) {
    const mid = (a + b) / 2;
    const fMid = npv(mid, flows, d0);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) <= tol || (b - a) / 2 < 1e-10) {
      return { rate: mid, residual: fMid };
    }
    if (fLo * fMid < 0) {
      b = mid;
      fHi = fMid;
    } else {
      a = mid;
      fLo = fMid;
    }
  }
  const mid = (a + b) / 2;
  return { rate: mid, residual: npv(mid, flows, d0) };
}

export function xirr(
  input: Array<{ date: Date | string | number; amount: number }>
): XirrResult {
  const flows = normalizeFlows(input);
  if (flows.length < 2) {
    return { rate: null, status: "insufficient-flows", message: "At least two cash flows on different dates are required." };
  }
  const hasPos = flows.some((f) => f.amount > 0);
  const hasNeg = flows.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) {
    return { rate: null, status: "insufficient-flows", message: "XIRR needs at least one investment (negative) and one receipt (positive)." };
  }

  const d0 = flows[0].date.getTime();
  const dEnd = flows[flows.length - 1].date.getTime();
  const elapsedDays = Math.round((dEnd - d0) / DAY_MS);
  if (elapsedDays <= 0) {
    return { rate: null, status: "zero-elapsed", message: "All cash flows fall on the same date; a return cannot be annualised." };
  }

  // Count sign changes across the (date-ordered) amount series — conventional check.
  let signChanges = 0;
  let prevSign = 0;
  for (const f of flows) {
    const s = Math.sign(f.amount);
    if (s !== 0) {
      if (prevSign !== 0 && s !== prevSign) signChanges++;
      prevSign = s;
    }
  }

  const totalAbs = flows.reduce((acc, f) => acc + Math.abs(f.amount), 0);
  const tol = Math.max(0.01, 1e-10 * totalAbs);

  // Log-spaced scan for sign changes of NPV(r).
  const grid: number[] = [LOWER];
  const steps = 2000;
  for (let k = 0; k <= steps; k++) {
    // Map k -> rate across [LOWER, UPPER] with denser sampling near 0.
    const frac = k / steps;
    const r = LOWER + (UPPER - LOWER) * Math.pow(frac, 2.2);
    grid.push(r);
  }
  const roots: number[] = [];
  for (let k = 0; k < grid.length - 1; k++) {
    const a = grid[k];
    const b = grid[k + 1];
    const fa = npv(a, flows, d0);
    const fb = npv(b, flows, d0);
    if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb < 0) {
      const found = bisect(flows, d0, a, b, tol);
      if (found && !roots.some((r) => Math.abs(r - found.rate) < 1e-6)) {
        roots.push(found.rate);
      }
    }
  }

  if (roots.length === 0) {
    return { rate: null, status: "no-sign-change", message: "No rate solves these cash flows within the supported range.", elapsedDays };
  }

  const shortPeriod = elapsedDays < 30;

  if (roots.length > 1 || signChanges > 1) {
    return {
      rate: null,
      status: "ambiguous",
      message:
        "These cash flows have multiple sign changes, so more than one return can satisfy them. A single XIRR would be misleading.",
      roots,
      elapsedDays,
    };
  }

  const rate = roots[0];
  const residual = npv(rate, flows, d0);
  if (rate <= LOWER + 1e-6 || rate >= UPPER - 1e-6) {
    return { rate, status: "root-at-limit", message: "The solved rate sits at the edge of the supported range; treat it as unreliable.", residual, elapsedDays };
  }
  if (shortPeriod) {
    return {
      rate,
      status: "short-period",
      message: "The period is under 30 days; an annualised rate is volatile. Prefer the gain amount.",
      residual,
      elapsedDays,
    };
  }
  return { rate, status: "ok", message: "Solved within tolerance.", residual, elapsedDays };
}
