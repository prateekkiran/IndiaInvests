// Goal planning math (PRD GOAL01..03, F06..F08, F12). A global allocation ledger
// prevents an asset being counted toward more than 100% across goals.

import { AppState, Goal } from "../types";
import { currentHoldings } from "./portfolio";
import {
  futureGoalValue,
  lumpSumFV,
  monthlyRateFromAnnual,
  projectedFinalValue,
  realValue,
  fundingRatio as f12,
} from "../engine/finance";
import { monthsBetween, todayISO } from "../util";

export interface AssetRefValue {
  ref: string;
  label: string;
  value: number;
}

/** All allocatable assets with their current value: manual assets + valued holdings. */
export function allocatableAssets(state: AppState): AssetRefValue[] {
  const out: AssetRefValue[] = [];
  for (const m of state.manualAssets) {
    out.push({ ref: m.id, label: `${m.label} (manual)`, value: m.value });
  }
  const instById = new Map(state.instruments.map((i) => [i.id, i]));
  const acctById = new Map(state.accounts.map((a) => [a.id, a]));
  for (const h of currentHoldings(state)) {
    if (h.value == null) continue;
    const inst = instById.get(h.instrumentId);
    const acct = acctById.get(h.accountId);
    out.push({
      ref: `${h.accountId}::${h.instrumentId}`,
      label: `${inst?.name ?? "Instrument"} · ${acct?.maskedNumber ?? ""}`.trim(),
      value: h.value,
    });
  }
  return out;
}

export function assetValueMap(state: AppState): Map<string, number> {
  return new Map(allocatableAssets(state).map((a) => [a.ref, a.value]));
}

export interface LedgerEntry {
  ref: string;
  totalFraction: number;
  overAllocated: boolean;
}

/** Sum of fractions allocated per asset across all goals; flags > 100%. */
export function allocationLedger(state: AppState): Map<string, LedgerEntry> {
  const ledger = new Map<string, LedgerEntry>();
  for (const g of state.goals) {
    for (const al of g.allocations) {
      const prev = ledger.get(al.assetRef) ?? { ref: al.assetRef, totalFraction: 0, overAllocated: false };
      prev.totalFraction += al.fraction;
      prev.overAllocated = prev.totalFraction > 1 + 1e-9;
      ledger.set(al.assetRef, prev);
    }
  }
  return ledger;
}

/**
 * Would adding/changing an allocation push an asset over 100%?
 * Returns the resulting total fraction for that asset (excluding the goal's own
 * prior allocation to it, which is being replaced).
 */
export function allocationAfterChange(
  state: AppState,
  goalId: string,
  assetRef: string,
  newFraction: number
): number {
  let total = newFraction;
  for (const g of state.goals) {
    for (const al of g.allocations) {
      if (al.assetRef !== assetRef) continue;
      if (g.id === goalId) continue; // replacing this goal's own allocation
      total += al.fraction;
    }
  }
  return total;
}

export interface GoalComputation {
  months: number;
  futureTarget: number;
  allocatedPresentValue: number;
  projectedValue: number;
  projectedValueReal: number;
  fundingRatio: number;
  shortfallFuture: number;
  monthlyContribution: number;
}

export function computeGoal(state: AppState, goal: Goal): GoalComputation {
  const today = todayISO();
  const months = monthsBetween(today, goal.targetDate);
  const futureTarget =
    goal.amountBasis === "today" ? futureGoalValue(goal.amount, goal.annualInflation, months) : goal.amount;

  const values = assetValueMap(state);
  const allocatedPresentValue = goal.allocations.reduce(
    (acc, al) => acc + (values.get(al.assetRef) ?? 0) * al.fraction,
    0
  );

  const i = monthlyRateFromAnnual(goal.annualReturn);

  // Linked contribution streams, projected via the engine (supports step-up/timing).
  const streams = state.contributionStreams.filter((s) => goal.contributionStreamIds.includes(s.id));
  let streamFV = 0;
  let monthlyContribution = 0;
  for (const s of streams) {
    monthlyContribution += s.monthlyAmount;
    streamFV += projectedFinalValue({
      openingBalance: 0,
      months,
      monthlyRate: i,
      baseContribution: s.monthlyAmount,
      timing: s.timing,
      annualStepUp: s.annualStepUp,
    });
  }

  const grownExisting = lumpSumFV(allocatedPresentValue, i, months);
  const projectedValue = grownExisting + streamFV;
  const projectedValueReal = realValue(projectedValue, goal.annualInflation, months);
  const ratio = futureTarget > 0 ? f12(projectedValue, futureTarget) : 0;
  const shortfallFuture = Math.max(0, futureTarget - projectedValue);

  return {
    months,
    futureTarget,
    allocatedPresentValue,
    projectedValue,
    projectedValueReal,
    fundingRatio: ratio,
    shortfallFuture,
    monthlyContribution,
  };
}
