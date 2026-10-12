// Branded, printable plan report (REF/EXP). Builds a fully self-contained HTML
// document — inline styles, inline SVG, no external assets or scripts — and
// opens it in a new window for the browser's native "Save as PDF". No PDF
// library dependency; works offline and within the app's tight CSP.
//
// Every figure carries its valuation date and coverage caveats, and the report
// always ends with the educational-only disclaimer the PRD requires.

import { AppState } from "../types";
import { portfolioSummary, portfolioPerformance } from "../store/portfolio";
import { computeGoal } from "../store/goals";
import { formatINR, formatINRCompact, formatPercent, groupIndian } from "../engine/money";
import { fmtDate, todayISO } from "../util";
import { AssetClass } from "../types";

const CLASS_LABEL: Record<AssetClass, string> = {
  equity_mf: "Equity funds", debt_mf: "Debt funds", hybrid_mf: "Hybrid funds", other_mf: "Other funds",
  cash: "Cash", fd_rd: "FD / RD", epf: "EPF", ppf: "PPF", nps: "NPS", gold: "Gold", property: "Property", other: "Other",
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** Horizontal stacked allocation bar as inline SVG. */
function allocationSvg(rows: Array<{ label: string; value: number }>): string {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (total <= 0) return "";
  const palette = ["#b4542f", "#4a5a7c", "#c87a5c", "#6f80a4", "#a66a1f", "#7b7a72"];
  let x = 0;
  const W = 520, H = 22;
  const segs = rows.map((r, i) => {
    const w = (r.value / total) * W;
    const rect = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}" fill="${palette[i % palette.length]}"/>`;
    x += w;
    return rect;
  }).join("");
  const legend = rows.map((r, i) =>
    `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#4c4b45">
       <span style="width:9px;height:9px;border-radius:2px;background:${palette[i % palette.length]};display:inline-block"></span>
       ${esc(r.label)} — ${formatINRCompact(r.value)} (${((r.value / total) * 100).toFixed(1)}%)
     </div>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="border-radius:6px;overflow:hidden">${segs}</svg>
          <div style="display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:10px">${legend}</div>`;
}

export function buildPlanReportHtml(state: AppState): string {
  const summary = portfolioSummary(state);
  const perf = portfolioPerformance(state);
  const owner = state.owners[0]?.label ?? "Investor";
  const today = fmtDate(todayISO());
  const netWorth = summary.valuedTotal - summary.manualLiabilitiesTotal;

  const alloc = summary.byAssetClass.map((a) => ({ label: CLASS_LABEL[a.assetClass], value: a.value }));

  const goalRows = state.goals.map((g) => {
    const c = computeGoal(state, g);
    const pct = Math.round(c.fundingRatio * 100);
    return `<tr>
      <td>${esc(g.label)}</td>
      <td>${fmtDate(g.targetDate)}</td>
      <td class="num">${formatINRCompact(c.futureTarget)}</td>
      <td class="num">${formatINRCompact(c.projectedValue)}</td>
      <td class="num">${pct}%</td>
      <td class="num">${c.shortfallFuture > 0 ? formatINRCompact(c.shortfallFuture) : "—"}</td>
    </tr>`;
  }).join("");

  const perfRow = perf.available && perf.xirr?.status === "ok"
    ? `<tr><td>Portfolio XIRR (since inception)</td><td class="num">${formatPercent(perf.xirr.rate!)}</td></tr>
       <tr><td>Net invested</td><td class="num">${formatINR(perf.invested!)}</td></tr>
       <tr><td>Current value</td><td class="num">${formatINR(perf.currentValue!)}</td></tr>`
    : `<tr><td colspan="2" class="muted">${esc(perf.reason ?? "Performance not available for this portfolio.")}</td></tr>`;

  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8">
<title>Financial Plan — ${esc(owner)} — ${today}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #141413; margin: 0; line-height: 1.5; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .cover { background: linear-gradient(135deg,#5c2f1c 0%,#b4542f 46%,#d08a5f 100%); color:#fff; padding:48px 40px; border-radius:16px; margin-bottom:28px; }
  .cover .mark { width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.92);margin-bottom:16px }
  .cover h1 { font-size:28px;margin:0 0 6px;letter-spacing:-.02em }
  .cover .sub { opacity:.9;font-size:14px;margin:0 }
  .eyebrow { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7b7a72;margin:0 0 10px }
  section { margin-bottom:26px; break-inside: avoid; }
  h2 { font-size:16px;margin:0 0 12px;letter-spacing:-.01em }
  .cards { display:flex;gap:14px;flex-wrap:wrap }
  .c { flex:1;min-width:150px;border:1px solid #e5e1d7;border-radius:12px;padding:14px 16px }
  .c .l { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7b7a72 }
  .c .v { font-size:20px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:4px }
  table { width:100%;border-collapse:collapse;font-size:12.5px }
  th,td { text-align:left;padding:8px 10px;border-bottom:1px solid #e5e1d7 }
  th { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#7b7a72;font-weight:500 }
  td.num, th.num { text-align:right;font-variant-numeric:tabular-nums }
  .muted { color:#7b7a72 }
  .disclaimer { border:1px solid #e5e1d7;border-radius:12px;padding:16px 18px;font-size:11.5px;color:#4c4b45;background:#faf9f5 }
  .foot { margin-top:22px;font-size:10.5px;color:#857e73;text-align:center }
  @media print { .noprint { display:none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  .noprint { position:fixed;top:14px;right:14px }
  .btn { background:#b4542f;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer }
</style></head>
<body>
  <div class="noprint"><button class="btn" onclick="window.print()">Save as PDF / Print</button></div>

  <div class="cover">
    <div class="mark"></div>
    <h1>Financial Plan</h1>
    <p class="sub">${esc(owner)} · Prepared ${today} · India Investment Journey</p>
  </div>

  <section>
    <p class="eyebrow">Position summary</p>
    <div class="cards">
      <div class="c"><div class="l">Valued assets</div><div class="v">${formatINR(summary.valuedTotal)}</div></div>
      <div class="c"><div class="l">Liabilities</div><div class="v">${formatINR(summary.manualLiabilitiesTotal)}</div></div>
      <div class="c"><div class="l">Net worth</div><div class="v">${formatINR(netWorth)}</div></div>
    </div>
    <p class="muted" style="font-size:11.5px;margin-top:10px">
      ${summary.valuationDateMin ? `Latest recorded values span ${fmtDate(summary.valuationDateMin)} – ${fmtDate(summary.valuationDateMax)}. ` : ""}
      ${summary.unvaluedCount > 0 ? `${summary.unvaluedCount} holding(s) are unpriced and excluded from the valued total. ` : ""}
      These are latest recorded values, not a single point-in-time valuation.
    </p>
  </section>

  ${alloc.length ? `<section>
    <p class="eyebrow">Asset allocation</p>
    ${allocationSvg(alloc)}
  </section>` : ""}

  <section>
    <p class="eyebrow">Returns</p>
    <table><tbody>${perfRow}</tbody></table>
    <p class="muted" style="font-size:11px;margin-top:8px">XIRR is a cash-flow return and is not directly comparable to an index CAGR.</p>
  </section>

  ${state.goals.length ? `<section>
    <p class="eyebrow">Goals</p>
    <table>
      <thead><tr><th>Goal</th><th>Target date</th><th class="num">Future target</th><th class="num">Projected</th><th class="num">Funded</th><th class="num">Shortfall</th></tr></thead>
      <tbody>${goalRows}</tbody>
    </table>
    <p class="muted" style="font-size:11px;margin-top:8px">Projected values compound your own assumed returns to each target date. Funded % = projected ÷ future target.</p>
  </section>` : ""}

  <section>
    <p class="eyebrow">Assumptions</p>
    <table><tbody>
      <tr><td>Default assumed return</td><td class="num">${formatPercent(state.preferences.defaultAnnualReturn)}</td></tr>
      <tr><td>Default inflation</td><td class="num">${formatPercent(state.preferences.defaultInflation)}</td></tr>
      <tr><td>Currency / basis</td><td class="num">INR · Indian FY (Apr–Mar)</td></tr>
    </tbody></table>
  </section>

  <section>
    <div class="disclaimer">
      <strong>Important.</strong> This plan is an educational illustration generated on your own device from data you entered or imported.
      It is not investment advice, not a recommendation to buy or sell any product, and not a guarantee of returns. Projections use the
      assumptions shown and are explicitly pre-tax. Figures depend on the completeness of imported data; unpriced or stale holdings are
      flagged above. Verify against your official statements before making decisions.
    </div>
    <p class="foot">Generated on-device · No data left your browser to produce this report · India Investment Journey</p>
  </section>
</body></html>`;
}

/** Open the report in a new window for printing / saving as PDF. */
export function openPlanReport(state: AppState): boolean {
  const html = buildPlanReportHtml(state);
  const w = window.open("", "_blank");
  if (!w) return false; // popup blocked — caller shows a fallback
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
