-- Unfill: word bank.
-- Run once in the Supabase SQL editor, after 0002_topic_category.sql and BEFORE deploying
-- the code that reads it (the home, session and words pages query this table).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- Keep the status list in sync with WordBankStatus in lib/types.ts.
create table public.word_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phrase text not null check (char_length(phrase) between 1 and 40),
  -- Case-insensitive uniqueness. A real column (not an expression index) so inserts can
  -- use ON CONFLICT (user_id, phrase_key) DO NOTHING through the API.
  phrase_key text generated always as (lower(phrase)) stored,
  replaces text check (replaces is null or char_length(replaces) between 1 and 120),
  source_session_id uuid references public.sessions (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'used', 'dismissed')),
  times_used int not null default 0 check (times_used >= 0),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Set only by record_word_use(), so one session can't be counted twice.
  last_used_session_id uuid references public.sessions (id) on delete set null,
  unique (user_id, phrase_key)
);

-- "Words to try": a user's new words, oldest first.
create index word_bank_user_id_status_created_at_idx
  on public.word_bank (user_id, status, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: own rows only. No delete policy, so deletes are denied.
-- ---------------------------------------------------------------------------

alter table public.word_bank enable row level security;

create policy "word_bank: select own" on public.word_bank
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "word_bank: insert own" on public.word_bank
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      source_session_id is null
      or exists (
        select 1 from public.sessions s
        where s.id = source_session_id and s.user_id = (select auth.uid())
      )
    )
  );
create policy "word_bank: update own" on public.word_bank
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Column privileges on top of RLS:
--  * new rows always start as 'new' with zero uses
--  * users may change the status (dismiss) but never the usage counters, which only
--    record_word_use() updates
revoke all on public.word_bank from anon, authenticated;

grant select on public.word_bank to authenticated;
grant insert (user_id, phrase, replaces, source_session_id) on public.word_bank to authenticated;
grant update (status) on public.word_bank to authenticated;

-- ---------------------------------------------------------------------------
-- Record that the caller used bank words in one of their sessions.
-- Only counts phrases that are in the caller's own bank (new or used) and appear in
-- that session's transcript. The app does exact whole-word matching first; this is a
-- coarser re-check so the counter can't be bumped with arbitrary phrases.
-- ---------------------------------------------------------------------------

create function public.record_word_use(p_session_id uuid, p_phrases text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  spoken text;
  updated int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_phrases is null or cardinality(p_phrases) = 0 then
    return 0;
  end if;
  if cardinality(p_phrases) > 50 then
    raise exception 'too many phrases';
  end if;

  -- Same normalisation as lib/word-bank.ts: lowercase, straight apostrophes, single spaces.
  select regexp_replace(translate(lower(s.transcript), '‘’', ''''''), '\s+', ' ', 'g') into spoken
  from public.sessions s
  where s.id = p_session_id and s.user_id = uid;
  if spoken is null then
    raise exception 'session not found';
  end if;

  update public.word_bank w
  set times_used = w.times_used + 1,
      status = 'used',
      last_used_at = now(),
      last_used_session_id = p_session_id
  where w.user_id = uid
    and w.status in ('new', 'used')
    and w.last_used_session_id is distinct from p_session_id
    and w.phrase_key in (select lower(trim(p)) from unnest(p_phrases) as p)
    and strpos(spoken, w.phrase_key) > 0;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke execute on function public.record_word_use(uuid, text[]) from public, anon;
grant execute on function public.record_word_use(uuid, text[]) to authenticated;
