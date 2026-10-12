// GOAL04 — Household & life-event planning via a single sequential cash-flow
// simulation. This REPLACES the per-goal independent sums (store/goals.ts
// computeGoal) whenever a shared monthly budget funds more than one goal: a
// rupee of budget is spent exactly once, in priority order, and each goal is
// "withdrawn" exactly once at its target month. Independent planning silently
// lets the same rupee fund several goals at once; this engine shows the gap.
//
// Conventions reuse the deterministic engine (finance.ts): end-of-month
// contributions, annual-effective → monthly rate (F01), and the F08
// required-SIP closed form to size each month's ask. Life events are dated net
// cash flows; a spending event competes with saving and is paid BEFORE goal
// contributions, so an unaffordable month surfaces as an unmet expense rather
// than silently shrinking a goal.

import { monthlyRateFromAnnual, requiredEndMonthSIP, stepUpContribution, MONTHS_PER_YEAR } from "./finance";

export interface HouseholdGoalInput {
  id: string;
  label: string;
  priority: number;
  targetMonth: number; // whole months from today (>= 0)
  futureTarget: number; // nominal rupees at the target month
  openingBalance: number; // allocated present value already earmarked
  annualReturn: number;
  /** Dedicated monthly contribution already attached to THIS goal (not shared). */
  dedicatedMonthly?: number;
  dedicatedStepUp?: number;
}

export interface HouseholdEventInput {
  id: string;
  label: string;
  month: number; // whole months from today (>= 1)
  amount: number; // signed: +income, -expense
}

export interface HouseholdSimInput {
  goals: HouseholdGoalInput[];
  monthlyBudget: number;
  annualStepUp: number;
  events: HouseholdEventInput[];
  unassignedPool?: number; // assets not earmarked to any goal
}

export interface HouseholdGoalResult {
  id: string;
  label: string;
  priority: number;
  targetMonth: number;
  futureTarget: number;
  funded: number;
  shortfall: number;
  fundedPct: number;
  sharedContributed: number;
  dedicatedContributed: number;
  /** Funded amount under INDEPENDENT planning (each goal sized on its own). */
  independentFunded: number;
}

export interface HouseholdResult {
  horizonMonths: number;
  goals: HouseholdGoalResult[];
  firstMonthRequiredTotal: number;
  monthlyBudget: number;
  overcommitted: boolean;
  overcommitBy: number;
  totalUnmetExpense: number;
  endingPool: number;
  /** True when any goal is funded less under sharing than it looked independently. */
  sharingReducesAnyGoal: boolean;
}

function dedicatedAt(g: HouseholdGoalInput, month1Based: number): number {
  const base = g.dedicatedMonthly ?? 0;
  if (base <= 0) return 0;
  return stepUpContribution(base, g.dedicatedStepUp ?? 0, month1Based);
}

/** Independent funded value for one goal (opening + dedicated streams only, grown to target). */
function independentFunded(g: HouseholdGoalInput): number {
  const i = monthlyRateFromAnnual(g.annualReturn);
  let bal = g.openingBalance;
  for (let t = 1; t <= g.targetMonth; t++) {
    bal = bal * (1 + i) + dedicatedAt(g, t);
  }
  return bal;
}

export function simulateHousehold(input: HouseholdSimInput): HouseholdResult {
  const order = [...input.goals].sort((a, b) => a.priority - b.priority || a.targetMonth - b.targetMonth);
  const horizon = input.goals.reduce((m, g) => Math.max(m, g.targetMonth), 0);

  const rate = new Map(order.map((g) => [g.id, monthlyRateFromAnnual(g.annualReturn)]));
  const bal = new Map(order.map((g) => [g.id, g.openingBalance]));
  const shared = new Map(order.map((g) => [g.id, 0]));
  const dedicated = new Map(order.map((g) => [g.id, 0]));
  const matured = new Map<string, HouseholdGoalResult>();

  let pool = input.unassignedPool ?? 0;
  let totalUnmetExpense = 0;

  const eventsByMonth = new Map<number, number>();
  for (const e of input.events) eventsByMonth.set(e.month, (eventsByMonth.get(e.month) ?? 0) + e.amount);

  // First-month required total (for the overcommitment warning), before any funding.
  let firstMonthRequiredTotal = 0;
  for (const g of order) {
    if (g.targetMonth <= 0) continue;
    const need = requiredEndMonthSIP(g.futureTarget, g.openingBalance, rate.get(g.id)!, g.targetMonth).requiredContribution;
    firstMonthRequiredTotal += Math.max(0, need - dedicatedAt(g, 1));
  }

  // Goals already at/!past target (targetMonth 0) mature immediately.
  for (const g of order) {
    if (g.targetMonth <= 0 && !matured.has(g.id)) {
      const funded = bal.get(g.id)!;
      matured.set(g.id, makeResult(g, funded, 0, 0));
    }
  }

  for (let t = 1; t <= horizon; t++) {
    const stepFactor = Math.pow(1 + input.annualStepUp, Math.floor((t - 1) / MONTHS_PER_YEAR));
    const budget = input.monthlyBudget * stepFactor;
    const ev = eventsByMonth.get(t) ?? 0;
    let avail = budget + Math.max(0, ev) + pool;
    pool = 0;

    // Spending events are obligations — paid before saving.
    const expense = Math.max(0, -ev);
    if (expense <= avail) {
      avail -= expense;
    } else {
      totalUnmetExpense += expense - avail;
      avail = 0;
    }

    const allocThis = new Map<string, number>();
    for (const g of order) {
      if (matured.has(g.id) || t > g.targetMonth) continue;
      const R = g.targetMonth - (t - 1);
      const need = requiredEndMonthSIP(g.futureTarget, bal.get(g.id)!, rate.get(g.id)!, R).requiredContribution;
      const ded = dedicatedAt(g, t);
      const ask = Math.max(0, need - ded);
      const alloc = Math.min(ask, avail);
      avail -= alloc;
      allocThis.set(g.id, alloc);
      shared.set(g.id, shared.get(g.id)! + alloc);
      dedicated.set(g.id, dedicated.get(g.id)! + ded);
    }

    // End-of-month growth + contributions.
    for (const g of order) {
      if (matured.has(g.id) || t > g.targetMonth) continue;
      const i = rate.get(g.id)!;
      const ded = dedicatedAt(g, t);
      bal.set(g.id, bal.get(g.id)! * (1 + i) + ded + (allocThis.get(g.id) ?? 0));
    }

    pool += avail; // unspent budget is saved into the shared pool

    // Mature goals whose target month is now.
    for (const g of order) {
      if (!matured.has(g.id) && t === g.targetMonth) {
        const funded = bal.get(g.id)!;
        const surplus = Math.max(0, funded - g.futureTarget);
        if (surplus > 0) pool += surplus;
        matured.set(g.id, makeResult(g, funded, shared.get(g.id)!, dedicated.get(g.id)!));
      }
    }
  }

  const goals = order.map((g) => matured.get(g.id) ?? makeResult(g, bal.get(g.id)!, shared.get(g.id)!, dedicated.get(g.id)!));
  const sharingReducesAnyGoal = goals.some((r) => r.funded < r.independentFunded - 1);

  return {
    horizonMonths: horizon,
    goals,
    firstMonthRequiredTotal,
    monthlyBudget: input.monthlyBudget,
    overcommitted: firstMonthRequiredTotal > input.monthlyBudget + 1e-6,
    overcommitBy: Math.max(0, firstMonthRequiredTotal - input.monthlyBudget),
    totalUnmetExpense,
    endingPool: pool,
    sharingReducesAnyGoal,
  };

  function makeResult(g: HouseholdGoalInput, funded: number, sharedTot: number, dedTot: number): HouseholdGoalResult {
    const shortfall = Math.max(0, g.futureTarget - funded);
    return {
      id: g.id,
      label: g.label,
      priority: g.priority,
      targetMonth: g.targetMonth,
      futureTarget: g.futureTarget,
      funded,
      shortfall,
      fundedPct: g.futureTarget > 0 ? funded / g.futureTarget : 1,
      sharedContributed: sharedTot,
      dedicatedContributed: dedTot,
      independentFunded: independentFunded(g),
    };
  }
}
