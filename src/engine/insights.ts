// Auto-insights — plain-language observations derived strictly from the user's
// own data. Every insight is factual and traceable to a figure already shown
// elsewhere; none give advice or recommend products (PRD advice posture). They
// turn the dashboard from a passive display into something that *notices*.

import { AppState, AssetClass } from "../types";
import { portfolioSummary } from "../store/portfolio";
import { computeGoal } from "../store/goals";
import { formatINRCompact, formatPercent } from "./money";

export type InsightTone = "neutral" | "good" | "watch";

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

const CLASS_LABEL: Record<AssetClass, string> = {
  equity_mf: "equity funds", debt_mf: "debt funds", hybrid_mf: "hybrid funds", other_mf: "funds",
  cash: "cash", fd_rd: "FD/RD", epf: "EPF", ppf: "PPF", nps: "NPS", gold: "gold", property: "property", other: "other assets",
};

const EQUITY_CLASSES = new Set<AssetClass>(["equity_mf"]);

export function buildInsights(state: AppState): Insight[] {
  const out: Insight[] = [];
  const s = portfolioSummary(state);
  const valued = s.valuedTotal;

  // 1. Largest allocation / concentration.
  if (valued > 0 && s.byAssetClass.length > 0) {
    const top = s.byAssetClass[0];
    const share = top.value / valued;
    out.push({
      id: "concentration",
      tone: share > 0.7 ? "watch" : "neutral",
      text: `${CLASS_LABEL[top.assetClass]} make up ${formatPercent(share)} of your ${formatINRCompact(valued)} in valued assets${share > 0.7 ? " — a concentrated position worth being aware of." : "."}`,
    });
  }

  // 2. Equity vs defensive split (only when both sides exist).
  if (valued > 0) {
    const equity = s.byAssetClass.filter((a) => EQUITY_CLASSES.has(a.assetClass)).reduce((x, a) => x + a.value, 0);
    if (equity > 0 && equity < valued) {
      out.push({
        id: "equity-split",
        tone: "neutral",
        text: `Your mix is ${formatPercent(equity / valued)} equity and ${formatPercent(1 - equity / valued)} non-equity by value.`,
      });
    }
  }

  // 3. Liabilities vs assets.
  if (s.manualLiabilitiesTotal > 0 && valued > 0) {
    out.push({
      id: "leverage",
      tone: s.manualLiabilitiesTotal > valued * 0.5 ? "watch" : "neutral",
      text: `Liabilities of ${formatINRCompact(s.manualLiabilitiesTotal)} are ${formatPercent(s.manualLiabilitiesTotal / valued)} of your valued assets.`,
    });
  }

  // 4. Stale / unpriced coverage.
  if (s.unvaluedCount > 0) {
    out.push({ id: "unpriced", tone: "watch", text: `${s.unvaluedCount} holding(s) have no current price and are excluded from your valued total — import a NAV to value them.` });
  }
  if (s.anyStale) {
    out.push({ id: "stale", tone: "watch", text: "Some prices are older than 5 business days, so a few values may be stale." });
  }

  // 5. Goal pace — on track vs behind.
  const goalCalcs = state.goals.map((g) => ({ g, c: computeGoal(state, g) }));
  const funded = goalCalcs.filter((x) => x.c.fundingRatio >= 1);
  const behind = goalCalcs.filter((x) => x.c.fundingRatio < 0.6);
  for (const f of funded.slice(0, 1)) {
    out.push({ id: `goal-ok-${f.g.id}`, tone: "good", text: `“${f.g.label}” is on track — projected to reach ${formatPercent(f.c.fundingRatio)} of its target.` });
  }
  for (const b of behind.slice(0, 2)) {
    out.push({ id: `goal-behind-${b.g.id}`, tone: "watch", text: `“${b.g.label}” is pacing at ${formatPercent(b.c.fundingRatio)} of target — a shortfall of about ${formatINRCompact(b.c.shortfallFuture)} at today's assumptions.` });
  }

  // 6. Household over-commitment, if a plan exists.
  if (state.household && state.household.monthlyBudget > 0 && state.goals.length > 1) {
    out.push({ id: "household", tone: "neutral", text: `You're planning ${state.goals.length} goals against one shared budget of ${formatINRCompact(state.household.monthlyBudget)}/month — see Household for the priority-ordered result.` });
  }

  return out;
}
