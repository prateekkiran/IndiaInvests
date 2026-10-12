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
  drawdownProjection,
  sequenceStress,
  fdMaturity,
  rdMaturityGeneric,
  amortize,
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
  /** Relabels the two chart series for non-accumulation scenarios. */
  legend?: { value: string; contributed: string };
  /** Relabels the result-table columns. */
  tableColumns?: { period: string; contributed: string; growth: string; value: string };
  /** False for drawdown/loan where the nominal/real toggle doesn't apply. */
  isAccumulation?: boolean;
  /** First month a withdrawal couldn't be met / loan payoff month, when relevant. */
  depletionMonth?: number | null;
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

  if (inputs.kind === "swp" || inputs.kind === "retirement") {
    const corpus = inputs.openingBalance ?? inputs.lumpSum ?? 0;
    const withdrawal = inputs.withdrawalMonthly ?? 0;
    const wGrowth = inputs.withdrawalInflates ? inputs.annualInflation : 0;
    const pension = inputs.kind === "retirement" ? inputs.pensionMonthly ?? 0 : 0;
    const d = drawdownProjection({
      openingCorpus: corpus,
      months,
      annualReturn: inputs.annualReturn,
      firstMonthlyWithdrawal: withdrawal,
      annualWithdrawalGrowth: wGrowth,
      monthlyPension: pension,
      annualPensionGrowth: pension ? wGrowth : 0,
      timing: inputs.timing,
    });
    const series: GrowthPoint[] = [{ label: "Now", contributed: 0, value: corpus, projected: true }];
    const drawTable: Array<{ period: string; contributed: number; growth: number; value: number }> = [
      { period: "Now", contributed: 0, growth: 0, value: corpus },
    ];
    let cumGrowth = 0;
    d.rows.forEach((r) => {
      cumGrowth += r.growth;
      if (r.month % MONTHS_PER_YEAR === 0 || r.month === d.rows.length) {
        series.push({ label: `Yr ${Math.round(r.month / MONTHS_PER_YEAR) || (r.month / MONTHS_PER_YEAR).toFixed(1)}`, contributed: r.cumulativeWithdrawalPaid, value: r.closingBalance, projected: true });
        drawTable.push({ period: `Yr ${Math.round(r.month / MONTHS_PER_YEAR) || (r.month / MONTHS_PER_YEAR).toFixed(1)}`, contributed: r.cumulativeWithdrawalPaid, growth: cumGrowth, value: r.closingBalance });
      }
    });
    const depletes = d.depletionMonth != null;
    if (depletes) notes.push(`At this withdrawal, the corpus runs out in month ${d.depletionMonth} (around year ${Math.ceil(d.depletionMonth! / 12)}). ${formatINR(d.totalUnmet)} of planned withdrawals could not be met.`);
    else notes.push(`The corpus lasts the full ${inputs.years} years, ending at ${formatINR(d.endingBalance)}.`);
    if (inputs.kind === "retirement") {
      const s = sequenceStress(corpus, months, inputs.annualReturn, withdrawal - pension > 0 ? withdrawal - pension : withdrawal, wGrowth);
      const bad = s.badEarly.depletionMonth;
      const good = s.goodEarly.depletionMonth;
      if (bad != null && (good == null || bad < good)) {
        notes.push(`Sequence-of-returns risk: with the SAME average return but poor early years, the corpus would deplete around month ${bad}${good != null ? ` instead of month ${good}` : ""}. Average-return planning hides this.`);
      } else {
        notes.push("Sequence-of-returns check: even with poor early years at the same average return, the plan held up over this horizon.");
      }
    }
    return {
      months,
      monthlyRate: monthlyRateFromAnnual(inputs.annualReturn),
      series,
      finalValue: d.endingBalance,
      contributed: d.totalWithdrawnPaid,
      growth: d.rows.reduce((a, r) => a + r.growth, 0),
      realFinalValue: realValue(d.endingBalance, inputs.annualInflation, months),
      headline: [
        { label: depletes ? "Runs out in" : "Ending balance", value: depletes ? `Month ${d.depletionMonth}` : formatINR(d.endingBalance), emphasise: true },
        { label: "Total withdrawn", value: formatINR(d.totalWithdrawnPaid) },
        { label: inputs.kind === "retirement" ? "First monthly expense" : "Monthly withdrawal", value: formatINR(withdrawal) },
        { label: "Starting corpus", value: formatINR(corpus) },
      ],
      table: drawTable,
      formula: `Each month the balance earns i = (1+${formatPercent(inputs.annualReturn)})^(1/12)−1, then the withdrawal is taken${wGrowth ? ` (rising ${formatPercent(wGrowth)}/yr with inflation)` : ""}${pension ? ` net of ${formatINR(pension)} pension` : ""}. Withdrawals stop at the available balance and any shortfall is reported (F05).`,
      notes,
      legend: { value: "Balance remaining", contributed: "Withdrawn (cumulative)" },
      tableColumns: { period: "Period", contributed: "Withdrawn", growth: "Interest earned", value: "Balance" },
      isAccumulation: false,
      depletionMonth: d.depletionMonth,
    };
  }

  if (inputs.kind === "fd" || inputs.kind === "rd") {
    const rate = inputs.nominalRate ?? inputs.annualReturn;
    const series: GrowthPoint[] = [];
    if (inputs.kind === "fd") {
      const principal = inputs.principal ?? inputs.lumpSum ?? 0;
      const m = inputs.compoundingPerYear ?? 4;
      for (let yr = 0; yr <= inputs.years; yr++) {
        const v = fdMaturity(principal, rate, yr, m).maturity;
        series.push({ label: yr === 0 ? "Now" : `Yr ${yr}`, contributed: principal, value: v, projected: yr > 0 });
      }
      const r = fdMaturity(principal, rate, inputs.years, m);
      return {
        months, monthlyRate: 0, series,
        finalValue: r.maturity, contributed: principal, growth: r.interest,
        realFinalValue: realValue(r.maturity, inputs.annualInflation, months),
        headline: [
          { label: "Maturity value", value: formatINR(r.maturity), emphasise: true },
          { label: "Interest earned", value: formatINR(r.interest) },
          { label: "Effective yield", value: formatPercent(r.effectiveYield) },
          { label: "Principal", value: formatINR(principal) },
        ],
        table: series.map((s) => ({ period: s.label, contributed: s.contributed, growth: s.value - s.contributed, value: s.value })),
        formula: `Generic compound interest: maturity = P·(1 + r/m)^(m·years), r = ${formatPercent(rate)} nominal, m = ${m} compoundings/year. This is a generic tool, not a product-specific FD quote.`,
        notes: ["Real bank FDs may use a different compounding basis; confirm with your provider."],
        legend: { value: "Maturity value", contributed: "Principal" },
        tableColumns: { period: "Period", contributed: "Principal", growth: "Interest", value: "Value" },
        isAccumulation: true,
      };
    } else {
      const monthly = inputs.monthlyContribution ?? 0;
      for (let yr = 0; yr <= inputs.years; yr++) {
        const v = rdMaturityGeneric(monthly, rate, yr * MONTHS_PER_YEAR).maturity;
        series.push({ label: yr === 0 ? "Now" : `Yr ${yr}`, contributed: monthly * yr * MONTHS_PER_YEAR, value: v, projected: yr > 0 });
      }
      const r = rdMaturityGeneric(monthly, rate, months);
      return {
        months, monthlyRate: rate / MONTHS_PER_YEAR, series,
        finalValue: r.maturity, contributed: r.deposited, growth: r.interest,
        realFinalValue: realValue(r.maturity, inputs.annualInflation, months),
        headline: [
          { label: "Maturity value", value: formatINR(r.maturity), emphasise: true },
          { label: "Total deposited", value: formatINR(r.deposited) },
          { label: "Interest earned", value: formatINR(r.interest) },
          { label: "Monthly deposit", value: formatINR(monthly) },
        ],
        table: series.map((s) => ({ period: s.label, contributed: s.contributed, growth: s.value - s.contributed, value: s.value })),
        formula: `Generic recurring deposit: level monthly deposits compounded monthly at r/12 (r = ${formatPercent(rate)} nominal). Generic tool — real RDs often compound quarterly.`,
        notes: ["Labelled generic; a bank's RD maturity may differ slightly."],
        legend: { value: "Maturity value", contributed: "Deposited" },
        tableColumns: { period: "Period", contributed: "Deposited", growth: "Interest", value: "Value" },
        isAccumulation: true,
      };
    }
  }

  if (inputs.kind === "loan") {
    const principal = inputs.principal ?? 0;
    const rate = inputs.nominalRate ?? inputs.annualReturn;
    const tenureMonths = months;
    const extra = inputs.extraPrepay ?? 0;
    const a = amortize(principal, rate, tenureMonths, extra);
    const series: GrowthPoint[] = [{ label: "Now", contributed: 0, value: principal, projected: true }];
    const loanTable: Array<{ period: string; contributed: number; growth: number; value: number }> = [
      { period: "Now", contributed: 0, growth: 0, value: principal },
    ];
    let cumInterest = 0;
    a.rows.forEach((r) => {
      cumInterest += r.interest;
      if (r.month % MONTHS_PER_YEAR === 0 || r.month === a.rows.length) {
        series.push({ label: `Yr ${Math.round(r.month / MONTHS_PER_YEAR) || (r.month / MONTHS_PER_YEAR).toFixed(1)}`, contributed: principal - r.balance, value: r.balance, projected: true });
        loanTable.push({ period: `Yr ${Math.round(r.month / MONTHS_PER_YEAR) || (r.month / MONTHS_PER_YEAR).toFixed(1)}`, contributed: principal - r.balance, growth: cumInterest, value: r.balance });
      }
    });
    if (extra > 0 && a.monthsSaved > 0) notes.push(`Prepaying ${formatINR(extra)}/month clears the loan in ${a.payoffMonth} months — ${a.monthsSaved} months early.`);
    notes.push(`Loans use the market convention monthly rate = ${formatPercent(rate)} ÷ 12, which differs from the effective-rate basis used for investments.`);
    return {
      months: tenureMonths,
      monthlyRate: rate / MONTHS_PER_YEAR,
      series,
      finalValue: 0,
      contributed: principal,
      growth: a.totalInterest,
      realFinalValue: 0,
      headline: [
        { label: "Monthly EMI", value: formatINR(a.baseEmi), emphasise: true },
        { label: "Total interest", value: formatINR(a.totalInterest) },
        { label: "Total paid", value: formatINR(a.totalPaid) },
        { label: extra > 0 ? "Payoff (months)" : "Tenure (months)", value: `${a.payoffMonth}` },
      ],
      table: loanTable,
      formula: `EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = ${formatPercent(rate)}/12, n = ${tenureMonths} (F14). Interest each month = balance·r; the rest reduces principal.`,
      notes,
      legend: { value: "Balance outstanding", contributed: "Principal paid" },
      tableColumns: { period: "Period", contributed: "Principal paid", growth: "Interest paid", value: "Balance" },
      isAccumulation: false,
      depletionMonth: a.payoffMonth,
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
