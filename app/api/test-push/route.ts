import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Schickt eine Testbenachrichtigung an ALLE Push-Abos der Challenge
// (auch die eigenen Geräte) – zum Prüfen, ob die Push-Kette funktioniert.
export async function POST(req: NextRequest) {
  const { challenge_id } = await req.json();
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!challenge_id || !jwt) {
    return NextResponse.json({ error: "challenge_id oder Login fehlt" }, { status: 400 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json(
      { error: "VAPID-Keys fehlen in den Vercel-Umgebungsvariablen" },
      { status: 500 }
    );
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

  const [membersRes, profileRes] = await Promise.all([
    admin
      .from("challenge_members")
      .select("user_id")
      .eq("challenge_id", challenge_id),
    admin.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);
  if (memberIds.length === 0) {
    return NextResponse.json({ subscriptions: 0, sent: 0 });
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription, user_id")
    .in("user_id", memberIds);

  const name = profileRes.data?.display_name ?? "Jemand";
  let sent = 0;
  const errors: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          s.subscription,
          JSON.stringify({
            title: "🔔 Bierpause Push-Test",
            body: `${name} hat einen Test-Push geschickt – die Leitung steht!`,
            url: `/challenge/${challenge_id}`,
          })
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          errors.push("1 abgelaufenes Abo entfernt");
        } else {
          errors.push(`Fehler ${err?.statusCode ?? "?"}`);
        }
      }
    })
  );

  return NextResponse.json({
    subscriptions: subs?.length ?? 0,
    sent,
    errors: errors.length ? errors : undefined,
  });
}
