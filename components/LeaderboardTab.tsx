"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, toISODate, weekIndex } from "@/lib/types";
import Emoji from "@/components/Emoji";

type Row = { user_id: string; date: string; rule_id: string; quantity: number };
type Member = { user_id: string; name: string };

export default function LeaderboardTab({
  challenge,
  rules,
}: {
  challenge: Challenge;
  rules: Rule[];
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, c] = await Promise.all([
        supabase
          .from("challenge_members")
          .select("user_id, profiles(display_name)")
          .eq("challenge_id", challenge.id),
        supabase
          .from("checkins")
          .select("user_id, date, rule_id, quantity")
          .eq("challenge_id", challenge.id),
      ]);
      setMembers(
        ((m.data ?? []) as any[]).map((r) => ({
          user_id: r.user_id,
          name: r.profiles?.display_name ?? "???",
        }))
      );
      setCheckins((c.data ?? []) as Row[]);
      setLoading(false);
    }
    load();
  }, [challenge.id]);

  const pointsByRule = useMemo(() => {
    const map = new Map<string, number>();
    rules.forEach((r) => map.set(r.id, r.points));
    return map;
  }, [rules]);

  const currentWeek = Math.min(
    Math.max(weekIndex(toISODate(new Date()), challenge.start_date), 0),
    challenge.weeks - 1
  );

  const stats = useMemo(() => {
    return members
      .map((m) => {
        const mine = checkins.filter((c) => c.user_id === m.user_id);
        const perWeek = Array.from({ length: challenge.weeks }, () => 0);
        let total = 0;
        for (const c of mine) {
          const p = (pointsByRule.get(c.rule_id) ?? 0) * (c.quantity ?? 1);
          total += p;
          const w = weekIndex(c.date, challenge.start_date);
          if (w >= 0 && w < challenge.weeks) perWeek[w] += p;
        }
        return { ...m, total, perWeek, thisWeek: perWeek[currentWeek] ?? 0 };
      })
      .sort((a, b) => b.total - a.total);
  }, [members, checkins, pointsByRule, challenge, currentWeek]);

  if (loading) return <p className="text-stone-400">Lade…</p>;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {stats.map((s, i) => (
          <div key={s.user_id} className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              {medals[i] ? (
                <Emoji e={medals[i]} size={30} />
              ) : (
                <span className="text-xl text-stone-400">{i + 1}.</span>
              )}
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-stone-400">
                  Diese Woche: {s.thisWeek > 0 ? `+${s.thisWeek}` : s.thisWeek} Punkte
                </p>
              </div>
            </div>
            <p
              className={`text-2xl font-bold ${
                s.total >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {s.total}
            </p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <h3 className="mb-3 font-semibold">Wochenverlauf</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-400">
              <th className="pb-2 pr-3">Name</th>
              {Array.from({ length: challenge.weeks }, (_, w) => (
                <th
                  key={w}
                  className={`pb-2 pr-3 text-center ${
                    w === currentWeek ? "text-amber-500" : ""
                  }`}
                >
                  W{w + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.user_id} className="border-t border-stone-800">
                <td className="py-2 pr-3 font-medium">{s.name}</td>
                {s.perWeek.map((p, w) => (
                  <td
                    key={w}
                    className={`py-2 pr-3 text-center ${
                      p > 0
                        ? "text-emerald-400"
                        : p < 0
                        ? "text-red-400"
                        : "text-stone-600"
                    }`}
                  >
                    {p !== 0 ? p : "·"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
