export type Challenge = {
  id: string;
  name: string;
  owner_id: string;
  start_date: string; // yyyy-mm-dd
  weeks: number;
  invite_code: string;
};

export type Rule = {
  id: string;
  challenge_id: string;
  key: string;
  label: string;
  points: number;
  weekend_only: boolean;
  sort: number;
};

export type Checkin = {
  id: string;
  challenge_id: string;
  user_id: string;
  rule_id: string;
  date: string;
};

export type Profile = {
  id: string;
  display_name: string;
};

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 0-basierter Wochen-Index eines Datums relativ zum Challenge-Start */
export function weekIndex(date: string, startDate: string): number {
  const ms = parseISODate(date).getTime() - parseISODate(startDate).getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Punkte für einen Check-in.
 * Sport zählt degressiv: erste Stunde = Regel-Punkte, jede weitere Stunde +0,5.
 * Alle anderen Regeln: Punkte × Menge.
 */
export function pointsFor(
  rule: { key: string; points: number },
  quantity: number
): number {
  const q = Math.max(1, quantity ?? 1);
  if (rule.key === "sport") return rule.points + (q - 1) * 0.5;
  return rule.points * q;
}

/** Punkte hübsch formatieren: +2, -5, +2,5 */
export function fmtPoints(p: number): string {
  const s = Number.isInteger(p) ? String(Math.abs(p)) : Math.abs(p).toFixed(1).replace(".", ",");
  return p > 0 ? `+${s}` : p < 0 ? `-${s}` : "0";
}
