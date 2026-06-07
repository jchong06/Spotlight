-- ============================================================
--  Spotlight — Supabase schema (accounts profile + saved favorites)
--
--  Run this once against your Supabase project, either by pasting it into the
--  SQL Editor (Dashboard → SQL → New query) or with the Supabase CLI:
--      supabase db push          # if using `supabase/migrations`
--  It is safe to re-run: every statement is idempotent.
--
--  Auth itself (users, passwords, sessions) is handled by Supabase Auth — this
--  file only adds the app-owned tables and the row-level-security that scopes
--  each row to the user who created it.
-- ============================================================

-- ---- profiles: one row per auth user ----
create table if not exists public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  name      text not null default '',
  city      text not null default '',
  home_lat  double precision,
  home_lng  double precision,
  created   timestamptz not null default now()
);

-- ---- favorites: saved shows, full event JSON keyed by (user, event id) ----
create table if not exists public.favorites (
  user_id   uuid not null references auth.users (id) on delete cascade,
  event_id  text not null,
  data      jsonb not null,
  created   timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created desc);

-- ---- row-level security: a user only ever sees/writes their own rows ----
alter table public.profiles  enable row level security;
alter table public.favorites enable row level security;

drop policy if exists "profiles are self-managed" on public.profiles;
create policy "profiles are self-managed" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "favorites are self-managed" on public.favorites;
create policy "favorites are self-managed" on public.favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- auto-create a profile row on signup, seeding name from signup metadata ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
