"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split("@")[0] } },
      });
      setLoading(false);
      if (error) return setError(error.message);
      if (data.session) router.replace("/dashboard");
      else setInfo("Registrierung erfolgreich. Bitte E-Mail bestätigen und dann einloggen.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      router.replace("/dashboard");
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-8 text-center">
        <p className="font-display text-xs uppercase tracking-[0.35em] text-[#3A2E1B]/60">
          Zeit für eine
        </p>
        <h1 className="font-display text-5xl uppercase leading-tight text-[#3A2E1B]">
          Bierpause
        </h1>
        <p className="mt-2 font-display text-[11px] uppercase tracking-[0.25em] text-[#3A2E1B]/60">
          Punkte statt Promille
        </p>
      </div>

      <div className="card">
        <div className="mb-5 flex gap-2">
          <button
            className={mode === "login" ? "btn flex-1" : "btn-ghost flex-1"}
            onClick={() => setMode("login")}
            type="button"
          >
            Einloggen
          </button>
          <button
            className={mode === "signup" ? "btn flex-1" : "btn-ghost flex-1"}
            onClick={() => setMode("signup")}
            type="button"
          >
            Registrieren
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              className="input"
              placeholder="Anzeigename (z. B. Gernot)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            className="input"
            type="email"
            required
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            required
            minLength={6}
            placeholder="Passwort (min. 6 Zeichen)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn w-full" disabled={loading}>
            {loading ? "Bitte warten…" : mode === "login" ? "Einloggen" : "Konto erstellen"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {info && <p className="mt-3 text-sm text-emerald-700">{info}</p>}
      </div>
    </div>
  );
}
