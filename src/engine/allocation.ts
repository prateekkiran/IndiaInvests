// Allocation drift & rebalance lens — pure arithmetic over the current asset
// mix against a user-chosen target. This is deliberately NOT advice: the user
// sets the target, and we report the factual gap and the rupee moves that would
// close it. No "ideal" allocation is suggested, nothing is scored, and no tax
// or cost of switching is implied (consistent with the app's educational,
// no-advice posture).
//
// Targets are supplied as raw weights (any non-negative numbers — e.g. slider
// percentages). We normalise by their sum so they need not add to exactly 100.
// Only currently-held asset classes participate; a target for a class you don't
// hold is ignored by design (this lens models reshaping what you already hold).

export interface DriftRow {
  assetClass: string;
  value: number;
  currentFraction: number;
  targetFraction: number;
  driftPp: number; // (current − target) in percentage points; +ve = overweight
  deltaRupees: number; // target value − current value; +ve = buy, −ve = trim
}

export interface DriftResult {
  total: number;
  rows: DriftRow[];
  turnover: number; // sum of buys (= sum of trims in magnitude); the one-way rebalance size
  hasTargets: boolean;
  maxAbsDriftPp: number;
}

export function allocationDrift(
  current: Array<{ assetClass: string; value: number }>,
  weights: Record<string, number>
): DriftResult {
  const total = current.reduce((a, c) => a + (c.value > 0 ? c.value : 0), 0);
  // Only weights for classes actually held participate in the normalising sum —
  // a target for a class you don't hold is ignored by design (this lens reshapes
  // what you already hold). Summing unheld weights too would shrink every held
  // class's target fraction and leak a phantom allocation into the book.
  const heldClasses = new Set(current.map((c) => c.assetClass));
  const wsum = Object.entries(weights).reduce((a, [k, b]) => a + (heldClasses.has(k) && b > 0 ? b : 0), 0);
  const hasTargets = wsum > 0 && total > 0;

  const rows: DriftRow[] = current.map((c) => {
    const currentFraction = total > 0 ? c.value / total : 0;
    const rawW = weights[c.assetClass];
    const targetFraction = hasTargets ? (rawW && rawW > 0 ? rawW : 0) / wsum : currentFraction;
    const deltaRupees = targetFraction * total - c.value;
    return {
      assetClass: c.assetClass,
      value: c.value,
      currentFraction,
      targetFraction,
      driftPp: (currentFraction - targetFraction) * 100,
      deltaRupees,
    };
  });

  const turnover = rows.reduce((a, r) => a + (r.deltaRupees > 0 ? r.deltaRupees : 0), 0);
  const maxAbsDriftPp = rows.reduce((a, r) => Math.max(a, Math.abs(r.driftPp)), 0);

  return { total, rows, turnover, hasTargets, maxAbsDriftPp };
}
