// Gemeinsame Badge-Logik – läuft im Browser (Erfolge-Tab) UND
// serverseitig (Push-Benachrichtigungen). Keine Supabase-Imports hier!

import { Challenge, Rule, addDays, parseISODate, pointsFor, toISODate } from "./types";

export type CheckinRow = { rule_id: string; date: string; quantity?: number };

export type Badge = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
};

function longestStreak(dates: Set<string>): number {
  let best = 0;
  for (const d of Array.from(dates)) {
    const prev = toISODate(addDays(parseISODate(d), -1));
    if (dates.has(prev)) continue; // nur Serienstarts prüfen
    let len = 1;
    let cur = parseISODate(d);
    while (dates.has(toISODate(addDays(cur, 1)))) {
      len++;
      cur = addDays(cur, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}

export function computeBadges(
  challenge: Challenge,
  rules: Rule[],
  checkins: CheckinRow[]
): Badge[] {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const byKey = (key: string) =>
    checkins.filter((c) => ruleById.get(c.rule_id)?.key === key);

  const noAlcoholDates = new Set(byKey("no_alcohol").map((c) => c.date));
  const streak = longestStreak(noAlcoholDates);
  const total = checkins.reduce((s, c) => {
    const r = ruleById.get(c.rule_id);
    return r ? s + pointsFor(r, c.quantity ?? 1) : s;
  }, 0);

  const dailyPositive = rules.filter((r) => r.points > 0 && !r.weekend_only);
  const byDate = new Map<string, Set<string>>();
  for (const c of checkins) {
    const set = byDate.get(c.date) ?? new Set<string>();
    set.add(c.rule_id);
    byDate.set(c.date, set);
  }
  const perfectDay =
    dailyPositive.length > 0 &&
    Array.from(byDate.values()).some((set) =>
      dailyPositive.every((r) => set.has(r.id))
    );

  const half = addDays(
    parseISODate(challenge.start_date),
    Math.floor((challenge.weeks * 7) / 2)
  );
  const halfwayReached = new Date() >= half && checkins.length > 0;

  return [
    { key: "first_checkin", icon: "🎯", title: "Los geht's", desc: "Erster Check-in", unlocked: checkins.length > 0 },
    { key: "first_dry_day", icon: "🍀", title: "Erster trockener Tag", desc: "1× kein Alkohol", unlocked: noAlcoholDates.size >= 1 },
    { key: "perfect_weekend", icon: "🏖", title: "Perfektes Wochenende", desc: "Ganzes Wochenende alkoholfrei", unlocked: byKey("weekend_free").length >= 1 },
    { key: "perfect_day", icon: "⭐", title: "Perfekter Tag", desc: "Alle Tagesaufgaben an einem Tag", unlocked: perfectDay },
    { key: "streak_7", icon: "🧊", title: "Eine Woche trocken", desc: "7 Tage Streak", unlocked: streak >= 7 },
    { key: "streak_14", icon: "🔥", title: "Zwei Wochen trocken", desc: "14 Tage Streak", unlocked: streak >= 14 },
    { key: "streak_30", icon: "🏆", title: "Ein Monat trocken", desc: "30 Tage Streak", unlocked: streak >= 30 },
    { key: "sport_10", icon: "🚴", title: "Sportskanone", desc: "10× Sport eingetragen", unlocked: byKey("sport").length >= 10 },
    { key: "dry_25", icon: "🗓", title: "25 trockene Tage", desc: "25 alkoholfreie Tage gesamt", unlocked: noAlcoholDates.size >= 25 },
    { key: "dry_50", icon: "🥇", title: "50 trockene Tage", desc: "50 alkoholfreie Tage gesamt", unlocked: noAlcoholDates.size >= 50 },
    { key: "points_100", icon: "💯", title: "Punktejäger", desc: "100 Punkte gesamt", unlocked: total >= 100 },
    { key: "halfway", icon: "🧭", title: "Halbzeit", desc: "Bis zur Challenge-Hälfte dabei", unlocked: halfwayReached },
  ];
}
