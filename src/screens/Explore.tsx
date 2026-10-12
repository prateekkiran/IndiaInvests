import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { PageHead, Card, Button, Badge, Callout, EmptyState, Toggle } from "../components/ui";
import { runScenario, ScenarioResult } from "../engine/scenario";
import { formatINR, formatPercent } from "../engine/money";
import { fmtDate } from "../util";
import { SavedScenario, ScenarioInputs, CalculatorKind } from "../types";

const KIND_LABEL: Record<CalculatorKind, string> = {
  sip: "SIP",
  lumpsum: "Lump sum",
  stepup: "Step-up SIP",
  goal_future: "Goal amount",
  required_sip: "Required SIP",
  inflation: "Inflation / real",
  swp: "SWP",
  retirement: "Retirement",
  fd: "FD",
  rd: "RD",
  loan: "Loan / EMI",
};

// Kinds whose "rate" is a nominal borrowing/deposit rate rather than an
// assumed investment return.
const NOMINAL_KINDS = new Set<CalculatorKind>(["fd", "rd", "loan"]);

/** Nudge the relevant rate in the ADVERSE direction for a stress path. */
function adverseInputs(inputs: ScenarioInputs): ScenarioInputs {
  const i: ScenarioInputs = { ...inputs };
  if (inputs.kind === "fd" || inputs.kind === "rd") {
    i.nominalRate = Math.max(0, (inputs.nominalRate ?? 0) - 0.03); // less interest earned
  } else if (inputs.kind === "loan") {
    i.nominalRate = (inputs.nominalRate ?? 0) + 0.03; // higher interest cost
  } else {
    i.annualReturn = Math.max(-0.1, inputs.annualReturn - 0.03); // weaker returns
  }
  return i;
}

function adverseLabel(kind: CalculatorKind): string {
  if (kind === "loan") return "Higher rate (+3%)";
  if (NOMINAL_KINDS.has(kind)) return "Lower rate (−3%)";
  return "Lower return (−3%)";
}

/** The emphasised headline metric for a result (per-kind primary number). */
function primaryMetric(r: ScenarioResult): { label: string; value: string } {
  return r.headline.find((h) => h.emphasise) ?? r.headline[0];
}

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
    let base: ScenarioResult | null = null;
    let adverse: ScenarioResult | null = null;
    try {
      base = runScenario(s.inputs);
      adverse = stress ? runScenario(adverseInputs(s.inputs)) : null;
    } catch {
      /* leave null — rendered as an error card */
    }
    return { scenario: s, base, adverse };
  });

  const first = scenarios[0];
  const distinctKinds = new Set(scenarios.map((s) => s.inputs.kind));
  const mixed = distinctKinds.size > 1;

  return (
    <div>
      <PageHead title="Explore scenarios">
        Compare up to three saved scenarios side by side. Each card shows the headline figure for its calculator type, and the stress toggle applies an adverse rate appropriate to each type before any plan looks “enough”.
      </PageHead>

      <Card>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Pick scenarios ({selected.length}/3)</h3>
          <Toggle label="Show an adverse-rate stress path (±3%)" checked={stress} onChange={setStress} />
        </div>
        <div className="chip-row" style={{ marginTop: 10 }}>
          {state.savedScenarios.map((s) => (
            <button key={s.id} className={`btn sm ${selected.includes(s.id) ? "primary" : ""}`} onClick={() => toggle(s.id)}>
              {selected.includes(s.id) ? "✓ " : ""}{s.name}
            </button>
          ))}
        </div>
        {mixed && (
          <div style={{ marginTop: 12 }}>
            <Callout tone="info">You're comparing different calculator types, so the headline figure differs per card (e.g. a loan's EMI vs an SIP's projected value). The per-card tables show each type's own measures.</Callout>
          </div>
        )}
      </Card>

      {results.length > 0 && (
        <div className="grid cols-3" style={{ marginTop: 16 }}>
          {results.map(({ scenario, base, adverse }) => {
            return (
              <Card key={scenario.id}>
                <div className="row between">
                  <strong>{scenario.name}</strong>
                  <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "REMOVE_SCENARIO", id: scenario.id })}>✕</Button>
                </div>
                <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                  <Badge tone="indigo">{KIND_LABEL[scenario.inputs.kind]}</Badge>
                  <span className="soft" style={{ fontSize: "0.78rem" }}>Saved {fmtDate(scenario.createdAt)}</span>
                </div>

                {!base ? (
                  <Callout tone="warn">This saved scenario couldn't be recomputed with the current engine.</Callout>
                ) : (
                  <>
                    <div className="stat-label">{primaryMetric(base).label}</div>
                    <div className="stat-value" style={{ fontSize: "1.4rem" }}>{primaryMetric(base).value}</div>
                    {adverse && (
                      <div style={{ marginTop: 4 }}>
                        <Badge tone="amber">{adverseLabel(scenario.inputs.kind)}: {primaryMetric(adverse).value}</Badge>
                      </div>
                    )}
                    <table className="data" style={{ marginTop: 12 }}>
                      <tbody>
                        {base.headline.filter((h) => !h.emphasise).map((h, i) => (
                          <tr key={i}><td>{h.label}</td><td className="num">{h.value}</td></tr>
                        ))}
                        <tr>
                          <td>{NOMINAL_KINDS.has(scenario.inputs.kind) ? "Rate (nominal)" : "Return / inflation"}</td>
                          <td className="num">
                            {NOMINAL_KINDS.has(scenario.inputs.kind)
                              ? formatPercent(scenario.inputs.nominalRate ?? 0)
                              : `${formatPercent(scenario.inputs.annualReturn)} / ${formatPercent(scenario.inputs.annualInflation)}`}
                          </td>
                        </tr>
                        <tr><td>Horizon</td><td className="num">{scenario.inputs.years} yrs</td></tr>
                      </tbody>
                    </table>
                  </>
                )}
              </Card>
            );
          })}
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
          <Callout tone="info">These paths use your assumptions and are not forecasts. Differences are driven by the inputs you changed, shown above.</Callout>
        </Card>
      )}
    </div>
  );
}

function describeDiff(a: SavedScenario, b: SavedScenario): string {
  const parts: string[] = [];
  const ia = a.inputs, ib = b.inputs;
  if (ia.kind !== ib.kind) parts.push(`type ${KIND_LABEL[ia.kind]} → ${KIND_LABEL[ib.kind]}`);
  if (ib.annualReturn !== ia.annualReturn) parts.push(`return ${formatPercent(ia.annualReturn)} → ${formatPercent(ib.annualReturn)}`);
  if ((ib.nominalRate ?? 0) !== (ia.nominalRate ?? 0)) parts.push(`rate ${formatPercent(ia.nominalRate ?? 0)} → ${formatPercent(ib.nominalRate ?? 0)}`);
  if (ib.annualInflation !== ia.annualInflation) parts.push(`inflation ${formatPercent(ia.annualInflation)} → ${formatPercent(ib.annualInflation)}`);
  if (ib.years !== ia.years) parts.push(`horizon ${ia.years}y → ${ib.years}y`);
  if ((ib.monthlyContribution ?? 0) !== (ia.monthlyContribution ?? 0)) parts.push(`monthly ${formatINR(ia.monthlyContribution ?? 0)} → ${formatINR(ib.monthlyContribution ?? 0)}`);
  if ((ib.withdrawalMonthly ?? 0) !== (ia.withdrawalMonthly ?? 0)) parts.push(`withdrawal ${formatINR(ia.withdrawalMonthly ?? 0)} → ${formatINR(ib.withdrawalMonthly ?? 0)}`);
  if ((ib.pensionMonthly ?? 0) !== (ia.pensionMonthly ?? 0)) parts.push(`pension ${formatINR(ia.pensionMonthly ?? 0)} → ${formatINR(ib.pensionMonthly ?? 0)}`);
  if ((ib.principal ?? 0) !== (ia.principal ?? 0)) parts.push(`principal ${formatINR(ia.principal ?? 0)} → ${formatINR(ib.principal ?? 0)}`);
  if ((ib.extraPrepay ?? 0) !== (ia.extraPrepay ?? 0)) parts.push(`prepay ${formatINR(ia.extraPrepay ?? 0)} → ${formatINR(ib.extraPrepay ?? 0)}`);
  if ((ib.compoundingPerYear ?? 0) !== (ia.compoundingPerYear ?? 0)) parts.push(`compounding ${ia.compoundingPerYear ?? "—"}× → ${ib.compoundingPerYear ?? "—"}×`);
  if (!!ib.withdrawalInflates !== !!ia.withdrawalInflates) parts.push(`inflation-linked withdrawals ${ia.withdrawalInflates ? "on" : "off"} → ${ib.withdrawalInflates ? "on" : "off"}`);
  if (ib.timing !== ia.timing) parts.push(`timing ${ia.timing} → ${ib.timing}`);
  if ((ib.annualStepUp ?? 0) !== (ia.annualStepUp ?? 0)) parts.push(`step-up ${formatPercent(ia.annualStepUp ?? 0)} → ${formatPercent(ib.annualStepUp ?? 0)}`);
  return parts.length ? parts.join(", ") : "same inputs";
}
