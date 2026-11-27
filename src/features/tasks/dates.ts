// Date helpers for /tasks. Dates are plain "YYYY-MM-DD" strings (no time zone); "today" is the browser's local day.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAY = 86_400_000;

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY);
}

/** Monday of the week containing s. */
export function startOfWeek(s: string): string {
  const d = parseISO(s);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

/** "23 Nov" */
export function fmtShort(s: string): string {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "23 – 29 Nov" or "30 Nov – 6 Des" */
export function fmtRange(a: string, b: string): string {
  const da = parseISO(a);
  const db = parseISO(b);
  if (da.getMonth() === db.getMonth()) return `${da.getDate()} – ${db.getDate()} ${MONTHS[db.getMonth()]}`;
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}

export type DueTone = "overdue" | "soon" | "normal" | "done";

/** Human deadline label + tone, e.g. "Terlambat 2 hari", "Hari ini", "Besok", "3 hari lagi", "12 Des". */
export function dueInfo(due: string | null, done: boolean, today = todayISO()): { label: string; tone: DueTone } | null {
  if (!due) return null;
  if (done) return { label: fmtShort(due), tone: "done" };
  const n = diffDays(today, due);
  if (n < 0) return { label: `Terlambat ${-n} hari`, tone: "overdue" };
  if (n === 0) return { label: "Hari ini", tone: "soon" };
  if (n === 1) return { label: "Besok", tone: "soon" };
  if (n <= 3) return { label: `${n} hari lagi`, tone: "soon" };
  return { label: fmtShort(due), tone: "normal" };
}

export const DUE_COLORS: Record<DueTone, { color: string; bg: string }> = {
  overdue: { color: "#B3261E", bg: "#FCE8E6" },
  soon: { color: "#8E4B00", bg: "#FFF0D6" },
  normal: { color: "#444746", bg: "#F1F3F4" },
  done: { color: "#5F6368", bg: "#F1F3F4" },
};
