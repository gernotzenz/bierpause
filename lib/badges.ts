// Gemeinsame Badge-Logik – läuft im Browser (Erfolge-Tab) UND
// serverseitig (Push-Benachrichtigungen). Keine Supabase-Imports hier!

import {
  Challenge,
  Rule,
  addDays,
  parseISODate,
  pointsFor,
  toISODate,
  weekIndex,
} from "./types";

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

  // Sport-Auswertungen
  const sportCheckins = byKey("sport");
  const sportDates = new Set(sportCheckins.map((c) => c.date));
  const bigRide = sportCheckins.some((c) => (c.quantity ?? 1) >= 3);

  // Wochen-Auswertungen (Datum → Challenge-Woche)
  const weekOf = (d: string) => weekIndex(d, challenge.start_date);
  const dryPerWeek = new Map<number, number>();
  for (const d of Array.from(noAlcoholDates)) {
    const w = weekOf(d);
    dryPerWeek.set(w, (dryPerWeek.get(w) ?? 0) + 1);
  }
  const perfectWeek = Array.from(dryPerWeek.values()).some((n) => n >= 7);
  const sportPerWeek = new Map<number, number>();
  for (const d of Array.from(sportDates)) {
    const w = weekOf(d);
    sportPerWeek.set(w, (sportPerWeek.get(w) ?? 0) + 1);
  }
  const sportWeek = Array.from(sportPerWeek.values()).some((n) => n >= 3);

  // Comeback: nach einem Bier-Tag direkt am nächsten Tag trocken
  const wetDates = new Set(
    [...byKey("too_many"), ...byKey("drunk")].map((c) => c.date)
  );
  const comeback = Array.from(wetDates).some((d) =>
    noAlcoholDates.has(toISODate(addDays(parseISODate(d), 1)))
  );

  return [
    { key: "first_checkin", icon: "🎯", title: "Los geht's", desc: "Erster Check-in", unlocked: checkins.length > 0 },
    { key: "first_dry_day", icon: "🍀", title: "Erster trockener Tag", desc: "1× kein Alkohol", unlocked: noAlcoholDates.size >= 1 },
    { key: "streak_3", icon: "✨", title: "Drei am Stück", desc: "3 Tage Streak", unlocked: streak >= 3 },
    { key: "streak_5", icon: "💪", title: "Fünf am Stück", desc: "5 Tage Streak", unlocked: streak >= 5 },
    { key: "streak_7", icon: "🧊", title: "Eine Woche trocken", desc: "7 Tage Streak", unlocked: streak >= 7 },
    { key: "streak_14", icon: "🔥", title: "Zwei Wochen trocken", desc: "14 Tage Streak", unlocked: streak >= 14 },
    { key: "streak_30", icon: "🏆", title: "Ein Monat trocken", desc: "30 Tage Streak", unlocked: streak >= 30 },
    { key: "dry_10", icon: "📆", title: "10 trockene Tage", desc: "10 alkoholfreie Tage gesamt", unlocked: noAlcoholDates.size >= 10 },
    { key: "dry_25", icon: "🗓", title: "25 trockene Tage", desc: "25 alkoholfreie Tage gesamt", unlocked: noAlcoholDates.size >= 25 },
    { key: "dry_50", icon: "🥇", title: "50 trockene Tage", desc: "50 alkoholfreie Tage gesamt", unlocked: noAlcoholDates.size >= 50 },
    { key: "perfect_weekend", icon: "🏖", title: "Perfektes Wochenende", desc: "Ganzes Wochenende alkoholfrei", unlocked: byKey("weekend_free").length >= 1 },
    { key: "weekend_2", icon: "⛱", title: "Wochenend-Profi", desc: "2 perfekte Wochenenden", unlocked: byKey("weekend_free").length >= 2 },
    { key: "perfect_day", icon: "⭐", title: "Perfekter Tag", desc: "Alle Tagesaufgaben an einem Tag", unlocked: perfectDay },
    { key: "perfect_week", icon: "🌟", title: "Makellose Woche", desc: "7 von 7 Tagen einer Woche trocken", unlocked: perfectWeek },
    { key: "comeback", icon: "🦅", title: "Comeback", desc: "Nach einem Bier-Tag direkt trocken weitergemacht", unlocked: comeback },
    { key: "first_sport", icon: "🚴", title: "Angerollt", desc: "Erste Sporteinheit", unlocked: sportDates.size >= 1 },
    { key: "sport_week", icon: "🏋", title: "Trainingswoche", desc: "3× Sport in einer Woche", unlocked: sportWeek },
    { key: "big_ride", icon: "⛰", title: "Königsetappe", desc: "3+ Stunden Sport an einem Tag", unlocked: bigRide },
    { key: "sport_10", icon: "🚵", title: "Sportskanone", desc: "10× Sport eingetragen", unlocked: sportDates.size >= 10 },
    { key: "water_7", icon: "💧", title: "Wasserratte", desc: "7× genug Wasser getrunken", unlocked: byKey("water").length >= 7 },
    { key: "sleep_7", icon: "😴", title: "Schlafmütze", desc: "7× ausgeschlafen", unlocked: byKey("sleep").length >= 7 },
    { key: "points_50", icon: "🎖", title: "Halbes Hundert", desc: "50 Punkte gesamt", unlocked: total >= 50 },
    { key: "points_100", icon: "💯", title: "Punktejäger", desc: "100 Punkte gesamt", unlocked: total >= 100 },
    { key: "halfway", icon: "🧭", title: "Halbzeit", desc: "Bis zur Challenge-Hälfte dabei", unlocked: halfwayReached },
  ];
}
