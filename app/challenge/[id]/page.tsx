"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule, toISODate, weekIndex } from "@/lib/types";
import CheckinTab from "@/components/CheckinTab";
import LeaderboardTab from "@/components/LeaderboardTab";
import CalendarTab from "@/components/CalendarTab";
import RulesTab from "@/components/RulesTab";
import StatsBar from "@/components/StatsBar";
import BadgesTab from "@/components/BadgesTab";
import PushSetup from "@/components/PushSetup";
import Emoji from "@/components/Emoji";

type Tab = "checkin" | "leaderboard" | "calendar" | "badges" | "rules";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [tab, setTab] = useState<Tab>("checkin");
  const [copied, setCopied] = useState(false);
  const [statsVersion, setStatsVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadRules = useCallback(async () => {
    const { data } = await supabase
      .from("point_rules")
      .select("*")
      .eq("challenge_id", id)
      .order("sort");
    setRules((data ?? []) as Rule[]);
  }, [id]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace("/login");
      setUserId(data.session.user.id);
      const { data: ch } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", id)
        .single();
      setChallenge(ch as Challenge);
      loadRules();
    });
  }, [id, router, loadRules]);

  if (!challenge || !userId)
    return <p className="text-center text-[#3A2E1B]/70">Lade…</p>;

  const today = toISODate(new Date());
  const wk = weekIndex(today, challenge.start_date);
  const status =
    wk < 0
      ? `Startet am ${challenge.start_date}`
      : wk >= challenge.weeks
      ? "Challenge beendet 🎉"
      : `Woche ${wk + 1} von ${challenge.weeks}`;

  const isOwner = challenge.owner_id === userId;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "checkin", label: "Check-in", icon: "✅" },
    { key: "leaderboard", label: "Ranking", icon: "🏆" },
    { key: "calendar", label: "Kalender", icon: "📅" },
    { key: "badges", label: "Erfolge", icon: "🥇" },
    { key: "rules", label: "Regeln", icon: "⚙" },
  ];

  async function copyCode() {
    await navigator.clipboard.writeText(challenge!.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function resetChallenge() {
    if (
      !confirm(
        "Wirklich ALLE Check-ins und Erfolge dieser Challenge löschen? Das gilt für alle Teilnehmer und kann nicht rückgängig gemacht werden."
      )
    )
      return;
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/reset-challenge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token}`,
      },
      body: JSON.stringify({ challenge_id: id }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(`Fehler: ${body.error ?? res.status}`);
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-[#3A2E1B]/70 hover:text-amber-700">
          ← Zurück
        </Link>
        <button
          className="btn-ghost px-3 text-xl leading-none"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menü"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <div className="card space-y-3">
          <div>
            <p className="font-semibold">{challenge.name}</p>
            <p className="text-sm text-[#3A2E1B]/70">{status}</p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#3A2E1B]/30 p-3">
            <div>
              <p className="text-xs text-[#3A2E1B]/60">Einladungscode</p>
              <p className="font-display text-xl">{challenge.invite_code}</p>
            </div>
            <button className="btn text-sm" onClick={copyCode}>
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              setTab("rules");
              setMenuOpen(false);
            }}
          >
            ⚙ Regeln & Einstellungen
          </button>
          {isOwner && (
            <button
              className="btn-ghost w-full border-red-700 text-red-700"
              onClick={resetChallenge}
            >
              🗑 Spielstand zurücksetzen
            </button>
          )}
          <button className="btn-ghost w-full" onClick={logout}>
            Abmelden
          </button>
        </div>
      )}

      <div>
        <h1 className="font-display text-3xl uppercase text-[#3A2E1B]">{challenge.name}</h1>
        <p className="text-[#3A2E1B]/70">{status}</p>
      </div>

      <StatsBar
        challenge={challenge}
        userId={userId}
        rules={rules}
        version={statsVersion}
      />

      <PushSetup userId={userId} />

      {/* Bottom-Navigation wie in nativen Apps */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[#3A2E1B] bg-[#FBF3DF] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition ${
                tab === t.key ? "bg-amber-100" : ""
              }`}
            >
              <Emoji e={t.icon} size={22} />
              <span
                className={`text-[11px] font-semibold ${
                  tab === t.key ? "text-amber-700" : "text-[#3A2E1B]/60"
                }`}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {tab === "checkin" && (
        <CheckinTab
          challenge={challenge}
          userId={userId}
          rules={rules}
          onChanged={() => setStatsVersion((v) => v + 1)}
        />
      )}
      {tab === "leaderboard" && (
        <LeaderboardTab challenge={challenge} rules={rules} />
      )}
      {tab === "calendar" && (
        <CalendarTab challenge={challenge} userId={userId} rules={rules} />
      )}
      {tab === "badges" && (
        <BadgesTab challenge={challenge} userId={userId} rules={rules} />
      )}
      {tab === "rules" && (
        <RulesTab
          challenge={challenge}
          isOwner={isOwner}
          rules={rules}
          onChanged={loadRules}
        />
      )}
    </div>
  );
}
