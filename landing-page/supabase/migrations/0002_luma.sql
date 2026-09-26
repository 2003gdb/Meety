-- Per-user Luma login (browserbase-luma, used by photon-imessage/src/luma.ts) and the
-- events each user is going to. Safe to re-run.

-- The Browserbase context holding their Luma cookies, and the login session while they sign in.
alter table public.profiles
  add column if not exists luma_context_id   text,
  add column if not exists luma_session_id   text,
  add column if not exists luma_connected_at timestamptz;

-- Which events each user is going to (read from their Luma home page).
create table if not exists public.user_events (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  notified_at timestamptz,                  -- the day-before text went out
  created_at  timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.user_events enable row level security; -- service key only

-- Events and guests are upserted by their Luma URL.
alter table public.events alter column id set default gen_random_uuid();
create unique index if not exists events_luma_url_key on public.events (luma_url);

alter table public.attendees alter column id set default gen_random_uuid();
alter table public.attendees add column if not exists luma_url text; -- guest's luma.com/user/... page
create unique index if not exists attendees_event_luma_url_key on public.attendees (event_id, luma_url);
