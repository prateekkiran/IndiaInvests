// Money, units and NAV precision helpers.
//
// JavaScript numbers are IEEE-754 doubles. The PRD requires that we preserve
// source precision and round only at display time, with checked residuals for
// iterative solvers. We therefore keep raw numbers through the math and apply
// explicit, documented rounding at well-defined precisions.

export const MONEY_DP = 2; // INR rendered to 2 decimals by default
export const UNIT_DP = 4; // MF units commonly carry 3-4 decimals
export const NAV_DP = 4; // NAVs commonly carry 4 decimals
export const RATE_DISPLAY_DP = 2; // percentages shown to 2 decimals

/** Round half-away-from-zero at a given decimal precision, robust to float noise. */
export function roundTo(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, dp);
  // Add a tiny epsilon in the value's own scale to counter 1.005-style float noise.
  const scaled = value * factor;
  const eps = Math.sign(scaled) * 1e-8;
  return Math.round(scaled + eps) / factor;
}

export const round2 = (v: number) => roundTo(v, MONEY_DP);
export const roundUnits = (v: number) => roundTo(v, UNIT_DP);
export const roundNav = (v: number) => roundTo(v, NAV_DP);

/** Indian digit grouping (e.g. 12,34,567.89). Returns a plain grouped string. */
export function groupIndian(value: number, dp = MONEY_DP): string {
  if (!Number.isFinite(value)) return "—";
  const neg = value < 0;
  const fixed = Math.abs(value).toFixed(dp);
  const [intPart, decPart] = fixed.split(".");
  let out = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return (neg ? "-" : "") + out + (dp > 0 && decPart !== undefined ? "." + decPart : "");
}

/** Format as INR with the ₹ symbol and Indian grouping. */
export function formatINR(value: number, dp = MONEY_DP): string {
  if (!Number.isFinite(value)) return "—";
  return "₹" + groupIndian(value, dp);
}

/** Compact INR for dense cards: ₹1.23 L / ₹4.56 Cr while keeping precision available on hover. */
export function formatINRCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${groupIndian(abs, 0)}`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatPercent(fraction: number, dp = RATE_DISPLAY_DP): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(dp)}%`;
}

/** Parse a user/CSV string into a number, tolerating ₹, commas and spaces. */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/[₹,\s]/g, "").replace(/[(](.+)[)]/, "-$1");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
