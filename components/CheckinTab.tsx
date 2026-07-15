"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, parseISODate, toISODate } from "@/lib/types";

export default function CheckinTab({
  challenge,
  userId,
  rules,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
}) {
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [checked, setChecked] = useState<Set<string>>(new Set()); // rule_ids
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("checkins")
      .select("rule_id")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .eq("date", date);
    setChecked(new Set((data ?? []).map((c: any) => c.rule_id)));
  }, [challenge.id, userId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const dow = parseISODate(date).getDay(); // 0 = So, 6 = Sa
  const isWeekend = dow === 0 || dow === 6;

  async function toggle(rule: Rule) {
    setBusy(rule.id);
    setError(null);
    if (checked.has(rule.id)) {
      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("challenge_id", challenge.id)
        .eq("user_id", userId)
        .eq("rule_id", rule.id)
        .eq("date", date);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from("checkins").insert({
        challenge_id: challenge.id,
        user_id: userId,
        rule_id: rule.id,
        date,
      });
      if (error) setError(error.message);
    }
    setBusy(null);
    load();
  }

  const dayTotal = useMemo(
    () =>
      rules
        .filter((r) => checked.has(r.id))
        .reduce((sum, r) => sum + r.points, 0),
    [rules, checked]
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm text-stone-400">
          Tag
          <input
            className="input mt-1"
            type="date"
            value={date}
            min={challenge.start_date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="text-right">
          <p className="text-sm text-stone-400">Punkte an diesem Tag</p>
          <p
            className={`text-3xl font-bold ${
              dayTotal > 0
                ? "text-emerald-400"
                : dayTotal < 0
                ? "text-red-400"
                : "text-stone-300"
            }`}
          >
            {dayTotal > 0 ? `+${dayTotal}` : dayTotal}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => {
          const disabled = rule.weekend_only && !isWeekend;
          const isOn = checked.has(rule.id);
          return (
            <button
              key={rule.id}
              onClick={() => toggle(rule)}
              disabled={disabled || busy === rule.id}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                isOn
                  ? rule.points >= 0
                    ? "border-emerald-500 bg-emerald-950/40"
                    : "border-red-500 bg-red-950/40"
                  : "border-stone-800 bg-stone-900 hover:border-stone-600"
              } ${disabled ? "opacity-40" : ""}`}
            >
              <span>
                <span className="mr-2">{isOn ? "✅" : "⬜"}</span>
                {rule.label}
                {rule.weekend_only && (
                  <span className="ml-2 text-xs text-stone-500">(nur Sa/So)</span>
                )}
              </span>
              <span
                className={`font-bold ${
                  rule.points >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {rule.points > 0 ? `+${rule.points}` : rule.points}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-stone-500">
        Ehrlichkeit zählt – auch die Minuspunkte eintragen! 😉
      </p>
    </div>
  );
}
