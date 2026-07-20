import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { computeBadges } from "@/lib/badges";
import type { Challenge, Rule } from "@/lib/types";

// Prüft nach einem Check-in, ob der Nutzer neue Badges freigeschaltet hat,
// und pusht diese an alle anderen Challenge-Mitglieder.
export async function POST(req: NextRequest) {
  const { challenge_id } = await req.json();
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!challenge_id || !jwt) {
    return NextResponse.json({ error: "challenge_id oder Login fehlt" }, { status: 400 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ ok: true, skipped: "push nicht konfiguriert" });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    vapidPublic,
    vapidPrivate
  );

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: "nicht eingeloggt" }, { status: 401 });
  }

  // Daten laden
  const [chRes, rulesRes, checkinsRes, doneRes, profileRes] = await Promise.all([
    admin.from("challenges").select("*").eq("id", challenge_id).single(),
    admin.from("point_rules").select("*").eq("challenge_id", challenge_id),
    admin
      .from("checkins")
      .select("rule_id, date, quantity")
      .eq("challenge_id", challenge_id)
      .eq("user_id", user.id),
    admin
      .from("user_badges")
      .select("badge_key")
      .eq("challenge_id", challenge_id)
      .eq("user_id", user.id),
    admin.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);

  if (!chRes.data) return NextResponse.json({ error: "Challenge nicht gefunden" }, { status: 404 });

  const badges = computeBadges(
    chRes.data as Challenge,
    (rulesRes.data ?? []) as Rule[],
    (checkinsRes.data ?? []) as { rule_id: string; date: string; quantity?: number }[]
  );
  const already = new Set((doneRes.data ?? []).map((b: any) => b.badge_key));
  const fresh = badges.filter((b) => b.unlocked && !already.has(b.key));
  if (fresh.length === 0) return NextResponse.json({ ok: true, new: 0 });

  // Neue Badges speichern
  await admin.from("user_badges").insert(
    fresh.map((b) => ({
      user_id: user.id,
      challenge_id,
      badge_key: b.key,
    }))
  );

  // Push an alle ANDEREN Mitglieder
  const { data: members } = await admin
    .from("challenge_members")
    .select("user_id")
    .eq("challenge_id", challenge_id)
    .neq("user_id", user.id);
  const otherIds = (members ?? []).map((m: any) => m.user_id);
  if (otherIds.length === 0) return NextResponse.json({ ok: true, new: fresh.length });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription")
    .in("user_id", otherIds);

  const name = profileRes.data?.display_name ?? "Dein Kumpel";
  const results = await Promise.allSettled(
    (subs ?? []).flatMap((s: any) =>
      fresh.map((b) =>
        webpush
          .sendNotification(
            s.subscription,
            JSON.stringify({
              title: `${b.icon} ${name} hat einen Erfolg!`,
              body: `„${b.title}" freigeschaltet – ${b.desc}. Dranbleiben! 🍺🚫`,
              url: `/challenge/${challenge_id}`,
            })
          )
          .catch(async (err: any) => {
            // Abgelaufene Abos aufräumen
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            }
            throw err;
          })
      )
    )
  );

  return NextResponse.json({
    ok: true,
    new: fresh.length,
    sent: results.filter((r) => r.status === "fulfilled").length,
  });
}
