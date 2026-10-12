import React, { useLayoutEffect, useRef } from "react";
import { useApp } from "../store/AppContext";
import { portfolioSummary, portfolioPerformance } from "../store/portfolio";
import { computeGoal } from "../store/goals";
import { AllocationBars } from "../components/Charts";
import { PageHead, Card, Stat, Button, Badge, Callout } from "../components/ui";
import { formatINR, formatINRCompact, formatPercent } from "../engine/money";
import { fmtDate } from "../util";
import { AssetClass } from "../types";
import { CountUp, Reveal, AnimatedBar } from "../anim/components";
import { floatLoop, popIn, revealStagger, prefersReduced } from "../anim/motion";
import { DemoTip } from "../demo/DemoUI";
import { buildInsights } from "../engine/insights";
import { Icon } from "../components/Icon";

const CLASS_LABEL: Record<AssetClass, string> = {
  equity_mf: "Equity funds", debt_mf: "Debt funds", hybrid_mf: "Hybrid funds", other_mf: "Other funds",
  cash: "Cash", fd_rd: "FD / RD", epf: "EPF", ppf: "PPF", nps: "NPS", gold: "Gold", property: "Property", other: "Other",
};

function Hero({ onNavigate, name }: { onNavigate: (r: string) => void; name?: string }) {
  const s1 = useRef<HTMLDivElement | null>(null);
  const s2 = useRef<HTMLDivElement | null>(null);
  const s3 = useRef<HTMLDivElement | null>(null);
  const mark = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const cancels: Array<() => void> = [];
    cancels.push(popIn(mark.current, { from: 0.6, duration: 700 }));
    cancels.push(floatLoop(s1.current, { y: 22, x: 10, duration: 5200 }));
    cancels.push(floatLoop(s2.current, { y: 16, x: -14, duration: 6100, delay: 400 }));
    cancels.push(floatLoop(s3.current, { y: 26, x: 8, duration: 4700, delay: 800 }));
    if (cardsRef.current) cancels.push(revealStagger(cardsRef.current.querySelectorAll(".card"), { each: 120, y: 26, start: 250 }));
    return () => cancels.forEach((c) => c && c());
  }, []);

  return (
    <div>
      <div className="hero">
        <div className="hero-blob b1" ref={s1} />
        <div className="hero-blob b2" ref={s2} />
        <div className="hero-blob b3" ref={s3} />
        <div className="hero-inner">
          <div className="hero-mark" ref={mark} aria-hidden />
          <h1 className="hero-title">{name ? `Welcome, ${name}` : "Welcome"}</h1>
          <p className="hero-sub">
            See what you own, understand what the evidence supports, and explore how today's decisions
            could affect future goals. Everything runs on your device — nothing is uploaded.
          </p>
        </div>
      </div>

      <div className="grid cols-3" ref={cardsRef} style={{ marginTop: 20 }}>
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
    </div>
  );
}

export function Overview({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { state, vaultStatus, loadDemo } = useApp();
  const summary = portfolioSummary(state);
  const perf = portfolioPerformance(state);
  const hasData = state.transactions.length > 0 || state.snapshots.length > 0 || state.manualAssets.length > 0;
  const netWorth = summary.valuedTotal - summary.manualLiabilitiesTotal;

  if (!hasData) {
    return (
      <div>
        <Hero onNavigate={onNavigate} name={state.owners[0]?.label} />
        <div style={{ marginTop: 16 }}>
          <Card style={{ background: "var(--indigo-100)", borderColor: "transparent" }}>
            <div className="row between" style={{ gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ margin: "0 0 4px" }}>New here? Take a guided tour</h3>
                <p className="soft" style={{ margin: 0 }}>Load a complete fictional account — portfolio, goals, household plan, value history and saved scenarios — to see every feature with realistic data. Nothing is saved to your device, and you can exit anytime.</p>
              </div>
              <Button variant="primary" onClick={loadDemo}>Load demo account</Button>
            </div>
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
  const insights = buildInsights(state);

  return (
    <div>
      <PageHead title="Overview" />
      <DemoTip id="overview" title="This is your financial home base">
        Net worth, asset allocation, since-inception XIRR and goal progress — all derived from the demo transactions. Open <strong>Portfolio → Value history</strong> to see actual value over time, or <strong>Household</strong> to see goals planned against one shared budget.
      </DemoTip>

      {(summary.unvaluedCount > 0 || summary.anyStale) && (
        <div className="data-health" style={{ marginBottom: 16 }}>
          <Callout tone="warn">
            {summary.unvaluedCount > 0 && <div>{summary.coverageNote}</div>}
            {summary.anyStale && <div>Some prices are older than 5 business days — values may be stale. <Button variant="ghost" size="sm" onClick={() => onNavigate("data")}>Review in Data centre</Button></div>}
          </Callout>
        </div>
      )}

      <div className="grid cols-3">
        <Reveal delay={0}><Card><Stat label="Valued assets" value={<CountUp value={summary.valuedTotal} format={formatINR} />} sub={<span>Latest recorded values{summary.valuationDateMin ? ` · ${fmtDate(summary.valuationDateMin)} – ${fmtDate(summary.valuationDateMax)}` : ""}</span>} /></Card></Reveal>
        <Reveal delay={90}><Card><Stat label="Liabilities" value={<CountUp value={summary.manualLiabilitiesTotal} format={formatINR} />} sub="Loans & other debts (manual)" /></Card></Reveal>
        <Reveal delay={180}><Card><Stat label="Net worth" value={<CountUp value={netWorth} format={formatINR} />} sub="Assets − liabilities" /></Card></Reveal>
      </div>

      {summary.valuationDateMin && summary.valuationDateMin !== summary.valuationDateMax && (
        <div style={{ marginTop: 12 }}>
          <Callout tone="info">These totals combine values recorded on different dates ({fmtDate(summary.valuationDateMin)} – {fmtDate(summary.valuationDateMax)}). They are “latest recorded values”, not a single point-in-time “portfolio today”.</Callout>
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: 16, alignItems: "start" }}>
        <Reveal delay={120}>
          <Card>
            <h3>Asset allocation</h3>
            <AllocationBars title="By asset class" data={alloc} />
          </Card>
        </Reveal>

        <Reveal delay={200}>
          <Card>
            <h3>Returns</h3>
            {perf.available && perf.xirr ? (
              perf.xirr.status === "ok" ? (
                <>
                  <Stat label="Portfolio XIRR (since inception)" value={<CountUp value={perf.xirr.rate! * 100} duration={1300} format={(v) => `${v.toFixed(2)}%`} />} sub={`Invested ${formatINRCompact(perf.invested!)} · now ${formatINRCompact(perf.currentValue!)}`} />
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
        </Reveal>
      </div>

      {insights.length > 0 && (
        <Reveal delay={60}>
          <Card style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 8, marginBottom: 10, alignItems: "center" }}>
              <span style={{ color: "var(--indigo-600)", display: "inline-flex" }}><Icon name="sparkle" size={18} /></span>
              <h3 style={{ margin: 0 }}>Insights</h3>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {insights.map((ins) => (
                <div key={ins.id} className="insight-row">
                  <span className={`insight-dot ${ins.tone}`} aria-hidden />
                  <span style={{ fontSize: "0.9rem" }}>{ins.text}</span>
                </div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: "0.76rem", marginTop: 10 }}>Observations from your own data — factual, not advice.</p>
          </Card>
        </Reveal>
      )}

      <div style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Goals</h3>
          <Button size="sm" onClick={() => onNavigate("goals")}>Manage goals</Button>
        </div>
        {goalsWithCalc.length === 0 ? (
          <Card><p className="soft" style={{ margin: 0 }}>No goals yet. <Button variant="ghost" size="sm" onClick={() => onNavigate("goals")}>Create one →</Button></p></Card>
        ) : (
          <div className="grid cols-3">
            {goalsWithCalc.map(({ goal, calc }, i) => {
              const pct = Math.min(100, Math.round(calc.fundingRatio * 100));
              const tone = pct >= 100 ? "green" : pct >= 60 ? "teal" : "amber";
              return (
                <Reveal key={goal.id} delay={i * 90}>
                  <Card>
                    <div className="row between"><strong>{goal.label}</strong><Badge tone={tone as any}>{pct}% funded</Badge></div>
                    <div style={{ margin: "10px 0" }}>
                      <AnimatedBar pct={pct} color={pct >= 100 ? "var(--green-600)" : "var(--indigo-600)"} delay={i * 90 + 200} />
                    </div>
                    <div className="stat-sub">Target {formatINRCompact(calc.futureTarget)} by {fmtDate(goal.targetDate)}</div>
                    {calc.shortfallFuture > 0 && <div className="stat-sub" style={{ color: "var(--amber-600)" }}>Shortfall {formatINRCompact(calc.shortfallFuture)}</div>}
                  </Card>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
