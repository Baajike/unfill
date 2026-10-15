-- Unfill: topic categories.
-- Run once in the Supabase SQL editor, after 0001_init.sql and BEFORE deploying the
-- code that writes topic_category (inserts fail until the column and grant exist).

-- Nullable: sessions saved before categories existed have none.
-- Keep the list in sync with TOPIC_CATEGORY_IDS in lib/types.ts.
alter table public.sessions
  add column topic_category text
    check (
      topic_category is null or topic_category in (
        'animals-nature', 'food', 'technology', 'money-work', 'travel-places',
        'health-habits', 'sports-games', 'culture-society', 'science',
        'politics-issues', 'everyday-life'
      )
    );

-- Recent topics within a category, for the no-repeat rule.
create index sessions_user_id_topic_category_created_at_idx
  on public.sessions (user_id, topic_category, created_at desc);

-- 0001 grants insert/update column by column, so the new column needs its own grant.
-- Table-wide select already covers it. RLS policies are unchanged.
grant insert (topic_category) on public.sessions to authenticated;
grant update (topic_category) on public.sessions to authenticated;
