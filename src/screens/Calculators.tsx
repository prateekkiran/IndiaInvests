import React, { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { CalculatorKind, ScenarioInputs, AmountBasis } from "../types";
import { runScenario } from "../engine/scenario";
import { GrowthChart } from "../components/Charts";
import { PageHead, Card, Button, NumberField, SliderField, Segmented, Callout, Disclosure, SelectField, Toggle } from "../components/ui";
import { formatINR, formatPercent, groupIndian } from "../engine/money";
import { uid, todayISO } from "../util";
import { ENGINE_VERSION } from "../types";
import { Reveal } from "../anim/components";

const KINDS: Array<{ id: CalculatorKind; label: string; group: string }> = [
  { id: "sip", label: "SIP", group: "Grow" },
  { id: "lumpsum", label: "Lump sum", group: "Grow" },
  { id: "stepup", label: "Step-up SIP", group: "Grow" },
  { id: "goal_future", label: "Goal amount", group: "Grow" },
  { id: "required_sip", label: "Required SIP", group: "Grow" },
  { id: "inflation", label: "Inflation / real", group: "Grow" },
  { id: "swp", label: "SWP", group: "Draw down" },
  { id: "retirement", label: "Retirement", group: "Draw down" },
  { id: "fd", label: "FD", group: "Deposit & borrow" },
  { id: "rd", label: "RD", group: "Deposit & borrow" },
  { id: "loan", label: "Loan / EMI", group: "Deposit & borrow" },
];

// Which kinds use the effective annual-return slider vs a nominal-rate field.
const USES_RETURN = new Set<CalculatorKind>(["sip", "lumpsum", "stepup", "required_sip", "inflation", "swp", "retirement"]);
const USES_NOMINAL = new Set<CalculatorKind>(["fd", "rd", "loan"]);
const USES_INFLATION = new Set<CalculatorKind>(["sip", "lumpsum", "stepup", "goal_future", "required_sip", "inflation", "swp", "retirement"]);
const USES_TIMING = new Set<CalculatorKind>(["sip", "stepup", "required_sip", "swp", "retirement"]);

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
    withdrawalMonthly: 50000,
    withdrawalInflates: true,
    pensionMonthly: 0,
    principal: 2500000,
    nominalRate: 0.09,
    compoundingPerYear: 4,
    extraPrepay: 0,
  });

  const patch = (p: Partial<ScenarioInputs>) => setInputs((s) => ({ ...s, ...p, kind }));
  const setKindAnd = (k: CalculatorKind) => {
    setKind(k);
    setInputs((s) => ({ ...s, kind: k }));
    setSaved(null);
    setShowReal(false);
  };

  const result = useMemo(() => {
    try {
      return runScenario({ ...inputs, kind });
    } catch {
      return null;
    }
  }, [inputs, kind]);

  const canReal = result?.isAccumulation !== false;

  function save() {
    const name = `${KINDS.find((k) => k.id === kind)?.label} · ${inputs.years}y`;
    dispatch({
      type: "SAVE_SCENARIO",
      scenario: { id: uid("scn"), name, createdAt: todayISO(), inputs: { ...inputs, kind }, engineVersion: ENGINE_VERSION },
    });
    setSaved(name);
  }

  const cols = result?.tableColumns ?? { period: "Period", contributed: "Contributed", growth: "Growth", value: "Value" };

  return (
    <div>
      <PageHead title="Calculators">
        Explore a plan before importing anything. Every result shows its formula and separates what you put in from what the maths adds. Assumptions are yours to set — these are illustrations, not forecasts or guaranteed returns.
      </PageHead>

      <div className="tabs">
        {KINDS.map((k) => (
          <button key={k.id} className={`tab ${kind === k.id ? "active" : ""}`} onClick={() => setKindAnd(k.id)}>{k.label}</button>
        ))}
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Reveal><Card>
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

          {(kind === "swp" || kind === "retirement") && (
            <>
              <NumberField label="Starting corpus" prefix="₹" value={inputs.openingBalance ?? 0} onChange={(v) => patch({ openingBalance: v })} min={0} />
              <NumberField label={kind === "retirement" ? "Monthly expense (today's rupees)" : "Monthly withdrawal"} prefix="₹" value={inputs.withdrawalMonthly ?? 0} onChange={(v) => patch({ withdrawalMonthly: v })} min={0} />
              {kind === "retirement" && (
                <NumberField label="Monthly pension / other income" prefix="₹" value={inputs.pensionMonthly ?? 0} onChange={(v) => patch({ pensionMonthly: v })} min={0} />
              )}
              <div className="field"><Toggle label="Increase withdrawals with inflation each year" checked={!!inputs.withdrawalInflates} onChange={(v) => patch({ withdrawalInflates: v })} /></div>
            </>
          )}

          {kind === "fd" && (
            <>
              <NumberField label="Principal" prefix="₹" value={inputs.principal ?? 0} onChange={(v) => patch({ principal: v })} min={0} />
              <SelectField<string> label="Compounding" value={String(inputs.compoundingPerYear ?? 4)} onChange={(v) => patch({ compoundingPerYear: Number(v) })}
                options={[{ value: "1", label: "Annual" }, { value: "2", label: "Half-yearly" }, { value: "4", label: "Quarterly" }, { value: "12", label: "Monthly" }]} />
            </>
          )}
          {kind === "rd" && (
            <NumberField label="Monthly deposit" prefix="₹" value={inputs.monthlyContribution ?? 0} onChange={(v) => patch({ monthlyContribution: v })} min={0} />
          )}
          {kind === "loan" && (
            <>
              <NumberField label="Loan principal" prefix="₹" value={inputs.principal ?? 0} onChange={(v) => patch({ principal: v })} min={0} />
              <NumberField label="Extra prepayment / month (optional)" prefix="₹" value={inputs.extraPrepay ?? 0} onChange={(v) => patch({ extraPrepay: v })} min={0} />
            </>
          )}

          <SliderField label={kind === "loan" ? "Loan tenure" : kind === "fd" || kind === "rd" ? "Term" : "Time horizon"} value={inputs.years} min={1} max={kind === "retirement" || kind === "swp" ? 50 : 40} step={1} onChange={(v) => patch({ years: v })} format={(v) => `${v} years`} />

          {USES_RETURN.has(kind) && kind !== "goal_future" && (
            <>
              <SliderField label={kind === "swp" || kind === "retirement" ? "Assumed return during drawdown" : "Assumed annual return"} value={inputs.annualReturn} min={-0.05} max={0.2} step={0.005} onChange={(v) => patch({ annualReturn: v })} format={(v) => formatPercent(v)} />
              <NumberField label="…or type it exactly" suffix="% p.a." value={Number((inputs.annualReturn * 100).toFixed(2))} onChange={(v) => patch({ annualReturn: v / 100 })} step={0.1} />
            </>
          )}

          {USES_NOMINAL.has(kind) && (
            <NumberField label={kind === "loan" ? "Interest rate (nominal, reducing balance)" : "Interest rate (nominal)"} suffix="% p.a." value={Number(((inputs.nominalRate ?? 0) * 100).toFixed(2))} onChange={(v) => patch({ nominalRate: v / 100 })} step={0.05} min={0} />
          )}

          {USES_INFLATION.has(kind) && (
            <SliderField label="Assumed inflation" value={inputs.annualInflation} min={0} max={0.12} step={0.005} onChange={(v) => patch({ annualInflation: v })} format={(v) => formatPercent(v)} />
          )}

          {USES_TIMING.has(kind) && (
            <div className="field">
              <span className="field-label">{kind === "swp" || kind === "retirement" ? "Withdrawal timing" : "Contribution timing"}</span>
              <Segmented value={inputs.timing} onChange={(v) => patch({ timing: v })} options={[{ value: "end", label: "End of month" }, { value: "begin", label: "Start of month" }]} />
            </div>
          )}

          <Callout tone="info">
            {USES_NOMINAL.has(kind)
              ? "Rates here use the market convention (nominal ÷ compounding). This is a generic tool, not a product-specific quote."
              : "Assumed return is illustrative and never inferred from any fund's past performance."}
          </Callout>
        </Card></Reveal>

        <Reveal delay={120} className="stack">
          <Card>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Result</h3>
              {canReal && (
                <Segmented value={showReal ? "real" : "nominal"} onChange={(v) => setShowReal(v === "real")} options={[{ value: "nominal", label: "Nominal" }, { value: "real", label: "Today's money" }]} />
              )}
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

                {result.notes.map((n, i) => <div key={i} style={{ marginTop: 10 }}><Callout tone={result.depletionMonth != null && i === 0 ? "warn" : "info"}>{n}</Callout></div>)}

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
              <GrowthChart
                title={showReal ? "Value in today's money" : result.legend ? result.legend.value + " over time" : "Projected value over time"}
                legend={result.legend}
                data={showReal
                  ? result.series.map((p) => ({ ...p, value: p.value / Math.pow(1 + inputs.annualInflation, labelToYears(p.label)), contributed: p.contributed }))
                  : result.series} />
              <div className="table-scroll" style={{ marginTop: 12 }}>
                <table className="data">
                  <thead><tr><th>{cols.period}</th><th className="num">{cols.contributed}</th><th className="num">{cols.growth}</th><th className="num">{cols.value}</th></tr></thead>
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
        </Reveal>
      </div>
    </div>
  );
}

function labelToYears(label: string): number {
  if (label === "Now") return 0;
  const m = label.match(/([\d.]+)/);
  return m ? Number(m[1]) : 0;
}
