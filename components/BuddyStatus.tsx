"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, fmtPoints, pointsFor } from "@/lib/types";
import Emoji from "@/components/Emoji";

// Kompakte Zeile pro Mitspieler: was hat er/sie am gewählten Tag gemacht?

const RULE_ICONS: Record<string, string> = {
  no_alcohol: "🚫",
  weekend_free: "🏖",
  sport: "🚴",
  water: "💧",
  sleep: "😴",
  too_many: "🍺",
  drunk: "🥴",
};

type Row = { name: string; points: number; keys: string[]; count: number };

export default function BuddyStatus({
  challenge,
  userId,
  rules,
  date,
  version = 0,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
  date: string;
  version?: number;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data: members } = await supabase
        .from("challenge_members")
        .select("user_id, profiles(display_name)")
        .eq("challenge_id", challenge.id)
        .neq("user_id", userId);
      const list = (members ?? []) as any[];
      if (list.length === 0) return setRows([]);

      const { data: checkins } = await supabase
        .from("checkins")
        .select("user_id, rule_id, quantity")
        .eq("challenge_id", challenge.id)
        .eq("date", date)
        .in(
          "user_id",
          list.map((m) => m.user_id)
        );

      const ruleById = new Map(rules.map((r) => [r.id, r]));
      setRows(
        list.map((m) => {
          const mine = ((checkins ?? []) as any[]).filter(
            (c) => c.user_id === m.user_id
          );
          const points = mine.reduce((s, c) => {
            const r = ruleById.get(c.rule_id);
            return r ? s + pointsFor(r, c.quantity ?? 1) : s;
          }, 0);
          const keys = mine
            .map((c) => ruleById.get(c.rule_id)?.key)
            .filter(Boolean) as string[];
          return {
            name: m.profiles?.display_name ?? "?",
            points,
            keys,
            count: mine.length,
          };
        })
      );
    }
    load();
  }, [challenge.id, userId, date, rules, version]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="card space-y-2 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#3A2E1B]/60">
        An diesem Tag bei den anderen
      </p>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{r.name}</span>
            <span className="flex gap-1">
              {r.keys.map((k, i) => (
                <Emoji key={i} e={RULE_ICONS[k] ?? "⭐"} size={16} />
              ))}
            </span>
          </div>
          {r.count === 0 ? (
            <span className="text-xs text-[#3A2E1B]/50">
              noch nichts eingetragen
            </span>
          ) : (
            <span
              className={`font-bold ${
                r.points >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {fmtPoints(r.points)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
