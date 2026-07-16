"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Emoji from "@/components/Emoji";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
}

type State = "unsupported" | "off" | "on" | "denied" | "loading" | null;

export default function PushSetup({ userId }: { userId: string }) {
  const [state, setState] = useState<State>(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setState("on");
      else setState(Notification.permission === "denied" ? "denied" : "off");
    });
  }, [publicKey]);

  if (!publicKey || state === null || state === "on") return null;

  async function enable() {
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!) as unknown as BufferSource,
      });
      await supabase.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        user_id: userId,
        subscription: sub.toJSON() as any,
      });
      setState("on");
    } catch {
      setState("off");
    }
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-sky-800/40">
      <div>
        <p className="flex items-center gap-2 font-semibold text-sky-800">
          <Emoji e="🔔" size={18} /> Benachrichtigungen
        </p>
        <p className="text-xs text-[#3A2E1B]/70">
          {state === "unsupported"
            ? "Am iPhone: Seite über Teilen → 'Zum Home-Bildschirm' installieren, dann hier aktivieren."
            : state === "denied"
            ? "Benachrichtigungen sind blockiert – in den Browser-Einstellungen erlauben."
            : "Erfahre sofort, wenn dein Kumpel ein Badge holt."}
        </p>
      </div>
      {state === "off" && (
        <button className="btn text-sm" onClick={enable}>
          Aktivieren
        </button>
      )}
      {state === "loading" && (
        <span className="text-sm text-[#3A2E1B]/70">Aktiviere…</span>
      )}
    </div>
  );
}
