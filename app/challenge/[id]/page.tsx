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

type Tab = "checkin" | "leaderboard" | "calendar" | "badges" | "rules";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [tab, setTab] = useState<Tab>("checkin");
  const [copied, setCopied] = useState(false);

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
    return <p className="text-center text-stone-400">Lade…</p>;

  const today = toISODate(new Date());
  const wk = weekIndex(today, challenge.start_date);
  const status =
    wk < 0
      ? `Startet am ${challenge.start_date}`
      : wk >= challenge.weeks
      ? "Challenge beendet 🎉"
      : `Woche ${wk + 1} von ${challenge.weeks}`;

  const isOwner = challenge.owner_id === userId;

  const tabs: { key: Tab; label: string }[] = [
    { key: "checkin", label: "Check-in" },
    { key: "leaderboard", label: "Leaderboard" },
    { key: "calendar", label: "Kalender" },
    { key: "badges", label: "Erfolge" },
    { key: "rules", label: "Regeln" },
  ];

  async function copyCode() {
    await navigator.clipboard.writeText(challenge!.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="text-sm text-stone-400 hover:text-amber-500">
          ← Zurück
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{challenge.name}</h1>
          <button className="btn-ghost text-sm" onClick={copyCode}>
            {copied ? "Kopiert ✓" : `Einladungscode: ${challenge.invite_code}`}
          </button>
        </div>
        <p className="text-stone-400">{status}</p>
      </div>

      <StatsBar challenge={challenge} userId={userId} rules={rules} />

      <PushSetup userId={userId} />

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "btn whitespace-nowrap text-sm"
                : "btn-ghost whitespace-nowrap text-sm"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "checkin" && (
        <CheckinTab challenge={challenge} userId={userId} rules={rules} />
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
