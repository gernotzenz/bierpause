import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Tauscht den OAuth-Code gegen Strava-Tokens und speichert sie.
export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!code || !jwt) {
    return NextResponse.json({ error: "code oder Login fehlt" }, { status: 400 });
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

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  const tok = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: tok.message ?? "Strava-Token-Tausch fehlgeschlagen" },
      { status: 400 }
    );
  }

  const { error } = await admin.from("strava_tokens").upsert({
    user_id: user.id,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: tok.expires_at,
    athlete_name:
      `${tok.athlete?.firstname ?? ""} ${tok.athlete?.lastname ?? ""}`.trim() ||
      null,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
