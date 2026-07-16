"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, addDays, toISODate } from "@/lib/types";
import Emoji from "@/components/Emoji";

// Annahmen für den Gespart-Zähler – hier anpassen:
const BIER_PRO_TAG = 1.5; // Biere, die an einem normalen Tag getrunken worden wären
const PREIS_PRO_BIER = 4.5; // € pro Bier (Lokal-Mischpreis)
const KCAL_PRO_BIER = 215; // kcal pro 0,5 l

export default function StatsBar({
  challenge,
  userId,
  rules,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
}) {
  const [dates, setDates] = useState<Set<string>>(new Set());
  const noAlcoholRule = rules.find((r) => r.key === "no_alcohol");
  const ruleId = noAlcoholRule?.id;

  useEffect(() => {
    if (!ruleId) return;
    supabase
      .from("checkins")
      .select("date")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .eq("rule_id", ruleId)
      .then(({ data }) =>
        setDates(new Set(((data ?? []) as { date: string }[]).map((c) => c.date)))
      );
  }, [challenge.id, userId, ruleId]);

  const { streak, freeDays } = useMemo(() => {
    const freeDays = dates.size;
    let streak = 0;
    let d = new Date();
    // Heute zählt noch nicht als Streak-Bruch, solange der Tag nicht vorbei ist
    if (!dates.has(toISODate(d))) d = addDays(d, -1);
    while (dates.has(toISODate(d))) {
      streak++;
      d = addDays(d, -1);
    }
    return { streak, freeDays };
  }, [dates]);

  const beers = freeDays * BIER_PRO_TAG;
  const euro = Math.round(beers * PREIS_PRO_BIER);
  const kcal = Math.round(beers * KCAL_PRO_BIER);

  const stats = [
    {
      icon: "🔥",
      value: String(streak),
      label: streak === 1 ? "Tag Streak" : "Tage Streak",
      highlight: streak >= 3,
    },
    { icon: "🚫🍺", value: String(freeDays), label: "alkoholfreie Tage" },
    { icon: "💶", value: `${euro} €`, label: "gespart" },
    { icon: "⚡", value: kcal.toLocaleString("de-DE"), label: "kcal gespart" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-2xl border p-3 text-center ${
            s.highlight
              ? "border-amber-600 bg-amber-100"
              : "border-[#3A2E1B] bg-[#FBF3DF]"
          }`}
        >
          <div className="flex justify-center">
            <Emoji e={s.icon} size={26} />
          </div>
          <div
            className={`text-2xl font-bold ${
              s.highlight ? "text-amber-700" : "text-[#3A2E1B]"
            }`}
          >
            {s.value}
          </div>
          <div className="text-xs text-[#3A2E1B]/70">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
