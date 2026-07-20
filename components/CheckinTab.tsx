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

// Diese Gruppen schließen sich am selben Tag gegenseitig aus:
const CLEAN_KEYS = ["no_alcohol", "weekend_free"];
const DIRTY_KEYS = ["too_many", "drunk"];

export default function CheckinTab({
  challenge,
  userId,
  rules,
  onChanged,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
  onChanged?: () => void;
}) {
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [checked, setChecked] = useState<Map<string, number>>(new Map()); // rule_id → quantity
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // triggert WeekProgress-Reload
  const [stravaConnected, setStravaConnected] = useState(false);
  const [athleteName, setAthleteName] = useState("");

  useEffect(() => {
    supabase
      .from("strava_tokens")
      .select("athlete_name")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setStravaConnected(!!data);
        setAthleteName(data?.athlete_name ?? "");
      });
  }, [userId]);

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
      if (error) {
        setError(error.message);
      } else {
        // Widersprüche am selben Tag auflösen (kein Alkohol vs. Bier getrunken)
        const conflictKeys = DIRTY_KEYS.includes(rule.key)
          ? CLEAN_KEYS
          : CLEAN_KEYS.includes(rule.key)
          ? DIRTY_KEYS
          : [];
        const conflictIds = rules
          .filter((r) => conflictKeys.includes(r.key))
          .map((r) => r.id);
        if (conflictIds.length > 0) {
          await supabase
            .from("checkins")
            .delete()
            .eq("challenge_id", challenge.id)
            .eq("user_id", userId)
            .eq("date", date)
            .in("rule_id", conflictIds);
        }
        notifyBadges(challenge.id);
      }
    }
    setBusy(null);
    setVersion((v) => v + 1);
    onChanged?.();
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

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DayPager
            date={date}
            minDate={challenge.start_date}
            maxDate={today}
            onChange={setDate}
          />
          <div className="text-right">
            <p className="text-sm text-[#3A2E1B]/70">Punkte an diesem Tag</p>
            <p
              className={`text-3xl font-bold ${
                dayTotal > 0
                  ? "text-emerald-700"
                  : dayTotal < 0
                  ? "text-red-700"
                  : "text-[#3A2E1B]/80"
              }`}
            >
              {dayTotal > 0 ? `+${dayTotal}` : dayTotal}
            </p>
          </div>
        </div>
        <MoodRow rules={rules} checked={checked} date={date} />
      </div>

      <StravaSection
        challenge={challenge}
        userId={userId}
        rules={rules}
        date={date}
        checked={checked}
        connected={stravaConnected}
        athlete={athleteName}
        onImported={() => {
          setVersion((v) => v + 1);
          onChanged?.();
          load();
        }}
      />

      <div className="space-y-2">
        {rules
          .filter((r) => !(r.key === "sport" && stravaConnected))
          .map((rule) => {
          const disabled = rule.weekend_only && !isWeekend;
          const qty = checked.get(rule.id);
          const isOn = qty !== undefined;
          const effective = rule.points * (qty ?? 1);
          return (
            <button
              key={rule.id}
              onClick={() => toggle(rule)}
              disabled={disabled || busy === rule.id}
              className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition ${
                isOn
                  ? rule.points >= 0
                    ? "border-emerald-700 bg-emerald-100"
                    : "border-red-700 bg-red-100"
                  : "border-[#3A2E1B] bg-[#FBF3DF] hover:border-[#8A6E2F]"
              } ${disabled ? "opacity-40" : ""}`}
            >
              <span className="flex items-center gap-2">
                <Emoji e={isOn ? "✅" : "⬜"} size={20} />
                <span>
                  {rule.label}
                  {isOn && qty! > 1 && (
                    <span className="ml-2 text-xs font-semibold text-amber-700">
                      ×{qty}
                    </span>
                  )}
                  {rule.weekend_only && (
                    <span className="ml-2 text-xs text-[#3A2E1B]/60">
                      (nur Sa/So)
                    </span>
                  )}
                </span>
              </span>
              <span
                className={`font-bold ${
                  rule.points >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {effective > 0 ? `+${effective}` : effective}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-[#3A2E1B]/60">
        Ehrlichkeit zählt – auch die Minuspunkte eintragen!
      </p>
    </div>
  );
}

/* ---------- Hunzn-Reaktion zum gewählten Tag ---------- */
// drunk.png / sport.png / ok.png aus public/ – fehlt eines, bleibt nur der Text.

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

function MoodRow({
  rules,
  checked,
  date,
}: {
  rules: Rule[];
  checked: Map<string, number>;
  date: string;
}) {
  const has = (key: string) => {
    const r = rules.find((r) => r.key === key);
    return r ? checked.has(r.id) : false;
  };

  // Alkohol schlägt Sport
  const mood: keyof typeof MOODS | null =
    has("drunk") || has("too_many")
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
      key={`${mood}-${date}`}
      className="animate-pop mt-4 flex items-center gap-3 border-t-2 border-[#3A2E1B]/15 pt-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${mood}.png`}
        alt=""
        className="w-16 shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <div>
        <p className={`font-display text-sm uppercase ${m.color}`}>{m.title}</p>
        <p className="text-sm text-[#3A2E1B]/70">{m.text}</p>
      </div>
    </div>
  );
}

/* ---------- Tages-Blätterer (statt Datums-Dropdown) ---------- */

function DayPager({
  date,
  minDate,
  maxDate,
  onChange,
}: {
  date: string;
  minDate: string;
  maxDate: string;
  onChange: (d: string) => void;
}) {
  const shift = (days: number) => {
    const next = toISODate(addDays(parseISODate(date), days));
    if (next < minDate || next > maxDate) return;
    onChange(next);
  };

  const label = parseISODate(date).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const isToday = date === maxDate;

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-ghost px-3"
        onClick={() => shift(-1)}
        disabled={date <= minDate}
        aria-label="Vortag"
      >
        ←
      </button>
      <div className="min-w-[7rem] text-center">
        <p className="font-semibold">{label}</p>
        {isToday ? (
          <p className="text-xs text-[#3A2E1B]/60">Heute</p>
        ) : (
          <button
            className="text-xs text-amber-700 underline"
            onClick={() => onChange(maxDate)}
          >
            zu heute
          </button>
        )}
      </div>
      <button
        className="btn-ghost px-3"
        onClick={() => shift(1)}
        disabled={date >= maxDate}
        aria-label="Nächster Tag"
      >
        →
      </button>
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

  if (wk < 0) {
    const days = Math.max(
      1,
      Math.ceil(
        (parseISODate(challenge.start_date).getTime() - Date.now()) / 86400000
      )
    );
    return (
      <div className="card flex items-center gap-2 text-sm text-[#3A2E1B]/70">
        <Emoji e="🏁" size={18} />
        Challenge startet in {days} {days === 1 ? "Tag" : "Tagen"} – ab dann
        siehst du hier deinen Wochenfortschritt.
      </div>
    );
  }
  if (wk >= challenge.weeks) return null;

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
        <span className="flex items-center gap-1 text-[#3A2E1B]/70">
          noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"} bis zum Ziel{" "}
          <Emoji e="🏁" size={16} />
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[#EBDDBB]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[#3A2E1B]/70">
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
  connected,
  athlete,
  onImported,
}: {
  challenge: Challenge;
  userId: string;
  rules: Rule[];
  date: string;
  checked: Map<string, number>;
  connected: boolean;
  athlete: string;
  onImported: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sportRule = rules.find((r) => r.key === "sport");
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;

  useEffect(() => {
    setMsg(null);
  }, [date]);

  if (!clientId || !sportRule) return null;

  const sportQty = checked.get(sportRule.id);

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
    <div className="card flex flex-wrap items-center justify-between gap-3 border-orange-700/40">
      <div>
        <p className="font-semibold text-orange-700">Strava</p>
        <p className="text-xs text-[#3A2E1B]/70">
          {connected
            ? `Verbunden als ${athlete || "Athlet"} – ${sportRule.points} Punkte pro Sportstunde`
            : "Verbinde Strava und übernimm Aktivitäten automatisch als Sport."}
        </p>
        {connected && sportQty !== undefined && (
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            ✓ {sportQty} {sportQty === 1 ? "Stunde" : "Stunden"} Sport an diesem
            Tag (+{sportRule.points * sportQty})
          </p>
        )}
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
      {msg && <p className="w-full text-sm text-[#3A2E1B]/80">{msg}</p>}
    </div>
  );
}
