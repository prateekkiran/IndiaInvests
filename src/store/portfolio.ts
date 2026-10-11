// Derived portfolio views. These never fabricate values: an unknown price keeps
// a holding's value unknown rather than zero, and performance is gated on
// adequate coverage (PRD POR01..04, F10, F11, F13).

import { AppState, AssetClass } from "../types";
import { xirr, XirrResult } from "../engine/xirr";
import { periodInvestmentGain } from "../engine/finance";

export interface PriceLookup {
  price: number;
  date: string;
  quality: string;
}

/** Most recent price for an instrument dated no later than `asOf` (F10 precedence-aware). */
export function latestPrice(state: AppState, instrumentId: string, asOf?: string): PriceLookup | null {
  const cutoff = asOf ?? "9999-12-31";
  const order = { override: 4, package: 3, statement: 2, manual: 1 } as Record<string, number>;
  const candidates = state.prices
    .filter((p) => p.instrumentId === instrumentId && p.date <= cutoff)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (order[b.quality] ?? 0) - (order[a.quality] ?? 0)));
  if (candidates.length === 0) return null;
  const top = candidates[0];
  return { price: top.price, date: top.date, quality: top.quality };
}

export interface HoldingView {
  accountId: string;
  instrumentId: string;
  units: number;
  value: number | null; // null = unknown valuation (not zero)
  valuationDate: string | null;
  valuationBasis: string;
  priceStale: boolean;
}

const STALE_DAYS = 5;

function daysAgo(iso: string | null): number {
  if (!iso) return Infinity;
  return Math.round((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
}

/** Current holdings per account+instrument. Prefers latest dated snapshot; else rolls forward units. */
export function currentHoldings(state: AppState): HoldingView[] {
  const keys = new Map<string, { accountId: string; instrumentId: string }>();
  for (const t of state.transactions) {
    if (t.reversed) continue;
    keys.set(`${t.accountId}::${t.instrumentId}`, { accountId: t.accountId, instrumentId: t.instrumentId });
  }
  for (const s of state.snapshots) {
    keys.set(`${s.accountId}::${s.instrumentId}`, { accountId: s.accountId, instrumentId: s.instrumentId });
  }

  const views: HoldingView[] = [];
  for (const { accountId, instrumentId } of keys.values()) {
    // Latest eligible snapshot for this key, if any.
    const snaps = state.snapshots
      .filter((s) => s.accountId === accountId && s.instrumentId === instrumentId)
      .sort((a, b) => (a.valuationDate < b.valuationDate ? 1 : -1));
    const latestSnap = snaps[0];

    const rolledUnits = state.transactions
      .filter((t) => !t.reversed && t.accountId === accountId && t.instrumentId === instrumentId)
      .reduce((acc, t) => acc + (t.unitsDelta || 0), 0);

    let units: number;
    let value: number | null = null;
    let valuationDate: string | null = null;
    let valuationBasis: string;

    if (latestSnap) {
      units = latestSnap.units;
      valuationDate = latestSnap.valuationDate;
      if (latestSnap.value != null) {
        value = latestSnap.value;
        valuationBasis = "statement snapshot";
      } else if (latestSnap.nav != null) {
        value = latestSnap.units * latestSnap.nav;
        valuationBasis = "snapshot NAV";
      } else {
        const p = latestPrice(state, instrumentId, latestSnap.valuationDate);
        if (p) {
          value = latestSnap.units * p.price;
          valuationDate = p.date;
          valuationBasis = `price (${p.quality})`;
        } else {
          valuationBasis = "no price available";
        }
      }
    } else {
      units = rolledUnits;
      const p = latestPrice(state, instrumentId);
      if (p) {
        value = units * p.price;
        valuationDate = p.date;
        valuationBasis = `price (${p.quality})`;
      } else {
        valuationBasis = "no price available";
      }
    }

    views.push({
      accountId,
      instrumentId,
      units,
      value,
      valuationDate,
      valuationBasis,
      priceStale: daysAgo(valuationDate) > STALE_DAYS,
    });
  }
  return views;
}

export interface PortfolioSummary {
  valuedTotal: number;
  valuedCount: number;
  unvaluedCount: number;
  byAssetClass: Array<{ assetClass: AssetClass; value: number }>;
  valuationDateMin: string | null;
  valuationDateMax: string | null;
  anyStale: boolean;
  manualAssetsTotal: number;
  manualLiabilitiesTotal: number;
  netContributions: number | null;
  coverageNote: string;
}

export function portfolioSummary(state: AppState): PortfolioSummary {
  const holdings = currentHoldings(state);
  const instById = new Map(state.instruments.map((i) => [i.id, i]));

  let valuedTotal = 0;
  let valuedCount = 0;
  let unvaluedCount = 0;
  let dmin: string | null = null;
  let dmax: string | null = null;
  let anyStale = false;
  const classMap = new Map<AssetClass, number>();

  for (const h of holdings) {
    if (h.value == null) {
      unvaluedCount++;
      continue;
    }
    valuedCount++;
    valuedTotal += h.value;
    if (h.priceStale) anyStale = true;
    if (h.valuationDate) {
      if (!dmin || h.valuationDate < dmin) dmin = h.valuationDate;
      if (!dmax || h.valuationDate > dmax) dmax = h.valuationDate;
    }
    const cls = instById.get(h.instrumentId)?.assetClass ?? "other";
    classMap.set(cls, (classMap.get(cls) ?? 0) + h.value);
  }

  const manualAssetsTotal = state.manualAssets.reduce((a, m) => a + m.value, 0);
  const manualLiabilitiesTotal = state.manualLiabilities.reduce((a, m) => a + m.balance, 0);
  for (const m of state.manualAssets) {
    classMap.set(m.assetClass, (classMap.get(m.assetClass) ?? 0) + m.value);
    if (m.valuationDate) {
      if (!dmin || m.valuationDate < dmin) dmin = m.valuationDate;
      if (!dmax || m.valuationDate > dmax) dmax = m.valuationDate;
    }
  }

  // Net contributions over covered period: sum of investor cash flows where captured.
  const cashTxns = state.transactions.filter((t) => !t.reversed && typeof t.investorCashFlow === "number");
  const netContributions = cashTxns.length
    ? cashTxns.reduce((a, t) => a + (t.investorCashFlow as number), 0) * -1 // invested amount (positive)
    : null;

  const coverageNote =
    unvaluedCount > 0
      ? `${unvaluedCount} holding(s) have no available price and are excluded from the valued total.`
      : holdings.length === 0 && state.manualAssets.length === 0
        ? "No holdings yet."
        : "All current holdings have a valuation.";

  return {
    valuedTotal: valuedTotal + manualAssetsTotal,
    valuedCount,
    unvaluedCount,
    byAssetClass: [...classMap.entries()]
      .map(([assetClass, value]) => ({ assetClass, value }))
      .sort((a, b) => b.value - a.value),
    valuationDateMin: dmin,
    valuationDateMax: dmax,
    anyStale,
    manualAssetsTotal,
    manualLiabilitiesTotal,
    netContributions,
    coverageNote,
  };
}

export interface PerformanceResult {
  available: boolean;
  reason?: string;
  xirr?: XirrResult;
  periodGain?: number;
  invested?: number;
  currentValue?: number;
  note?: string;
}

/**
 * Portfolio performance. Only reported when transaction cash flows and a
 * terminal valuation exist; otherwise "Performance unavailable" with a reason.
 */
export function portfolioPerformance(state: AppState): PerformanceResult {
  const cashTxns = state.transactions.filter(
    (t) => !t.reversed && typeof t.investorCashFlow === "number" && (t.investorCashFlow as number) !== 0
  );
  if (cashTxns.length === 0) {
    return {
      available: false,
      reason:
        "Performance unavailable — this portfolio has holdings/valuations but no dated transaction cash flows. Import a detailed statement to compute since-inception returns.",
    };
  }

  // Only measure instruments whose investor cash flows we actually hold. A
  // holdings-only position (snapshot with no purchase transaction) must NOT be
  // folded into the terminal value, or its value would masquerade as a gain
  // with no matching cost (PRD POR01/POR04).
  const flowInstruments = new Set(cashTxns.map((t) => t.instrumentId));
  const scoped = currentHoldings(state).filter((h) => flowInstruments.has(h.instrumentId));
  const valued = scoped.filter((h) => h.value != null);
  const unpriced = scoped.filter((h) => h.value == null);

  if (valued.length === 0) {
    return {
      available: false,
      reason:
        "Performance unavailable — the holdings linked to your transactions have no current price. Add a price (Import → Prices) to value them.",
    };
  }

  let valuationDateMax: string | null = null;
  for (const h of valued) {
    if (h.valuationDate && (!valuationDateMax || h.valuationDate > valuationDateMax)) {
      valuationDateMax = h.valuationDate;
    }
  }
  if (!valuationDateMax) {
    return { available: false, reason: "Performance unavailable — missing a terminal valuation date." };
  }

  const currentValue = valued.reduce((a, h) => a + (h.value as number), 0);
  const flows = cashTxns.map((t) => ({ date: t.eventDate, amount: t.investorCashFlow as number }));
  flows.push({ date: valuationDateMax, amount: currentValue });

  const x = xirr(flows);
  const invested = cashTxns.reduce((a, t) => a + (t.investorCashFlow as number), 0) * -1;
  const gain = periodInvestmentGain(currentValue, 0, invested, 0);

  return {
    available: true,
    xirr: x,
    periodGain: gain,
    invested,
    currentValue,
    note: unpriced.length
      ? `${unpriced.length} holding(s) linked to your transactions are unpriced and were excluded from this return.`
      : undefined,
  };
}
