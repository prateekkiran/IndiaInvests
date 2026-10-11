import React, { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { CalculatorKind, ScenarioInputs, AmountBasis } from "../types";
import { runScenario } from "../engine/scenario";
import { GrowthChart } from "../components/Charts";
import { PageHead, Card, Button, NumberField, SliderField, Segmented, Callout, Disclosure, SelectField, Badge } from "../components/ui";
import { formatINR, formatPercent, groupIndian } from "../engine/money";
import { uid, todayISO } from "../util";
import { ENGINE_VERSION } from "../types";

const KINDS: Array<{ id: CalculatorKind; label: string }> = [
  { id: "sip", label: "SIP" },
  { id: "lumpsum", label: "Lump sum" },
  { id: "stepup", label: "Step-up SIP" },
  { id: "goal_future", label: "Goal amount" },
  { id: "required_sip", label: "Required SIP" },
  { id: "inflation", label: "Inflation / real" },
];

export function Calculators() {
  const { state, dispatch } = useApp();
  const [kind, setKind] = useState<CalculatorKind>("sip");
  const [showReal, setShowReal] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const [inputs, setInputs] = useState<ScenarioInputs>({
    kind: "sip",
    monthlyContribution: 10000,
    lumpSum: 100000,
    annualReturn: state.preferences.defaultAnnualReturn,
    annualInflation: state.preferences.defaultInflation,
    years: 15,
    timing: "end",
    annualStepUp: 0.1,
    goalAmountToday: 2000000,
    goalAmountBasis: "today",
    openingBalance: 0,
  });

  const patch = (p: Partial<ScenarioInputs>) => setInputs((s) => ({ ...s, ...p, kind }));
  const setKindAnd = (k: CalculatorKind) => { setKind(k); setInputs((s) => ({ ...s, kind: k })); setSaved(null); };

  const result = useMemo(() => {
    try {
      return runScenario({ ...inputs, kind });
    } catch (e) {
      return null;
    }
  }, [inputs, kind]);

  function save() {
    const name = `${KINDS.find((k) => k.id === kind)?.label} · ${inputs.years}y @ ${formatPercent(inputs.annualReturn)}`;
    dispatch({
      type: "SAVE_SCENARIO",
      scenario: { id: uid("scn"), name, createdAt: todayISO(), inputs: { ...inputs, kind }, engineVersion: ENGINE_VERSION },
    });
    setSaved(name);
  }

  return (
    <div>
      <PageHead title="Calculators">
        Explore a plan before importing anything. Every result shows its formula and separates what you contribute from growth. Assumptions are yours to set — these are illustrations, not forecasts or guaranteed returns.
      </PageHead>

      <div className="tabs">
        {KINDS.map((k) => (
          <button key={k.id} className={`tab ${kind === k.id ? "active" : ""}`} onClick={() => setKindAnd(k.id)}>{k.label}</button>
        ))}
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card>
          <h3>Inputs</h3>

          {(kind === "sip" || kind === "stepup") && (
            <NumberField label="Monthly contribution" prefix="₹" value={inputs.monthlyContribution ?? 0} onChange={(v) => patch({ monthlyContribution: v })} min={0} />
          )}
          {kind === "lumpsum" && (
            <NumberField label="Lump sum amount" prefix="₹" value={inputs.lumpSum ?? 0} onChange={(v) => patch({ lumpSum: v })} min={0} />
          )}
          {kind === "inflation" && (
            <NumberField label="Amount to project" prefix="₹" value={inputs.lumpSum ?? 0} onChange={(v) => patch({ lumpSum: v })} min={0} />
          )}
          {(kind === "goal_future" || kind === "required_sip") && (
            <NumberField label="Goal amount (today's rupees)" prefix="₹" value={inputs.goalAmountToday ?? 0} onChange={(v) => patch({ goalAmountToday: v })} min={0} />
          )}
          {kind === "required_sip" && (
            <>
              <SelectField<AmountBasis> label="Goal amount is stated in" value={inputs.goalAmountBasis ?? "today"} onChange={(v) => patch({ goalAmountBasis: v })}
                options={[{ value: "today", label: "Today's rupees (inflate to target date)" }, { value: "future", label: "Future rupees (already the target)" }]} />
              <NumberField label="Existing balance for this goal" prefix="₹" value={inputs.openingBalance ?? 0} onChange={(v) => patch({ openingBalance: v })} min={0} />
            </>
          )}
          {kind === "stepup" && (
            <SliderField label="Annual step-up" value={inputs.annualStepUp ?? 0} min={0} max={0.25} step={0.01} onChange={(v) => patch({ annualStepUp: v })} format={(v) => formatPercent(v)} />
          )}

          <SliderField label="Time horizon" value={inputs.years} min={1} max={40} step={1} onChange={(v) => patch({ years: v })} format={(v) => `${v} years`} />

          {kind !== "goal_future" && (
            <>
              <SliderField label="Assumed annual return" value={inputs.annualReturn} min={-0.05} max={0.2} step={0.005} onChange={(v) => patch({ annualReturn: v })} format={(v) => formatPercent(v)} />
              <NumberField label="…or type it exactly" suffix="% p.a." value={Number((inputs.annualReturn * 100).toFixed(2))} onChange={(v) => patch({ annualReturn: v / 100 })} step={0.1} />
            </>
          )}

          <SliderField label="Assumed inflation" value={inputs.annualInflation} min={0} max={0.12} step={0.005} onChange={(v) => patch({ annualInflation: v })} format={(v) => formatPercent(v)} />

          {(kind === "sip" || kind === "stepup" || kind === "required_sip") && (
            <div className="field">
              <span className="field-label">Contribution timing</span>
              <Segmented value={inputs.timing} onChange={(v) => patch({ timing: v })} options={[{ value: "end", label: "End of month" }, { value: "begin", label: "Start of month" }]} />
            </div>
          )}

          <Callout tone="info">Assumed annual return is illustrative and never inferred from any fund's past performance.</Callout>
        </Card>

        <div className="stack">
          <Card>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Result</h3>
              <Segmented value={showReal ? "real" : "nominal"} onChange={(v) => setShowReal(v === "real")} options={[{ value: "nominal", label: "Nominal" }, { value: "real", label: "Today's money" }]} />
            </div>

            {!result ? (
              <Callout tone="warn">That combination of inputs isn't supported. Adjust a value to continue.</Callout>
            ) : (
              <>
                <div className="grid cols-2" style={{ marginTop: 14, gap: 12 }}>
                  {result.headline.map((h, idx) => (
                    <div key={idx} className="card" style={{ padding: 14, background: h.emphasise ? "var(--indigo-100)" : "var(--surface-sunken)", border: "none" }}>
                      <div className="stat-label">{h.label}</div>
                      <div className="stat-value" style={{ fontSize: "1.3rem" }}>{h.value}</div>
                    </div>
                  ))}
                </div>

                {result.notes.map((n, i) => <div key={i} style={{ marginTop: 10 }}><Callout tone="info">{n}</Callout></div>)}

                <Disclosure summary="How this is calculated">{result.formula}</Disclosure>

                <div className="row" style={{ marginTop: 14 }}>
                  <Button variant="primary" size="sm" onClick={save}>Save scenario</Button>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>Compare saved scenarios in <span className="kbd">Explore</span></span>
                </div>
                {saved && <div style={{ marginTop: 10 }}><Callout tone="success">Saved “{saved}”. {state.savedScenarios.length} scenario(s) stored.</Callout></div>}
              </>
            )}
          </Card>

          {result && (
            <Card>
              <GrowthChart title={showReal ? "Value in today's money" : "Projected value over time"} data={showReal
                ? result.series.map((p) => ({ ...p, value: p.value / Math.pow(1 + inputs.annualInflation, (labelToYears(p.label)) ), contributed: p.contributed }))
                : result.series} />
              <div className="table-scroll" style={{ marginTop: 12 }}>
                <table className="data">
                  <thead><tr><th>Period</th><th className="num">Contributed</th><th className="num">Growth</th><th className="num">Value</th></tr></thead>
                  <tbody>
                    {result.table.map((r, i) => (
                      <tr key={i}>
                        <td>{r.period}</td>
                        <td className="num">₹{groupIndian(r.contributed, 0)}</td>
                        <td className="num">₹{groupIndian(r.growth, 0)}</td>
                        <td className="num">₹{groupIndian(r.value, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function labelToYears(label: string): number {
  if (label === "Now") return 0;
  const m = label.match(/([\d.]+)/);
  return m ? Number(m[1]) : 0;
}
