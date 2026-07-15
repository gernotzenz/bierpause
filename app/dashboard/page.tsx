"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Challenge, toISODate, weekIndex } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulare
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [weeks, setWeeks] = useState(8);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("challenge_members")
      .select("challenges(*)")
      .eq("user_id", uid);
    if (error) setError(error.message);
    setChallenges(((data ?? []) as any[]).map((r) => r.challenges).filter(Boolean));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return router.replace("/login");
      setUserId(data.session.user.id);
      load(data.session.user.id);
    });
  }, [router, load]);

  async function createChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("challenges")
      .insert({ name, owner_id: userId, start_date: startDate, weeks });
    setBusy(false);
    if (error) return setError(error.message);
    setName("");
    load(userId);
  }

  async function joinChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { data: ch, error: e1 } = await supabase
      .from("challenges")
      .select("id")
      .eq("invite_code", code.trim().toUpperCase())
      .maybeSingle();
    if (e1 || !ch) {
      setBusy(false);
      return setError(e1?.message ?? "Kein Challenge mit diesem Code gefunden.");
    }
    const { error: e2 } = await supabase
      .from("challenge_members")
      .insert({ challenge_id: ch.id, user_id: userId });
    setBusy(false);
    if (e2 && !e2.message.includes("duplicate")) return setError(e2.message);
    setCode("");
    load(userId);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <p className="text-center text-stone-400">Lade…</p>;

  const today = toISODate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🍺🚫 Bierpause</h1>
        <button className="btn-ghost text-sm" onClick={logout}>
          Abmelden
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-300">Deine Challenges</h2>
        {challenges.length === 0 && (
          <p className="text-stone-500">
            Noch keine Challenge – erstelle eine oder tritt per Code bei.
          </p>
        )}
        {challenges.map((c) => {
          const wk = weekIndex(today, c.start_date);
          const status =
            wk < 0
              ? `startet am ${c.start_date}`
              : wk >= c.weeks
              ? "beendet"
              : `Woche ${wk + 1} von ${c.weeks}`;
          return (
            <Link
              key={c.id}
              href={`/challenge/${c.id}`}
              className="card block transition hover:border-amber-500"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-stone-400">{status}</p>
                </div>
                <span className="text-amber-500">→</span>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={createChallenge} className="card space-y-3">
          <h3 className="font-semibold">Neue Challenge</h3>
          <input
            className="input"
            required
            placeholder="Name, z. B. Istria 300 Prep"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="block text-sm text-stone-400">
            Start
            <input
              className="input mt-1"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block text-sm text-stone-400">
            Dauer
            <select
              className="input mt-1"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              <option value={8}>8 Wochen</option>
              <option value={12}>12 Wochen</option>
            </select>
          </label>
          <button className="btn w-full" disabled={busy}>
            Erstellen
          </button>
        </form>

        <form onSubmit={joinChallenge} className="card space-y-3">
          <h3 className="font-semibold">Challenge beitreten</h3>
          <p className="text-sm text-stone-400">
            Gib den 6-stelligen Einladungscode ein, den dir dein Freund geschickt hat.
          </p>
          <input
            className="input uppercase"
            required
            maxLength={6}
            placeholder="z. B. A1B2C3"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn w-full" disabled={busy}>
            Beitreten
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
