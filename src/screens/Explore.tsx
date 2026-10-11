import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { PageHead, Card, Button, Badge, Callout, EmptyState, Toggle } from "../components/ui";
import { runScenario } from "../engine/scenario";
import { formatINR, formatPercent } from "../engine/money";
import { fmtDate } from "../util";
import { SavedScenario } from "../types";

export function Explore() {
  const { state, dispatch } = useApp();
  const [selected, setSelected] = useState<string[]>(state.savedScenarios.slice(0, 2).map((s) => s.id));
  const [stress, setStress] = useState(false);

  const scenarios = state.savedScenarios.filter((s) => selected.includes(s.id)).slice(0, 3);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));
  }

  if (state.savedScenarios.length === 0) {
    return (
      <div>
        <PageHead title="Explore scenarios" />
        <EmptyState icon="⇄" title="No saved scenarios">Save scenarios from the Calculators screen, then compare up to three here on a common basis.</EmptyState>
      </div>
    );
  }

  const results = scenarios.map((s) => {
    const base = runScenario(s.inputs);
    const stressed = stress ? runScenario({ ...s.inputs, annualReturn: Math.max(-0.1, s.inputs.annualReturn - 0.03) }) : null;
    return { scenario: s, base, stressed };
  });

  const first = scenarios[0];

  return (
    <div>
      <PageHead title="Explore scenarios">
        Compare up to three saved scenarios with the same axes and currency basis. We always show a weaker-return path before suggesting any contribution is “enough”.
      </PageHead>

      <Card>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Pick scenarios ({selected.length}/3)</h3>
          <Toggle label="Show a lower-return stress path (−3%)" checked={stress} onChange={setStress} />
        </div>
        <div className="chip-row" style={{ marginTop: 10 }}>
          {state.savedScenarios.map((s) => (
            <button key={s.id} className={`btn sm ${selected.includes(s.id) ? "primary" : ""}`} onClick={() => toggle(s.id)}>
              {selected.includes(s.id) ? "✓ " : ""}{s.name}
            </button>
          ))}
        </div>
      </Card>

      {results.length > 0 && (
        <div className="grid cols-3" style={{ marginTop: 16 }}>
          {results.map(({ scenario, base, stressed }) => (
            <Card key={scenario.id}>
              <div className="row between"><strong>{scenario.name}</strong><Button size="sm" variant="ghost" onClick={() => dispatch({ type: "REMOVE_SCENARIO", id: scenario.id })}>✕</Button></div>
              <div className="soft" style={{ fontSize: "0.78rem", marginBottom: 10 }}>Saved {fmtDate(scenario.createdAt)}</div>
              <div className="stat-label">Projected value</div>
              <div className="stat-value" style={{ fontSize: "1.4rem" }}>{formatINR(base.finalValue)}</div>
              {stressed && <div style={{ marginTop: 4 }}><Badge tone="amber">Lower return: {formatINR(stressed.finalValue)}</Badge></div>}
              <table className="data" style={{ marginTop: 12 }}>
                <tbody>
                  <tr><td>You contribute</td><td className="num">{formatINR(base.contributed)}</td></tr>
                  <tr><td>Growth</td><td className="num">{formatINR(base.growth)}</td></tr>
                  <tr><td>Today's money</td><td className="num">{formatINR(base.realFinalValue)}</td></tr>
                  <tr><td>Return / inflation</td><td className="num">{formatPercent(scenario.inputs.annualReturn)} / {formatPercent(scenario.inputs.annualInflation)}</td></tr>
                  <tr><td>Horizon</td><td className="num">{scenario.inputs.years} yrs</td></tr>
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}

      {scenarios.length >= 2 && first && (
        <Card style={{ marginTop: 16 }}>
          <h3>What changed vs “{first.name}”</h3>
          <ul className="soft" style={{ marginTop: 8 }}>
            {scenarios.slice(1).map((s) => (
              <li key={s.id}><strong>{s.name}:</strong> {describeDiff(first, s)}</li>
            ))}
          </ul>
          <Callout tone="info">These paths use your assumptions and are not forecasts. A difference in projected value is driven mostly by the return and horizon you chose.</Callout>
        </Card>
      )}
    </div>
  );
}

function describeDiff(a: SavedScenario, b: SavedScenario): string {
  const parts: string[] = [];
  const ia = a.inputs, ib = b.inputs;
  if (ib.annualReturn !== ia.annualReturn) parts.push(`return ${formatPercent(ia.annualReturn)} → ${formatPercent(ib.annualReturn)}`);
  if (ib.annualInflation !== ia.annualInflation) parts.push(`inflation ${formatPercent(ia.annualInflation)} → ${formatPercent(ib.annualInflation)}`);
  if (ib.years !== ia.years) parts.push(`horizon ${ia.years}y → ${ib.years}y`);
  if ((ib.monthlyContribution ?? 0) !== (ia.monthlyContribution ?? 0)) parts.push(`SIP ${formatINR(ia.monthlyContribution ?? 0)} → ${formatINR(ib.monthlyContribution ?? 0)}`);
  if (ib.timing !== ia.timing) parts.push(`timing ${ia.timing} → ${ib.timing}`);
  if ((ib.annualStepUp ?? 0) !== (ia.annualStepUp ?? 0)) parts.push(`step-up ${formatPercent(ia.annualStepUp ?? 0)} → ${formatPercent(ib.annualStepUp ?? 0)}`);
  return parts.length ? parts.join(", ") : "same inputs";
}
