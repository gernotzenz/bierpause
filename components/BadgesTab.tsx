"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, addDays, parseISODate, toISODate } from "@/lib/types";

type Row = { rule_id: string; date: string };

type Badge = {
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
};

function longestStreak(dates: Set<string>): number {
  let best = 0;
  for (const d of Array.from(dates)) {
    // Nur Serienstarts prüfen
    const prev = toISODate(addDays(parseISODate(d), -1));
    if (dates.has(prev)) continue;
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

export default function BadgesTab({
  challenge,
  userId,
  rules,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
}) {
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("checkins")
      .select("rule_id, date")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .then(({ data }) => {
        setCheckins((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [challenge.id, userId]);

  const badges = useMemo<Badge[]>(() => {
    const ruleById = new Map(rules.map((r) => [r.id, r]));
    const byKey = (key: string) =>
      checkins.filter((c) => ruleById.get(c.rule_id)?.key === key);

    const noAlcoholDates = new Set(byKey("no_alcohol").map((c) => c.date));
    const streak = longestStreak(noAlcoholDates);
    const total = checkins.reduce(
      (s, c) => s + (ruleById.get(c.rule_id)?.points ?? 0),
      0
    );

    // Perfekter Tag: alle positiven Nicht-Wochenend-Regeln an einem Tag erledigt
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
    const halfwayReached =
      new Date() >= half && checkins.length > 0;

    return [
      {
        icon: "🎯",
        title: "Los geht's",
        desc: "Erster Check-in",
        unlocked: checkins.length > 0,
      },
      {
        icon: "🍀",
        title: "Erster trockener Tag",
        desc: "1× kein Alkohol",
        unlocked: noAlcoholDates.size >= 1,
      },
      {
        icon: "🏖",
        title: "Perfektes Wochenende",
        desc: "Ganzes Wochenende alkoholfrei",
        unlocked: byKey("weekend_free").length >= 1,
      },
      {
        icon: "⭐",
        title: "Perfekter Tag",
        desc: "Alle Tagesaufgaben an einem Tag",
        unlocked: perfectDay,
      },
      {
        icon: "🧊",
        title: "Eine Woche trocken",
        desc: "7 Tage Streak",
        unlocked: streak >= 7,
      },
      {
        icon: "🔥",
        title: "Zwei Wochen trocken",
        desc: "14 Tage Streak",
        unlocked: streak >= 14,
      },
      {
        icon: "🏆",
        title: "Ein Monat trocken",
        desc: "30 Tage Streak",
        unlocked: streak >= 30,
      },
      {
        icon: "🚴",
        title: "Sportskanone",
        desc: "10× Sport eingetragen",
        unlocked: byKey("sport").length >= 10,
      },
      {
        icon: "🗓",
        title: "25 trockene Tage",
        desc: "25 alkoholfreie Tage gesamt",
        unlocked: noAlcoholDates.size >= 25,
      },
      {
        icon: "🥇",
        title: "50 trockene Tage",
        desc: "50 alkoholfreie Tage gesamt",
        unlocked: noAlcoholDates.size >= 50,
      },
      {
        icon: "💯",
        title: "Punktejäger",
        desc: "100 Punkte gesamt",
        unlocked: total >= 100,
      },
      {
        icon: "🧭",
        title: "Halbzeit",
        desc: "Bis zur Challenge-Hälfte dabei",
        unlocked: halfwayReached,
      },
    ];
  }, [checkins, rules, challenge]);

  if (loading) return <p className="text-stone-400">Lade…</p>;

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-4">
      <p className="text-stone-400">
        {unlockedCount} von {badges.length} Erfolgen freigeschaltet
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((b) => (
          <div
            key={b.title}
            className={`card text-center transition ${
              b.unlocked
                ? "border-amber-500/60"
                : "opacity-40 grayscale"
            }`}
          >
            <div className="text-4xl">{b.icon}</div>
            <p className="mt-2 font-semibold">{b.title}</p>
            <p className="text-xs text-stone-400">{b.desc}</p>
            {b.unlocked && (
              <p className="mt-1 text-xs font-semibold text-amber-400">
                Freigeschaltet ✓
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
