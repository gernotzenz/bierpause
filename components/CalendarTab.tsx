"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, pointsFor, toISODate } from "@/lib/types";

type Row = { date: string; rule_id: string; quantity: number };

export default function CalendarTab({
  challenge,
  userId,
  rules,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-basiert
  const [checkins, setCheckins] = useState<Row[]>([]);

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  useEffect(() => {
    supabase
      .from("checkins")
      .select("date, rule_id, quantity")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .gte("date", toISODate(first))
      .lte("date", toISODate(last))
      .then(({ data }) => setCheckins((data ?? []) as Row[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id, userId, year, month]);

  const ruleById = useMemo(() => {
    const m = new Map<string, Rule>();
    rules.forEach((r) => m.set(r.id, r));
    return m;
  }, [rules]);

  const byDay = useMemo(() => {
    const m = new Map<string, { points: number; noAlcohol: boolean; any: boolean }>();
    for (const c of checkins) {
      const r = ruleById.get(c.rule_id);
      if (!r) continue;
      const entry = m.get(c.date) ?? { points: 0, noAlcohol: false, any: false };
      entry.points += pointsFor(r, c.quantity ?? 1);
      entry.any = true;
      if (r.key === "no_alcohol" || r.key === "weekend_free") entry.noAlcohol = true;
      m.set(c.date, entry);
    }
    return m;
  }, [checkins, ruleById]);

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(month + 1);
  }

  // Montag-basiertes Grid
  const offset = (first.getDay() + 6) % 7;
  const days = last.getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  const monthName = first.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
  const today = toISODate(new Date());

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={prevMonth}>
          ←
        </button>
        <h3 className="font-semibold capitalize">{monthName}</h3>
        <button className="btn-ghost" onClick={nextMonth}>
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#3A2E1B]/60">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const iso = toISODate(new Date(year, month, day));
          const info = byDay.get(iso);
          const inChallenge =
            iso >= challenge.start_date &&
            iso <
              toISODate(
                new Date(
                  new Date(challenge.start_date).getTime() +
                    challenge.weeks * 7 * 86400000
                )
              );
          let cls = "border-[#3A2E1B] bg-[#FBF3DF] text-[#3A2E1B]/60";
          if (info) {
            if (info.points < 0) cls = "border-red-700 bg-red-100 text-red-800";
            else if (info.noAlcohol)
              cls = "border-emerald-700 bg-emerald-100 text-emerald-800";
            else cls = "border-[#8A6E2F] bg-[#EBDDBB] text-[#3A2E1B]";
          }
          return (
            <div
              key={iso}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm ${cls} ${
                iso === today ? "ring-2 ring-amber-600" : ""
              } ${!inChallenge ? "opacity-40" : ""}`}
            >
              <span>{day}</span>
              {info && (
                <span className="text-[10px] font-bold">
                  {info.points > 0 ? `+${info.points}` : info.points}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-[#3A2E1B]/70">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-600" />
          alkoholfrei
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-red-600" />
          Ausrutscher
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-[#D8C79E]" />
          Punkte ohne Alkohol-Check
        </span>
      </div>
    </div>
  );
}
