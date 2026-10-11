import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { PageHead, Card, Button, Badge, Callout, NumberField, TextField, SelectField, SliderField, EmptyState, Sheet } from "../components/ui";
import { computeGoal, allocatableAssets, allocationAfterChange, allocationLedger } from "../store/goals";
import { formatINR, formatINRCompact, formatPercent } from "../engine/money";
import { fmtDate, uid, todayISO, addMonthsISO } from "../util";
import { Goal, AmountBasis } from "../types";
import { CountUp, Reveal, AnimatedBar } from "../anim/components";

const TEMPLATES: Array<{ id: Goal["template"]; label: string; years: number; amount: number }> = [
  { id: "emergency", label: "Emergency reserve", years: 1, amount: 600000 },
  { id: "education", label: "Education", years: 15, amount: 4000000 },
  { id: "home", label: "Home purchase", years: 7, amount: 8000000 },
  { id: "retirement", label: "Retirement", years: 25, amount: 30000000 },
  { id: "custom", label: "Custom goal", years: 10, amount: 2000000 },
];

export function Goals() {
  const { state } = useApp();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <PageHead title="Goals">
        Turn amounts in today's rupees into a plan. We separate the future target, what you've allocated, and the projected value — and a global ledger stops any asset being counted toward more than 100%.
      </PageHead>

      <div className="row between" style={{ marginBottom: 14 }}>
        <span className="soft">{state.goals.length} goal(s)</span>
        <Button variant="primary" onClick={() => setCreating(true)}>+ New goal</Button>
      </div>

      {state.goals.length === 0 ? (
        <EmptyState icon="◇" title="No goals yet">Create a goal to see funding ratio and shortfall with your own assumptions.</EmptyState>
      ) : (
        <div className="grid cols-2">
          {state.goals.map((g, i) => <Reveal key={g.id} delay={i * 80}><GoalCard goal={g} onEdit={() => setEditingId(g.id)} /></Reveal>)}
        </div>
      )}

      {creating && <CreateGoalSheet onClose={() => setCreating(false)} />}
      {editingId && <EditGoalSheet goalId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { state, dispatch } = useApp();
  const c = computeGoal(state, goal);
  const pct = Math.min(100, Math.round(c.fundingRatio * 100));
  return (
    <Card>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{goal.label}</h3>
        <Badge tone={pct >= 100 ? "green" : pct >= 60 ? "teal" : "amber"}><CountUp value={Math.round(c.fundingRatio * 100)} duration={900} format={(v) => `${Math.round(v)}% funded`} /></Badge>
      </div>
      <div className="soft" style={{ fontSize: "0.84rem", marginBottom: 10 }}>Target {fmtDate(goal.targetDate)} · {formatPercent(goal.annualReturn)} return · {formatPercent(goal.annualInflation)} inflation</div>

      <div style={{ marginBottom: 12 }}>
        <AnimatedBar pct={pct} color={pct >= 100 ? "var(--green-600)" : "var(--indigo-600)"} delay={150} />
      </div>

      <table className="data">
        <tbody>
          <tr><td>Future target</td><td className="num">{formatINR(c.futureTarget)}</td></tr>
          <tr><td>Allocated now (present value)</td><td className="num">{formatINR(c.allocatedPresentValue)}</td></tr>
          <tr><td>Monthly contribution</td><td className="num">{formatINR(c.monthlyContribution)}</td></tr>
          <tr><td>Projected value</td><td className="num">{formatINR(c.projectedValue)}</td></tr>
          <tr><td>Projected (today's money)</td><td className="num">{formatINR(c.projectedValueReal)}</td></tr>
          <tr><td><strong>Shortfall</strong></td><td className="num"><strong style={{ color: c.shortfallFuture > 0 ? "var(--amber-600)" : "var(--green-600)" }}>{c.shortfallFuture > 0 ? formatINR(c.shortfallFuture) : "Fully funded"}</strong></td></tr>
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 12 }}>
        <Button size="sm" onClick={onEdit}>Edit & allocate</Button>
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "REMOVE_GOAL", id: goal.id })}>Delete</Button>
      </div>
      <div style={{ marginTop: 10 }}><Callout tone="info">Current allocation ÷ future target is not readiness. Projected value already compounds your assumptions to the target date.</Callout></div>
    </Card>
  );
}

function CreateGoalSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [tpl, setTpl] = useState<Goal["template"]>("retirement");
  const chosen = TEMPLATES.find((t) => t.id === tpl)!;
  const [label, setLabel] = useState(chosen.label);
  const [amount, setAmount] = useState(chosen.amount);
  const [basis, setBasis] = useState<AmountBasis>("today");
  const [years, setYears] = useState(chosen.years);
  const [ret, setRet] = useState(state.preferences.defaultAnnualReturn);
  const [infl, setInfl] = useState(state.preferences.defaultInflation);

  function applyTemplate(id: Goal["template"]) {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTpl(id); setLabel(t.label); setAmount(t.amount); setYears(t.years);
  }

  return (
    <Sheet title="New goal" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!label || amount <= 0} onClick={() => {
          const goal: Goal = {
            id: uid("goal"), label, template: tpl, amount, amountBasis: basis,
            targetDate: addMonthsISO(todayISO(), Math.round(years * 12)), priority: state.goals.length + 1,
            annualInflation: infl, annualReturn: ret, allocations: [], contributionStreamIds: [],
          };
          dispatch({ type: "ADD_GOAL", goal });
          onClose();
        }}>Create goal</Button>
      </>
    }>
      <SelectField<NonNullable<Goal["template"]>> label="Template" value={tpl!} onChange={(v) => applyTemplate(v)} options={TEMPLATES.map((t) => ({ value: t.id!, label: t.label }))} />
      <TextField label="Label" value={label} onChange={setLabel} />
      <NumberField label="Goal amount" prefix="₹" value={amount} onChange={setAmount} min={0} />
      <SelectField<AmountBasis> label="Amount basis" value={basis} onChange={setBasis} options={[{ value: "today", label: "Today's rupees (will be inflated)" }, { value: "future", label: "Future rupees (already the target)" }]} />
      <SliderField label="Years to goal" value={years} min={1} max={40} step={1} onChange={setYears} format={(v) => `${v} years`} />
      <SliderField label="Assumed return" value={ret} min={0} max={0.18} step={0.005} onChange={setRet} format={(v) => formatPercent(v)} />
      <SliderField label="Assumed inflation" value={infl} min={0} max={0.12} step={0.005} onChange={setInfl} format={(v) => formatPercent(v)} />
    </Sheet>
  );
}

function EditGoalSheet({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const goal = state.goals.find((g) => g.id === goalId)!;
  const assets = allocatableAssets(state);
  const ledger = allocationLedger(state);
  const [warn, setWarn] = useState<string | null>(null);

  // Contribution stream quick-add
  const [streamAmt, setStreamAmt] = useState(10000);

  function getFraction(ref: string): number {
    return goal.allocations.find((a) => a.assetRef === ref)?.fraction ?? 0;
  }

  function setFraction(ref: string, fraction: number) {
    const after = allocationAfterChange(state, goalId, ref, fraction);
    if (after > 1 + 1e-9) {
      setWarn(`That would allocate ${(after * 100).toFixed(0)}% of this asset across your goals — more than 100%. Reduce another goal's share first.`);
      return;
    }
    setWarn(null);
    const allocations = goal.allocations.filter((a) => a.assetRef !== ref);
    if (fraction > 0) allocations.push({ assetRef: ref, fraction });
    dispatch({ type: "UPDATE_GOAL", id: goalId, patch: { allocations } });
  }

  function addStream() {
    const sid = uid("stream");
    dispatch({ type: "ADD_CONTRIBUTION_STREAM", stream: { id: sid, label: `${goal.label} SIP`, monthlyAmount: streamAmt, annualStepUp: 0, timing: "end" } });
    dispatch({ type: "UPDATE_GOAL", id: goalId, patch: { contributionStreamIds: [...goal.contributionStreamIds, sid] } });
  }

  const linkedStreams = state.contributionStreams.filter((s) => goal.contributionStreamIds.includes(s.id));

  return (
    <Sheet title={`Edit — ${goal.label}`} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <h3 style={{ marginTop: 0 }}>Allocate existing assets</h3>
      {assets.length === 0 ? <p className="soft">No valued assets to allocate yet. Add manual assets or import a portfolio.</p> : (
        <div className="stack">
          {assets.map((a) => {
            const total = ledger.get(a.ref)?.totalFraction ?? 0;
            return (
              <div key={a.ref} className="card" style={{ padding: 12, background: "var(--surface-sunken)", border: "none" }}>
                <div className="row between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{a.label}</span>
                  <span className="soft num">{formatINRCompact(a.value)}</span>
                </div>
                <SliderField label={`Allocated to this goal · ${(getFraction(a.ref) * 100).toFixed(0)}% (total across goals ${(total * 100).toFixed(0)}%)`} value={getFraction(a.ref)} min={0} max={1} step={0.05} onChange={(v) => setFraction(a.ref, v)} format={(v) => `${(v * 100).toFixed(0)}%`} />
              </div>
            );
          })}
        </div>
      )}
      {warn && <div style={{ marginTop: 8 }}><Callout tone="warn">{warn}</Callout></div>}

      <hr className="hr" />
      <h3>Planned contributions</h3>
      {linkedStreams.map((s) => (
        <div key={s.id} className="row between" style={{ marginBottom: 6 }}>
          <span className="soft">{formatINR(s.monthlyAmount)} / month {s.annualStepUp ? `· +${formatPercent(s.annualStepUp)}/yr` : ""}</span>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "REMOVE_CONTRIBUTION_STREAM", id: s.id })}>Remove</Button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <div style={{ flex: 1 }}><NumberField label="Add monthly SIP" prefix="₹" value={streamAmt} onChange={setStreamAmt} min={0} /></div>
        <Button size="sm" onClick={addStream} style={{ marginTop: 8 }}>Add</Button>
      </div>

      <hr className="hr" />
      <GoalLiveSummary goalId={goalId} />
    </Sheet>
  );
}

function GoalLiveSummary({ goalId }: { goalId: string }) {
  const { state } = useApp();
  const goal = state.goals.find((g) => g.id === goalId)!;
  const c = computeGoal(state, goal);
  return (
    <table className="data">
      <tbody>
        <tr><td>Future target</td><td className="num">{formatINR(c.futureTarget)}</td></tr>
        <tr><td>Projected value</td><td className="num">{formatINR(c.projectedValue)}</td></tr>
        <tr><td>Funding ratio</td><td className="num">{(c.fundingRatio * 100).toFixed(0)}%</td></tr>
        <tr><td>Shortfall</td><td className="num">{c.shortfallFuture > 0 ? formatINR(c.shortfallFuture) : "—"}</td></tr>
      </tbody>
    </table>
  );
}
