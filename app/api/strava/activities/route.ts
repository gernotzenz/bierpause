import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Liefert die Strava-Aktivitäten des eingeloggten Nutzers für einen Tag.
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date"); // yyyy-mm-dd
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!date || !jwt) {
    return NextResponse.json({ error: "date oder Login fehlt" }, { status: 400 });
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

  const { data: row } = await admin
    .from("strava_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Strava nicht verbunden" }, { status: 400 });
  }

  // Token bei Bedarf erneuern
  let accessToken = row.access_token as string;
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at < now + 60) {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
      }),
    });
    const tok = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: "Token-Refresh fehlgeschlagen – bitte Strava neu verbinden" },
        { status: 400 }
      );
    }
    accessToken = tok.access_token;
    await admin
      .from("strava_tokens")
      .update({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: tok.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  // Fenster ±1 Tag laden, dann nach lokalem Startdatum filtern (Zeitzonen!)
  const dayStart = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${
      dayStart - 86400
    }&before=${dayStart + 2 * 86400}&per_page=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const acts = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: acts.message ?? "Strava-Abruf fehlgeschlagen" },
      { status: 400 }
    );
  }

  const activities = (acts as any[])
    .filter((a) => typeof a.start_date_local === "string" && a.start_date_local.startsWith(date))
    .map((a) => ({
      name: a.name as string,
      type: a.sport_type ?? a.type,
      minutes: Math.round((a.moving_time ?? 0) / 60),
    }));

  return NextResponse.json({ activities });
}
