import { describe, it, expect } from "vitest";
import { simulateHousehold, HouseholdSimInput } from "./household";
import { round2 } from "./money";

const goal = (over: Partial<HouseholdSimInput["goals"][number]> = {}) => ({
  id: "g", label: "Goal", priority: 1, targetMonth: 12, futureTarget: 120000,
  openingBalance: 0, annualReturn: 0, ...over,
});

describe("household sequential cash-flow simulation (GOAL04)", () => {
  it("a shared budget funds the higher-priority goal first — not both (anti double-count)", () => {
    const res = simulateHousehold({
      monthlyBudget: 10000,
      annualStepUp: 0,
      events: [],
      goals: [
        goal({ id: "A", label: "A", priority: 1 }),
        goal({ id: "B", label: "B", priority: 2 }),
      ],
    });
    const a = res.goals.find((g) => g.id === "A")!;
    const b = res.goals.find((g) => g.id === "B")!;
    expect(round2(a.funded)).toBe(120000);
    expect(round2(a.shortfall)).toBe(0);
    expect(round2(b.funded)).toBe(0);
    expect(round2(b.shortfall)).toBe(120000);
  });

  it("flags over-commitment when first-month required exceeds the budget", () => {
    const res = simulateHousehold({
      monthlyBudget: 10000,
      annualStepUp: 0,
      events: [],
      goals: [goal({ id: "A", priority: 1 }), goal({ id: "B", priority: 2 })],
    });
    expect(res.overcommitted).toBe(true);
    expect(round2(res.firstMonthRequiredTotal)).toBe(20000);
    expect(round2(res.overcommitBy)).toBe(10000);
  });

  it("independent planning overstates funding vs the shared simulation", () => {
    const res = simulateHousehold({
      monthlyBudget: 10000,
      annualStepUp: 0,
      events: [],
      goals: [goal({ id: "A", priority: 1 }), goal({ id: "B", priority: 2 })],
    });
    const b = res.goals.find((g) => g.id === "B")!;
    // Independent view would also fund B (its own 10k/mo), but shared can't.
    expect(b.independentFunded).toBeGreaterThan(b.funded + 1);
    expect(res.sharingReducesAnyGoal).toBe(true);
  });

  it("an income life event lifts a single goal to a higher target", () => {
    const res = simulateHousehold({
      monthlyBudget: 10000,
      annualStepUp: 0,
      events: [{ id: "e", label: "Bonus", month: 6, amount: 60000 }],
      goals: [goal({ id: "A", futureTarget: 180000 })],
    });
    expect(round2(res.goals[0].funded)).toBe(180000);
    expect(round2(res.goals[0].shortfall)).toBe(0);
  });

  it("a spending event is paid before saving and surfaces an unmet expense", () => {
    const res = simulateHousehold({
      monthlyBudget: 10000,
      annualStepUp: 0,
      events: [{ id: "e", label: "Medical", month: 3, amount: -50000 }],
      goals: [goal({ id: "A", targetMonth: 6, futureTarget: 60000 })],
    });
    expect(round2(res.goals[0].funded)).toBe(50000);
    expect(round2(res.goals[0].shortfall)).toBe(10000);
    expect(round2(res.totalUnmetExpense)).toBe(40000);
  });

  it("surplus above a matured goal's target flows into the ending pool", () => {
    const res = simulateHousehold({
      monthlyBudget: 20000,
      annualStepUp: 0,
      events: [],
      goals: [goal({ id: "A", targetMonth: 12, futureTarget: 120000 })],
    });
    // 20k/mo for 12 months = 240k available but only 120k needed; the rest is saved.
    expect(res.goals[0].funded).toBeGreaterThanOrEqual(120000 - 1);
    expect(res.endingPool).toBeGreaterThan(0);
  });

  it("a goal already at its target month matures immediately at its opening balance", () => {
    const res = simulateHousehold({
      monthlyBudget: 0,
      annualStepUp: 0,
      events: [],
      goals: [goal({ id: "A", targetMonth: 0, futureTarget: 50000, openingBalance: 50000 })],
    });
    expect(round2(res.goals[0].funded)).toBe(50000);
    expect(round2(res.goals[0].shortfall)).toBe(0);
  });

  it("dedicated per-goal contributions reduce the shared ask", () => {
    const withDedicated = simulateHousehold({
      monthlyBudget: 10000,
      annualStepUp: 0,
      events: [],
      goals: [
        goal({ id: "A", priority: 1, dedicatedMonthly: 10000 }),
        goal({ id: "B", priority: 2 }),
      ],
    });
    const a = withDedicated.goals.find((g) => g.id === "A")!;
    const b = withDedicated.goals.find((g) => g.id === "B")!;
    // A is fully covered by its own dedicated stream, so the shared budget is free for B.
    expect(round2(a.funded)).toBe(120000);
    expect(round2(b.funded)).toBe(120000);
    expect(round2(a.sharedContributed)).toBe(0);
  });
});
