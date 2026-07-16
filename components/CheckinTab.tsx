"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Challenge,
  Rule,
  addDays,
  parseISODate,
  toISODate,
  weekIndex,
} from "@/lib/types";
import Emoji from "@/components/Emoji";

// Meldet neue Badges an den Server (Push an die anderen Mitglieder).
async function notifyBadges(challengeId: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/notify-badges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ challenge_id: challengeId }),
    });
  } catch {
    // Push ist nice-to-have – Fehler still ignorieren
  }
}

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
  const [checked, setChecked] = useState<Map<string, number>>(new Map()); // rule_id → quantity
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // triggert WeekProgress-Reload

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("checkins")
      .select("rule_id, quantity")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .eq("date", date);
    setChecked(
      new Map(((data ?? []) as any[]).map((c) => [c.rule_id, c.quantity ?? 1]))
    );
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
        quantity: 1,
      });
      if (error) setError(error.message);
      else notifyBadges(challenge.id);
    }
    setBusy(null);
    setVersion((v) => v + 1);
    load();
  }

  const dayTotal = useMemo(
    () =>
      rules.reduce(
        (sum, r) => sum + r.points * (checked.get(r.id) ?? 0),
        0
      ),
    [rules, checked]
  );

  return (
    <div className="space-y-4">
      <WeekProgress
        challenge={challenge}
        userId={userId}
        rules={rules}
        version={version}
      />

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

      <StravaSection
        challenge={challenge}
        userId={userId}
        rules={rules}
        date={date}
        checked={checked}
        onImported={() => {
          setVersion((v) => v + 1);
          load();
        }}
      />

      <div className="space-y-2">
        {rules.map((rule) => {
          const disabled = rule.weekend_only && !isWeekend;
          const qty = checked.get(rule.id);
          const isOn = qty !== undefined;
          const effective = rule.points * (qty ?? 1);
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
              <span className="flex items-center gap-2">
                <Emoji e={isOn ? "✅" : "⬜"} size={20} />
                <span>
                  {rule.label}
                  {isOn && qty! > 1 && (
                    <span className="ml-2 text-xs font-semibold text-amber-400">
                      ×{qty}
                    </span>
                  )}
                  {rule.weekend_only && (
                    <span className="ml-2 text-xs text-stone-500">
                      (nur Sa/So)
                    </span>
                  )}
                </span>
              </span>
              <span
                className={`font-bold ${
                  rule.points >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {effective > 0 ? `+${effective}` : effective}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-stone-500">
        Ehrlichkeit zählt – auch die Minuspunkte eintragen!
      </p>
    </div>
  );
}

/* ---------- Wochenfortschritt ---------- */

function WeekProgress({
  challenge,
  userId,
  rules,
  version,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
  version: number;
}) {
  const [weekPoints, setWeekPoints] = useState(0);
  const today = toISODate(new Date());
  const wk = weekIndex(today, challenge.start_date);

  useEffect(() => {
    if (wk < 0 || wk >= challenge.weeks) return;
    const start = addDays(parseISODate(challenge.start_date), wk * 7);
    const end = addDays(start, 6);
    supabase
      .from("checkins")
      .select("rule_id, quantity")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .gte("date", toISODate(start))
      .lte("date", toISODate(end))
      .then(({ data }) => {
        const points = new Map(rules.map((r) => [r.id, r.points]));
        setWeekPoints(
          ((data ?? []) as any[]).reduce(
            (s, c) => s + (points.get(c.rule_id) ?? 0) * (c.quantity ?? 1),
            0
          )
        );
      });
  }, [challenge, userId, rules, wk, version]);

  if (wk < 0 || wk >= challenge.weeks) return null;

  const maxWeek = rules
    .filter((r) => r.points > 0)
    .reduce((s, r) => s + (r.weekend_only ? r.points : r.points * 7), 0);
  const pct = Math.max(0, Math.min(100, maxWeek ? (weekPoints / maxWeek) * 100 : 0));

  const endDate = addDays(parseISODate(challenge.start_date), challenge.weeks * 7);
  const daysLeft = Math.max(
    0,
    Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  );

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          Woche {wk + 1} von {challenge.weeks}
        </span>
        <span className="flex items-center gap-1 text-stone-400">
          noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"} bis zum Ziel{" "}
          <Emoji e="🏁" size={16} />
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-stone-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-stone-400">
        {weekPoints} von {maxWeek} möglichen Punkten diese Woche
      </p>
    </div>
  );
}

/* ---------- Strava ---------- */

type StravaActivity = { name: string; type: string; minutes: number };

function StravaSection({
  challenge,
  userId,
  rules,
  date,
  checked,
  onImported,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
  date: string;
  checked: Map<string, number>;
  onImported: () => void;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [athlete, setAthlete] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sportRule = rules.find((r) => r.key === "sport");
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;

  useEffect(() => {
    supabase
      .from("strava_tokens")
      .select("athlete_name")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setConnected(!!data);
        setAthlete(data?.athlete_name ?? "");
      });
  }, [userId]);

  useEffect(() => {
    setMsg(null);
  }, [date]);

  if (!clientId || !sportRule || connected === null) return null;

  function connect() {
    localStorage.setItem("strava_return", window.location.pathname);
    const redirect = `${window.location.origin}/strava/callback`;
    window.location.href =
      `https://www.strava.com/oauth/authorize?client_id=${clientId}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
      `&approval_prompt=auto&scope=read,activity:read`;
  }

  async function importFromStrava() {
    setLoading(true);
    setMsg(null);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const res = await fetch(`/api/strava/activities?date=${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg(`Fehler: ${body.error ?? res.status}`);

    const acts = (body.activities ?? []) as StravaActivity[];
    if (acts.length === 0) {
      return setMsg(`Keine Strava-Aktivität am ${date} gefunden.`);
    }

    const totalMinutes = acts.reduce((s, a) => s + a.minutes, 0);
    // Punkte pro Sportstunde: Regel-Punkte × gerundete Stunden (min. 1)
    const hours = Math.max(1, Math.round(totalMinutes / 60));
    const summary = acts.map((a) => `${a.name} (${a.minutes} min)`).join(", ");
    const earned = sportRule!.points * hours;

    const existing = checked.get(sportRule!.id);
    if (existing !== undefined) {
      if (existing >= hours) {
        return setMsg(`${summary} – Sport war schon mit ×${existing} eingetragen.`);
      }
      const { error } = await supabase
        .from("checkins")
        .update({ quantity: hours })
        .eq("challenge_id", challenge.id)
        .eq("user_id", userId)
        .eq("rule_id", sportRule!.id)
        .eq("date", date);
      if (error) return setMsg(`Fehler: ${error.message}`);
    } else {
      const { error } = await supabase.from("checkins").insert({
        challenge_id: challenge.id,
        user_id: userId,
        rule_id: sportRule!.id,
        date,
        quantity: hours,
      });
      if (error) return setMsg(`Fehler: ${error.message}`);
    }
    setMsg(
      `${summary} → ${hours} ${hours === 1 ? "Stunde" : "Stunden"} Sport eingetragen (+${earned})`
    );
    notifyBadges(challenge.id);
    onImported();
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-orange-900/60">
      <div>
        <p className="font-semibold text-orange-400">Strava</p>
        <p className="text-xs text-stone-400">
          {connected
            ? `Verbunden als ${athlete || "Athlet"} – ${sportRule.points} Punkte pro Sportstunde`
            : "Verbinde Strava und übernimm Aktivitäten automatisch als Sport."}
        </p>
      </div>
      {connected ? (
        <button
          className="btn-ghost flex items-center gap-2 text-sm"
          onClick={importFromStrava}
          disabled={loading}
        >
          <Emoji e="🚴" size={18} />
          {loading ? "Prüfe…" : "Aktivitäten prüfen"}
        </button>
      ) : (
        <button className="btn text-sm" onClick={connect}>
          Mit Strava verbinden
        </button>
      )}
      {msg && <p className="w-full text-sm text-stone-300">{msg}</p>}
    </div>
  );
}
