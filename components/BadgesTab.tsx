"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule } from "@/lib/types";
import { computeBadges, CheckinRow } from "@/lib/badges";
import Emoji from "@/components/Emoji";

export default function BadgesTab({
  challenge,
  userId,
  rules,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
}) {
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("checkins")
      .select("rule_id, date")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .then(({ data }) => {
        setCheckins((data ?? []) as CheckinRow[]);
        setLoading(false);
      });
  }, [challenge.id, userId]);

  const badges = useMemo(
    () => computeBadges(challenge, rules, checkins),
    [challenge, rules, checkins]
  );

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
            key={b.key}
            className={`card text-center transition ${
              b.unlocked ? "border-amber-500/60" : "opacity-40 grayscale"
            }`}
          >
            <div className="flex justify-center">
              <Emoji e={b.icon} size={44} />
            </div>
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
