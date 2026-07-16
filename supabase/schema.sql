-- ============================================================
-- Bierpause – Supabase Schema
-- Im Supabase SQL Editor komplett ausführen.
-- ============================================================

-- ---------- Tabellen ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Anonym',
  created_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  weeks int not null default 8 check (weeks between 1 and 52),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table public.point_rules (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  key text not null,
  label text not null,
  points int not null,
  weekend_only boolean not null default false,
  sort int not null default 0,
  unique (challenge_id, key)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rule_id uuid not null references public.point_rules (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, rule_id, date)
);

-- ---------- Trigger: Profil bei Registrierung anlegen ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Trigger: Standard-Regeln + Owner-Mitgliedschaft ----------

create or replace function public.handle_new_challenge()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.challenge_members (challenge_id, user_id)
  values (new.id, new.owner_id);

  insert into public.point_rules (challenge_id, key, label, points, weekend_only, sort) values
    (new.id, 'no_alcohol',   'Kein Alkohol heute',                 1, false, 1),
    (new.id, 'weekend_free', 'Ganzes Wochenende alkoholfrei',      3, true,  2),
    (new.id, 'sport',        'Sport gemacht statt Bier',           2, false, 3),
    (new.id, 'water',        '3 Liter Wasser getrunken',           1, false, 4),
    (new.id, 'sleep',        '8 Stunden geschlafen',               1, false, 5),
    (new.id, 'too_many',     'Mehr als 2 Bier an einem Tag',      -3, false, 6),
    (new.id, 'drunk',        'Betrunken gewesen',                 -5, false, 7);

  return new;
end;
$$;

create trigger on_challenge_created
  after insert on public.challenges
  for each row execute procedure public.handle_new_challenge();

-- ---------- Hilfsfunktion für RLS (vermeidet Rekursion) ----------

create or replace function public.is_member(c uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenge_members
    where challenge_id = c and user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(c uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenges
    where id = c and owner_id = auth.uid()
  );
$$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.point_rules enable row level security;
alter table public.checkins enable row level security;

-- profiles: alle eingeloggten dürfen Namen sehen (Leaderboard), nur eigenes ändern
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- challenges: lesen für alle eingeloggten (nötig für Beitritt per Code)
create policy "challenges_select" on public.challenges
  for select to authenticated using (true);
create policy "challenges_insert" on public.challenges
  for insert to authenticated with check (owner_id = auth.uid());
create policy "challenges_update" on public.challenges
  for update to authenticated using (owner_id = auth.uid());
create policy "challenges_delete" on public.challenges
  for delete to authenticated using (owner_id = auth.uid());

-- challenge_members
create policy "members_select" on public.challenge_members
  for select to authenticated using (public.is_member(challenge_id) or user_id = auth.uid());
create policy "members_insert" on public.challenge_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "members_delete" on public.challenge_members
  for delete to authenticated using (user_id = auth.uid() or public.is_owner(challenge_id));

-- point_rules: Mitglieder lesen, nur Owner ändert
create policy "rules_select" on public.point_rules
  for select to authenticated using (public.is_member(challenge_id));
create policy "rules_insert" on public.point_rules
  for insert to authenticated with check (public.is_owner(challenge_id));
create policy "rules_update" on public.point_rules
  for update to authenticated using (public.is_owner(challenge_id));
create policy "rules_delete" on public.point_rules
  for delete to authenticated using (public.is_owner(challenge_id));

-- checkins: Mitglieder sehen alles (Leaderboard), jeder schreibt nur eigene
create policy "checkins_select" on public.checkins
  for select to authenticated using (public.is_member(challenge_id));
create policy "checkins_insert" on public.checkins
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(challenge_id));
create policy "checkins_delete" on public.checkins
  for delete to authenticated using (user_id = auth.uid());
