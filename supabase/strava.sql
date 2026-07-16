-- ============================================================
-- Strava-Anbindung – im Supabase SQL Editor ausführen
-- ============================================================

create table public.strava_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null, -- Unix-Timestamp
  athlete_name text,
  updated_at timestamptz not null default now()
);

alter table public.strava_tokens enable row level security;

-- Nutzer sieht nur den eigenen Eintrag (fürs "Verbunden als …")
create policy "strava_select_own" on public.strava_tokens
  for select to authenticated using (user_id = auth.uid());

-- Trennen der Verbindung
create policy "strava_delete_own" on public.strava_tokens
  for delete to authenticated using (user_id = auth.uid());

-- Schreiben passiert nur serverseitig über den Service-Role-Key (umgeht RLS).
