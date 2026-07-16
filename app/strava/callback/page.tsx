"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function StravaCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Verbinde mit Strava…");

  useEffect(() => {
    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) {
        setStatus("Verbindung abgebrochen.");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return router.replace("/login");

      const res = await fetch("/api/strava/exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus(`Fehler: ${body.error ?? res.status}`);
        return;
      }
      const back = localStorage.getItem("strava_return") ?? "/dashboard";
      localStorage.removeItem("strava_return");
      router.replace(back);
    }
    run();
  }, [router]);

  return <p className="mt-16 text-center text-stone-400">{status}</p>;
}
