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
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(false);
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
    setMenuOpen(false);
    load(userId);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <p className="text-center text-[#3A2E1B]/70">Lade…</p>;

  const today = toISODate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl uppercase text-[#3A2E1B]">Bierpause</h1>
        <button
          className="btn-ghost px-3 text-xl leading-none"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menü"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <div className="space-y-4">
          <form onSubmit={createChallenge} className="card space-y-3">
            <h3 className="font-semibold">Neue Challenge</h3>
            <input
              className="input"
              required
              placeholder="Name, z. B. Istria 300 Prep"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="block text-sm text-[#3A2E1B]/70">
              Start
              <input
                className="input mt-1"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block text-sm text-[#3A2E1B]/70">
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
            <p className="text-sm text-[#3A2E1B]/70">
              Gib den 6-stelligen Einladungscode ein, den dir dein Freund
              geschickt hat.
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

          <button className="btn-ghost w-full" onClick={logout}>
            Abmelden
          </button>
        </div>
      )}

      {!menuOpen && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[#3A2E1B]/80">
              Deine Challenges
            </h2>
            {challenges.length === 0 && (
              <p className="text-[#3A2E1B]/60">
                Noch keine Challenge – über das Menü oben rechts erstellst du
                eine oder trittst per Code bei.
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
                  className="card block transition hover:border-amber-600"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-[#3A2E1B]/70">{status}</p>
                    </div>
                    <span className="text-amber-700">→</span>
                  </div>
                </Link>
              );
            })}
          </section>

          {/* Maskottchen – erscheint automatisch, sobald public/hunzn.jpg existiert */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hunzn.jpg"
            alt="Time to break – time to beer"
            className="mx-auto w-full max-w-sm rounded-2xl border-2 border-[#3A2E1B] shadow-[4px_4px_0_#3A2E1B]"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
