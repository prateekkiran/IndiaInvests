// Turns calculator inputs into a projection, chart series, result table and a
// plain-language formula explanation. Used by the Calculators and Explore
// screens so the maths is identical everywhere.

import { ScenarioInputs } from "../types";
import {
  monthlyRateFromAnnual,
  project,
  futureGoalValue,
  realValue,
  realAnnualReturn,
  requiredEndMonthSIP,
  lumpSumFV,
  MONTHS_PER_YEAR,
} from "./finance";
import { GrowthPoint } from "../components/Charts";
import { formatINR, formatPercent, round2 } from "./money";

export interface ScenarioResult {
  months: number;
  monthlyRate: number;
  series: GrowthPoint[];
  finalValue: number;
  contributed: number;
  growth: number;
  realFinalValue: number;
  headline: Array<{ label: string; value: string; emphasise?: boolean }>;
  table: Array<{ period: string; contributed: number; growth: number; value: number }>;
  formula: string;
  notes: string[];
  requiredContribution?: number;
  immediateGap?: number | null;
  futureTarget?: number;
}

function yearlySeriesFromRows(
  rows: ReturnType<typeof project>,
  opening: number
): GrowthPoint[] {
  const pts: GrowthPoint[] = [{ label: "Now", contributed: opening, value: opening }];
  rows.forEach((r) => {
    if (r.month % MONTHS_PER_YEAR === 0 || r.month === rows.length) {
      pts.push({
        label: `Yr ${Math.round(r.month / MONTHS_PER_YEAR) || (r.month / MONTHS_PER_YEAR).toFixed(1)}`,
        contributed: opening + r.cumulativeContribution,
        value: r.closingBalance,
        projected: true,
      });
    }
  });
  return pts;
}

export function runScenario(inputs: ScenarioInputs): ScenarioResult {
  const months = Math.round(inputs.years * MONTHS_PER_YEAR);
  const i = monthlyRateFromAnnual(inputs.annualReturn);
  const notes: string[] = [];

  const pauses = (inputs.pauses ?? []).filter((m) => m >= 1 && m <= months);
  const oneTime = new Map<number, number>();
  for (const o of inputs.oneTime ?? []) if (o.month >= 1 && o.month <= months) oneTime.set(o.month, o.amount);

  if (inputs.kind === "goal_future") {
    const todayAmt = inputs.goalAmountToday ?? 0;
    const future = futureGoalValue(todayAmt, inputs.annualInflation, months);
    const series: GrowthPoint[] = [];
    for (let yr = 0; yr <= inputs.years; yr++) {
      const v = futureGoalValue(todayAmt, inputs.annualInflation, yr * MONTHS_PER_YEAR);
      series.push({ label: yr === 0 ? "Now" : `Yr ${yr}`, contributed: todayAmt, value: v, projected: yr > 0 });
    }
    return {
      months,
      monthlyRate: i,
      series,
      finalValue: future,
      contributed: todayAmt,
      growth: future - todayAmt,
      realFinalValue: todayAmt,
      headline: [
        { label: "Goal today", value: formatINR(todayAmt) },
        { label: `Goal in ${inputs.years} years (future rupees)`, value: formatINR(future), emphasise: true },
        { label: "Inflation uplift", value: formatINR(future - todayAmt) },
      ],
      table: series.map((s) => ({ period: s.label, contributed: s.contributed, growth: s.value - s.contributed, value: s.value })),
      formula: `Future goal G = ₹${round2(todayAmt)} × (1 + ${formatPercent(inputs.annualInflation)})^(${months}/12) (F06). This is what today's amount must grow to just to keep the same buying power.`,
      notes: ["This is a cost projection, not an investment return. It shows how much more you'll need later."],
      futureTarget: future,
    };
  }

  if (inputs.kind === "inflation") {
    const amount = inputs.lumpSum ?? inputs.goalAmountToday ?? 0;
    const nominalFV = lumpSumFV(amount, i, months);
    const realFV = realValue(nominalFV, inputs.annualInflation, months);
    const realRet = realAnnualReturn(inputs.annualReturn, inputs.annualInflation);
    const series: GrowthPoint[] = [];
    for (let yr = 0; yr <= inputs.years; yr++) {
      const nom = lumpSumFV(amount, i, yr * MONTHS_PER_YEAR);
      series.push({ label: yr === 0 ? "Now" : `Yr ${yr}`, contributed: realValue(nom, inputs.annualInflation, yr * MONTHS_PER_YEAR), value: nom, projected: yr > 0 });
    }
    return {
      months,
      monthlyRate: i,
      series,
      finalValue: nominalFV,
      contributed: amount,
      growth: nominalFV - amount,
      realFinalValue: realFV,
      headline: [
        { label: "Nominal value", value: formatINR(nominalFV), emphasise: true },
        { label: "In today's money (real)", value: formatINR(realFV) },
        { label: "Real annual return", value: formatPercent(realRet) },
      ],
      table: series.map((s) => ({ period: s.label, contributed: s.contributed, growth: s.value - s.contributed, value: s.value })),
      formula: `Real value = nominal / (1 + inflation)^(n/12) (F07). Real annual return = (1 + ${formatPercent(inputs.annualReturn)}) / (1 + ${formatPercent(inputs.annualInflation)}) − 1 = ${formatPercent(realRet)}.`,
      notes: ["The lighter band is spending power in today's rupees — what the money will actually buy."],
    };
  }

  if (inputs.kind === "required_sip") {
    const todayAmt = inputs.goalAmountToday ?? 0;
    const future = inputs.goalAmountBasis === "future" ? todayAmt : futureGoalValue(todayAmt, inputs.annualInflation, months);
    const opening = inputs.openingBalance ?? 0;
    const req = requiredEndMonthSIP(future, opening, i, months);
    const rows = project({ openingBalance: opening, months, monthlyRate: i, baseContribution: req.requiredContribution, timing: inputs.timing });
    const series = yearlySeriesFromRows(rows, opening);
    const final = rows.length ? rows[rows.length - 1].closingBalance : opening;
    const contributed = opening + (rows.length ? rows[rows.length - 1].cumulativeContribution : 0);
    if (req.immediateGap != null) notes.push(`With no time to invest, there's an immediate gap of ${formatINR(req.immediateGap)}.`);
    return {
      months,
      monthlyRate: i,
      series,
      finalValue: final,
      contributed,
      growth: final - contributed,
      realFinalValue: realValue(final, inputs.annualInflation, months),
      headline: [
        { label: "Required monthly SIP", value: formatINR(req.requiredContribution), emphasise: true },
        { label: "Future goal", value: formatINR(future) },
        { label: "From existing balance", value: formatINR(opening) },
      ],
      table: series.map((s) => ({ period: s.label, contributed: s.contributed, growth: s.value - s.contributed, value: s.value })),
      formula: `Required end-of-month SIP = max(0, (G − PV·(1+i)^n) / A), A = ((1+i)^n − 1)/i (F08). Monthly rate i = (1 + ${formatPercent(inputs.annualReturn)})^(1/12) − 1 = ${formatPercent(i, 3)}.`,
      notes,
      requiredContribution: req.requiredContribution,
      immediateGap: req.immediateGap,
      futureTarget: future,
    };
  }

  // sip / lumpsum / stepup -> projection
  const opening = inputs.kind === "lumpsum" ? inputs.lumpSum ?? 0 : inputs.openingBalance ?? 0;
  const base = inputs.kind === "lumpsum" ? 0 : inputs.monthlyContribution ?? 0;
  const stepUp = inputs.kind === "stepup" ? inputs.annualStepUp ?? 0 : 0;

  const rows = project({
    openingBalance: opening,
    months,
    monthlyRate: i,
    baseContribution: base,
    timing: inputs.timing,
    annualStepUp: stepUp,
    pauses,
    oneTime,
  });
  const final = rows.length ? rows[rows.length - 1].closingBalance : opening;
  const contributed = opening + (rows.length ? rows[rows.length - 1].cumulativeContribution : 0);
  const series = yearlySeriesFromRows(rows, opening);

  if (pauses.length) notes.push(`${pauses.length} contribution month(s) paused.`);
  if (oneTime.size) notes.push(`${oneTime.size} one-time addition(s) included.`);
  if (inputs.annualReturn <= 0) notes.push("Return assumption is zero or negative — growth may be flat or declining by design.");

  const headline = [
    { label: "Projected value", value: formatINR(final), emphasise: true },
    { label: "You contribute", value: formatINR(contributed) },
    { label: "Growth", value: formatINR(final - contributed) },
    { label: "In today's money", value: formatINR(realValue(final, inputs.annualInflation, months)) },
  ];

  const formulaMap: Record<string, string> = {
    sip: `End-of-month SIP future value uses FV = P·((1+i)^n − 1)/i, with i = (1+${formatPercent(inputs.annualReturn)})^(1/12) − 1 = ${formatPercent(i, 3)} (F01, F03). ${inputs.timing === "begin" ? "Begin-of-month multiplies by (1+i)." : ""}`,
    lumpsum: `Lump sum future value FV = PV·(1+i)^n, i = (1+${formatPercent(inputs.annualReturn)})^(1/12) − 1 = ${formatPercent(i, 3)} (F01, F02).`,
    stepup: `Step-up SIP: contribution rises ${formatPercent(stepUp)} every 12 months (first step at month 13), each month compounded via the event engine (F04, F05).`,
  };

  return {
    months,
    monthlyRate: i,
    series,
    finalValue: final,
    contributed,
    growth: final - contributed,
    realFinalValue: realValue(final, inputs.annualInflation, months),
    headline,
    table: series.map((s) => ({ period: s.label, contributed: s.contributed, growth: s.value - s.contributed, value: s.value })),
    formula: formulaMap[inputs.kind] ?? "",
    notes,
  };
}
