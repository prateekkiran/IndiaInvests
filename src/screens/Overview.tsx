import React from "react";
import { useApp } from "../store/AppContext";
import { portfolioSummary, portfolioPerformance } from "../store/portfolio";
import { computeGoal } from "../store/goals";
import { AllocationBars } from "../components/Charts";
import { PageHead, Card, Stat, Button, Badge, Callout } from "../components/ui";
import { formatINR, formatINRCompact, formatPercent } from "../engine/money";
import { fmtDate } from "../util";
import { AssetClass } from "../types";

const CLASS_LABEL: Record<AssetClass, string> = {
  equity_mf: "Equity funds", debt_mf: "Debt funds", hybrid_mf: "Hybrid funds", other_mf: "Other funds",
  cash: "Cash", fd_rd: "FD / RD", epf: "EPF", ppf: "PPF", nps: "NPS", gold: "Gold", property: "Property", other: "Other",
};

export function Overview({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { state, vaultStatus } = useApp();
  const summary = portfolioSummary(state);
  const perf = portfolioPerformance(state);
  const hasData = state.transactions.length > 0 || state.snapshots.length > 0 || state.manualAssets.length > 0;
  const netWorth = summary.valuedTotal - summary.manualLiabilitiesTotal;

  if (!hasData) {
    return (
      <div>
        <PageHead title={`Welcome${state.owners[0] ? ", " + state.owners[0].label : ""}`}>
          See what you own, understand what the evidence supports, and explore how today's decisions could affect future goals. Everything runs on your device — nothing is uploaded, and no market data is fetched automatically.
        </PageHead>
        <div className="grid cols-3">
          <Card>
            <div style={{ fontSize: "1.6rem" }}>∑</div>
            <h3>Try a calculator</h3>
            <p className="soft">Plan a SIP, lump sum or goal in under a minute. No sign-up, no statement.</p>
            <Button variant="primary" onClick={() => onNavigate("calculators")}>Open calculators</Button>
          </Card>
          <Card>
            <div style={{ fontSize: "1.6rem" }}>▤</div>
            <h3>Import my portfolio</h3>
            <p className="soft">Bring in a CSV or a CAMS/KFintech statement. You download the file yourself — we never ask for provider logins.</p>
            <Button onClick={() => onNavigate("portfolio")}>Go to portfolio</Button>
          </Card>
          <Card>
            <div style={{ fontSize: "1.6rem" }}>◇</div>
            <h3>Build a goal</h3>
            <p className="soft">Turn an amount into a realistic plan with inflation and your own return assumptions.</p>
            <Button onClick={() => onNavigate("goals")}>Plan a goal</Button>
          </Card>
        </div>
        <div style={{ marginTop: 16 }}>
          <Callout tone="info">
            {vaultStatus === "none"
              ? "Your data will be saved only when you create a local vault (Settings → Storage). Calculators work without one."
              : "A local encrypted vault is active on this device. Keep an encrypted backup — browser storage can be cleared."}
          </Callout>
        </div>
      </div>
    );
  }

  const alloc = summary.byAssetClass.map((a) => ({ label: CLASS_LABEL[a.assetClass], value: a.value }));
  const goalsWithCalc = state.goals.map((g) => ({ goal: g, calc: computeGoal(state, g) }));

  return (
    <div>
      <PageHead title="Overview" />

      {/* Data-health strip */}
      {(summary.unvaluedCount > 0 || summary.anyStale) && (
        <div className="data-health" style={{ marginBottom: 16 }}>
          <Callout tone="warn">
            {summary.unvaluedCount > 0 && <div>{summary.coverageNote}</div>}
            {summary.anyStale && <div>Some prices are older than 5 business days — values may be stale. <Button variant="ghost" size="sm" onClick={() => onNavigate("data")}>Review in Data centre</Button></div>}
          </Callout>
        </div>
      )}

      <div className="grid cols-3">
        <Card><Stat label="Valued assets" value={formatINR(summary.valuedTotal)} sub={<span>Latest recorded values{summary.valuationDateMin ? ` · ${fmtDate(summary.valuationDateMin)} – ${fmtDate(summary.valuationDateMax)}` : ""}</span>} /></Card>
        <Card><Stat label="Liabilities" value={formatINR(summary.manualLiabilitiesTotal)} sub="Loans & other debts (manual)" /></Card>
        <Card><Stat label="Net worth" value={formatINR(netWorth)} sub="Assets − liabilities" /></Card>
      </div>

      {summary.valuationDateMin && summary.valuationDateMin !== summary.valuationDateMax && (
        <div style={{ marginTop: 12 }}>
          <Callout tone="info">These totals combine values recorded on different dates ({fmtDate(summary.valuationDateMin)} – {fmtDate(summary.valuationDateMax)}). They are “latest recorded values”, not a single point-in-time “portfolio today”.</Callout>
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: 16, alignItems: "start" }}>
        <Card>
          <h3>Asset allocation</h3>
          <AllocationBars title="By asset class" data={alloc} />
        </Card>

        <Card>
          <h3>Returns</h3>
          {perf.available && perf.xirr ? (
            perf.xirr.status === "ok" ? (
              <>
                <Stat label="Portfolio XIRR (since inception)" value={formatPercent(perf.xirr.rate!)} sub={`Invested ${formatINRCompact(perf.invested!)} · now ${formatINRCompact(perf.currentValue!)}`} />
                <div style={{ marginTop: 8 }}><Badge tone="teal">Based on {state.transactions.filter((t) => typeof t.investorCashFlow === "number").length} cash flows</Badge></div>
                {perf.note && <div style={{ marginTop: 8 }}><Callout tone="warn">{perf.note}</Callout></div>}
              </>
            ) : (
              <Callout tone="warn">XIRR not shown: {perf.xirr.message}</Callout>
            )
          ) : (
            <Callout tone="info">{perf.reason}</Callout>
          )}
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: 12 }}>A holdings-only portfolio shows value and allocation, not since-inception returns — those need dated transaction history.</p>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Goals</h3>
          <Button size="sm" onClick={() => onNavigate("goals")}>Manage goals</Button>
        </div>
        {goalsWithCalc.length === 0 ? (
          <Card><p className="soft" style={{ margin: 0 }}>No goals yet. <Button variant="ghost" size="sm" onClick={() => onNavigate("goals")}>Create one →</Button></p></Card>
        ) : (
          <div className="grid cols-3">
            {goalsWithCalc.map(({ goal, calc }) => {
              const pct = Math.min(100, Math.round(calc.fundingRatio * 100));
              const tone = pct >= 100 ? "green" : pct >= 60 ? "teal" : "amber";
              return (
                <Card key={goal.id}>
                  <div className="row between"><strong>{goal.label}</strong><Badge tone={tone as any}>{pct}% funded</Badge></div>
                  <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 6, overflow: "hidden", margin: "10px 0" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--green-600)" : "var(--indigo-600)" }} />
                  </div>
                  <div className="stat-sub">Target {formatINRCompact(calc.futureTarget)} by {fmtDate(goal.targetDate)}</div>
                  {calc.shortfallFuture > 0 && <div className="stat-sub" style={{ color: "var(--amber-600)" }}>Shortfall {formatINRCompact(calc.shortfallFuture)}</div>}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
