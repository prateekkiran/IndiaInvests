// Small shared utilities: ids, dates, Indian financial year, hashing.

export function uid(prefix = "id"): string {
  const rnd =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("")
      : Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Display an ISO date-only string as "11 Oct 2026". */
export function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole months between two ISO dates (from -> to), rounded to nearest month, min 0. */
export function monthsBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 0; // keep whole-month index behaviour
  return Math.max(0, months);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00").getTime();
  const b = new Date(toISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

/** Indian FY label for an ISO date, e.g. "FY 2026-27" (FY starts 1 Apr). */
export function fiscalYearLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  return `FY ${startYear}-${endYY}`;
}

/** Add months to an ISO date, returning ISO date-only. */
export function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** SHA-256 hex of an ArrayBuffer (used for file-level dedupe). */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mask a folio/account number, preserving leading zeros as a string. */
export function maskNumber(raw: string): string {
  const s = String(raw).trim();
  if (s.length <= 4) return "••" + s;
  return "••••" + s.slice(-4);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
