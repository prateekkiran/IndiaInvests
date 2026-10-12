import React, { useMemo, useState } from "react";
import { useApp } from "../store/AppContext";
import { PageHead, Card, Button, Badge, Callout, EmptyState, NumberField, SliderField, TextField, SelectField, Sheet } from "../components/ui";
import { CountUp, Reveal, AnimatedBar } from "../anim/components";
import { computeGoal, allocatableAssets, allocationLedger } from "../store/goals";
import { simulateHousehold, HouseholdGoalInput, HouseholdEventInput } from "../engine/household";
import { formatINR, formatINRCompact, formatPercent } from "../engine/money";
import { fmtDate, uid, todayISO, monthsBetween } from "../util";
import { LifeEvent } from "../types";

export function Household() {
  const { state, dispatch } = useApp();
  const hh = state.household ?? { monthlyBudget: 0, annualStepUp: 0, lifeEvents: [] };
  const [showEvent, setShowEvent] = useState(false);

  // Build the simulation inputs from the current goals + allocations.
  const sim = useMemo(() => {
    if (state.goals.length === 0) return null;
    const streamById = new Map(state.contributionStreams.map((s) => [s.id, s]));
    const goals: HouseholdGoalInput[] = state.goals.map((g) => {
      const c = computeGoal(state, g);
      const dedicatedMonthly = g.contributionStreamIds.reduce((a, id) => a + (streamById.get(id)?.monthlyAmount ?? 0), 0);
      return {
        id: g.id,
        label: g.label,
        priority: g.priority,
        targetMonth: monthsBetween(todayISO(), g.targetDate),
        futureTarget: c.futureTarget,
        openingBalance: c.allocatedPresentValue,
        annualReturn: g.annualReturn,
        dedicatedMonthly,
        dedicatedStepUp: 0,
      };
    });

    // Unassigned pool = value of assets not yet earmarked to any goal.
    const ledger = allocationLedger(state);
    const unassignedPool = allocatableAssets(state).reduce((a, asset) => {
      const used = Math.min(1, ledger.get(asset.ref)?.totalFraction ?? 0);
      return a + asset.value * (1 - used);
    }, 0);

    const events: HouseholdEventInput[] = hh.lifeEvents.map((e) => ({
      id: e.id,
      label: e.label,
      month: Math.max(1, monthsBetween(todayISO(), e.date)),
      amount: e.type === "income" ? e.amount : -e.amount,
    }));

    return simulateHousehold({ goals, monthlyBudget: hh.monthlyBudget, annualStepUp: hh.annualStepUp, events, unassignedPool });
  }, [state, hh.monthlyBudget, hh.annualStepUp, hh.lifeEvents]);

  return (
    <div>
      <PageHead title="Household & life events">
        One shared plan across all your goals. Instead of sizing each goal on its own — which quietly lets the same rupee fund several goals at once — this runs a single month-by-month simulation that spends your budget once, in priority order, and models each goal being withdrawn once at its target date.
      </PageHead>

      {state.goals.length === 0 ? (
        <EmptyState icon="⌂" title="No goals yet">Create goals first, then plan them together here with a shared budget and life events.</EmptyState>
      ) : (
        <>
          <div className="grid cols-2" style={{ alignItems: "start" }}>
            <Reveal><Card>
              <h3>Shared monthly budget</h3>
              <p className="soft">What the household can save per month in total, across every goal.</p>
              <NumberField label="Monthly savings budget" prefix="₹" value={hh.monthlyBudget} onChange={(v) => dispatch({ type: "SET_HOUSEHOLD", patch: { monthlyBudget: v } })} min={0} />
              <SliderField label="Annual budget step-up" value={hh.annualStepUp} min={0} max={0.2} step={0.01} onChange={(v) => dispatch({ type: "SET_HOUSEHOLD", patch: { annualStepUp: v } })} format={(v) => formatPercent(v)} />
              {sim && sim.overcommitted && (
                <Callout tone="warn">Your goals need {formatINR(sim.firstMonthRequiredTotal)}/month right now, which is {formatINR(sim.overcommitBy)} more than this budget. Lower-priority goals will fall short — raise the budget, extend a target date, or reduce a goal.</Callout>
              )}
              {sim && !sim.overcommitted && hh.monthlyBudget > 0 && (
                <Callout tone="success">This budget currently covers the required monthly contributions across your goals.</Callout>
              )}
            </Card></Reveal>

            <Reveal delay={120}><Card>
              <div className="row between"><h3 style={{ margin: 0 }}>Life events</h3><Button size="sm" onClick={() => setShowEvent(true)}>+ Add event</Button></div>
              <p className="soft">One-off income (a bonus, maturity) or spending (a wedding, down payment, medical). Spending is paid before saving, so an unaffordable month shows up honestly.</p>
              {hh.lifeEvents.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.85rem" }}>No life events yet.</p>
              ) : (
                <table className="data">
                  <thead><tr><th>Event</th><th>When</th><th className="num">Amount</th><th></th></tr></thead>
                  <tbody>
                    {[...hh.lifeEvents].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => (
                      <tr key={e.id}>
                        <td>{e.label} <Badge tone={e.type === "income" ? "green" : "amber"}>{e.type}</Badge></td>
                        <td className="soft">{fmtDate(e.date)}</td>
                        <td className="num" style={{ color: e.type === "income" ? "var(--green-600)" : "var(--amber-600)" }}>{e.type === "income" ? "+" : "−"}{formatINRCompact(e.amount)}</td>
                        <td className="num"><Button size="sm" variant="ghost" onClick={() => dispatch({ type: "REMOVE_LIFE_EVENT", id: e.id })}>Remove</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card></Reveal>
          </div>

          {sim && (
            <>
              <div className="row between" style={{ margin: "22px 0 12px" }}>
                <h3 style={{ margin: 0 }}>Shared plan outcome</h3>
                <span className="soft" style={{ fontSize: "0.82rem" }}>Horizon {Math.round(sim.horizonMonths / 12)} yrs · priority order</span>
              </div>

              {sim.sharingReducesAnyGoal && (
                <div style={{ marginBottom: 14 }}>
                  <Callout tone="warn">Planned on their own, your goals look better funded than they really are — the same savings can't fund all of them at once. The bars below are the honest shared-budget result.</Callout>
                </div>
              )}

              <div className="grid cols-3">
                {sim.goals.map((g, idx) => {
                  const pct = Math.min(100, Math.round(g.fundedPct * 100));
                  const tone = pct >= 100 ? "green" : pct >= 60 ? "teal" : "amber";
                  const overstated = g.independentFunded > g.funded + 1;
                  return (
                    <Reveal key={g.id} delay={idx * 90}>
                      <Card>
                        <div className="row between">
                          <strong>{g.label}</strong>
                          <Badge tone={tone as any}><CountUp value={pct} duration={900} format={(v) => `${Math.round(v)}%`} /></Badge>
                        </div>
                        <div className="soft" style={{ fontSize: "0.78rem", margin: "2px 0 10px" }}>Priority {g.priority} · target {formatINRCompact(g.futureTarget)} in {Math.round(g.targetMonth / 12)}y</div>
                        <AnimatedBar pct={pct} color={pct >= 100 ? "var(--green-600)" : "var(--indigo-600)"} delay={idx * 90 + 200} />
                        <table className="data" style={{ marginTop: 12 }}>
                          <tbody>
                            <tr><td>Funded (shared)</td><td className="num">{formatINR(g.funded)}</td></tr>
                            {g.shortfall > 0 && <tr><td>Shortfall</td><td className="num" style={{ color: "var(--amber-600)" }}>{formatINR(g.shortfall)}</td></tr>}
                            {overstated && <tr><td className="soft">If planned alone</td><td className="num soft">{formatINR(g.independentFunded)}</td></tr>}
                          </tbody>
                        </table>
                      </Card>
                    </Reveal>
                  );
                })}
              </div>

              <div className="grid cols-3" style={{ marginTop: 16 }}>
                <Card><div className="stat-label">Budget required (first month)</div><div className="stat-value" style={{ fontSize: "1.3rem" }}>{formatINR(sim.firstMonthRequiredTotal)}</div><div className="stat-sub">vs {formatINR(sim.monthlyBudget)} available</div></Card>
                <Card><div className="stat-label">Unmet spending</div><div className="stat-value" style={{ fontSize: "1.3rem" }}>{sim.totalUnmetExpense > 0 ? formatINR(sim.totalUnmetExpense) : "—"}</div><div className="stat-sub">Life-event expenses the budget couldn't cover</div></Card>
                <Card><div className="stat-label">Left over (saved)</div><div className="stat-value" style={{ fontSize: "1.3rem" }}>{formatINR(sim.endingPool)}</div><div className="stat-sub">Budget beyond what goals needed</div></Card>
              </div>

              <div style={{ marginTop: 14 }}>
                <Callout tone="info">This is a planning simulation using your assumptions, not a forecast or an instruction to move money. Goal allocation is a label, not a transfer.</Callout>
              </div>
            </>
          )}
        </>
      )}

      {showEvent && <AddEventSheet onClose={() => setShowEvent(false)} onAdd={(e) => dispatch({ type: "ADD_LIFE_EVENT", event: e })} />}
    </div>
  );
}

function AddEventSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (e: LifeEvent) => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState(100000);
  const [date, setDate] = useState(todayISO());
  return (
    <Sheet title="Add life event" onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!label || amount <= 0} onClick={() => { onAdd({ id: uid("evt"), label, type, amount, date }); onClose(); }}>Add event</Button>
      </>
    }>
      <TextField label="Label" value={label} onChange={setLabel} placeholder="e.g. Annual bonus, Wedding, Car down payment" />
      <SelectField<"income" | "expense"> label="Type" value={type} onChange={setType} options={[{ value: "income", label: "Income (adds cash)" }, { value: "expense", label: "Expense (uses cash)" }]} />
      <NumberField label="Amount" prefix="₹" value={amount} onChange={setAmount} min={0} />
      <label className="field"><span className="field-label">When</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    </Sheet>
  );
}
