import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Setzt eine Challenge zurück: löscht alle Check-ins und Badges.
// Darf nur der Ersteller der Challenge.
export async function POST(req: NextRequest) {
  const { challenge_id } = await req.json();
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!challenge_id || !jwt) {
    return NextResponse.json({ error: "challenge_id oder Login fehlt" }, { status: 400 });
  }

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

  const { data: ch } = await admin
    .from("challenges")
    .select("owner_id")
    .eq("id", challenge_id)
    .single();
  if (!ch || ch.owner_id !== user.id) {
    return NextResponse.json(
      { error: "Nur der Ersteller kann die Challenge zurücksetzen" },
      { status: 403 }
    );
  }

  await admin.from("checkins").delete().eq("challenge_id", challenge_id);
  await admin.from("user_badges").delete().eq("challenge_id", challenge_id);

  return NextResponse.json({ ok: true });
}
