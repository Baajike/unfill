-- Unfill: initial schema.
-- Run once in the Supabase SQL editor. Safe to read top to bottom.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text check (timezone is null or char_length(timezone) between 1 and 64),
  current_level int not null default 1 check (current_level between 1 and 11),
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 200),
  topic_tier text not null check (topic_tier in ('concrete', 'process', 'opinion')),
  target_seconds int not null check (target_seconds > 0),
  duration_seconds numeric(8, 1) not null check (duration_seconds >= 0),
  completed boolean not null default false,
  transcript text not null check (char_length(transcript) <= 50000),
  metrics jsonb not null default '{}'::jsonb,
  feedback jsonb,
  feedback_source text not null default 'none'
    check (feedback_source in ('gemini', 'groq', 'none')),
  created_at timestamptz not null default now()
);

create index sessions_user_id_created_at_idx
  on public.sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: users only ever see and change their own rows.
-- There are no delete policies, so deletes are denied.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

create policy "profiles: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "sessions: select own" on public.sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sessions: insert own" on public.sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sessions: update own" on public.sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Column privileges on top of RLS:
--  * users may set their timezone but never their own level
--  * nobody can choose a session's id or backdate created_at (the daily
--    rate limit counts rows by created_at)
revoke all on public.profiles from anon, authenticated;
revoke all on public.sessions from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, timezone) on public.profiles to authenticated;
grant update (timezone) on public.profiles to authenticated;

grant select on public.sessions to authenticated;
grant insert (
  user_id, topic, topic_tier, target_seconds, duration_seconds, completed,
  transcript, metrics, feedback, feedback_source
) on public.sessions to authenticated;
grant update (
  topic, topic_tier, target_seconds, duration_seconds, completed,
  transcript, metrics, feedback, feedback_source
) on public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Create a profile row for every new user.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Level up. Users cannot update current_level directly; this function checks
-- the rule itself (it takes no arguments, so the caller can't supply a level).
-- Keep in sync with lib/levels.ts.
-- ---------------------------------------------------------------------------

create function public.apply_level_up()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ladder int[] := array[1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60];
  max_effective_minutes constant int := 5;
  max_reachable_level int;
  lvl int;
  target int;
  recent_count int;
  qualifying_count int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select current_level into lvl from public.profiles where id = uid for update;
  if lvl is null then
    return null;
  end if;

  select count(*) into max_reachable_level
  from unnest(ladder) as minutes
  where minutes <= max_effective_minutes;

  if lvl >= max_reachable_level then
    return lvl;
  end if;

  target := least(ladder[lvl], max_effective_minutes) * 60;

  select
    count(*),
    count(*) filter (
      where s.target_seconds = target
        and s.completed
        and jsonb_typeof(s.metrics -> 'fillers_per_minute') = 'number'
        and (s.metrics ->> 'fillers_per_minute')::numeric <= 4
    )
  into recent_count, qualifying_count
  from (
    select target_seconds, completed, metrics
    from public.sessions
    where user_id = uid
    order by created_at desc
    limit 3
  ) as s;

  if recent_count = 3 and qualifying_count = 3 then
    update public.profiles set current_level = lvl + 1 where id = uid;
    return lvl + 1;
  end if;

  return lvl;
end;
$$;

revoke execute on function public.apply_level_up() from public, anon;
grant execute on function public.apply_level_up() to authenticated;
