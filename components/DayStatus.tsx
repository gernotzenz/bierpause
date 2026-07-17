"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, toISODate } from "@/lib/types";

// Tagesstatus (heute): drunk.png / sport.png / ok.png aus public/.
// Fehlt ein Bild, wird nur der Text angezeigt.

const MOODS = {
  drunk: {
    title: "Oida…",
    text: "Das kostet Punkte. Morgen wieder angreifen!",
    color: "text-red-700",
  },
  sport: {
    title: "Stark!",
    text: "Sporteinheit im Sack – Hunzn ist stolz auf dich.",
    color: "text-emerald-700",
  },
  ok: {
    title: "Sauber unterwegs",
    text: "Kein Bier heute. Genau so bleibt der Streak am Leben.",
    color: "text-amber-700",
  },
} as const;

export default function DayStatus({
  challenge,
  userId,
  rules,
  date,
  version = 0,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
  date?: string; // gewählter Tag; Standard: heute
  version?: number;
}) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const day = date ?? toISODate(new Date());

  useEffect(() => {
    supabase
      .from("checkins")
      .select("rule_id")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .eq("date", day)
      .then(({ data }) =>
        setIds(new Set(((data ?? []) as any[]).map((c) => c.rule_id)))
      );
  }, [challenge.id, userId, day, version]);

  const has = (key: string) => {
    const r = rules.find((r) => r.key === key);
    return r ? ids.has(r.id) : false;
  };

  // Alkohol schlägt Sport: auch "mehr als 2 Bier" zeigt den betrunkenen Hunzn
  const mood: keyof typeof MOODS | null = has("drunk") || has("too_many")
    ? "drunk"
    : has("sport")
    ? "sport"
    : has("no_alcohol")
    ? "ok"
    : null;

  if (!mood) return null;
  const m = MOODS[mood];

  return (
    <div
      key={`${mood}-${day}`}
      className="card animate-pop flex max-w-sm items-center gap-3 px-4 py-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${mood}.png`}
        alt=""
        className="w-14 shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div>
        <p className={`font-display text-xs uppercase ${m.color}`}>{m.title}</p>
        <p className="text-xs text-[#3A2E1B]/70">{m.text}</p>
      </div>
    </div>
  );
}
