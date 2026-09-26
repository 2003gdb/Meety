-- Jev results per user and event, for the Meety project (profiles / events / attendees).
-- rankAttendees writes one row per attendee; the iMessage bot reads the top rows
-- (match = true, ordered by probability).
create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  event_id     uuid not null references events(id) on delete cascade,
  attendee_id  uuid not null references attendees(id) on delete cascade,
  goal         text not null,              -- the goal Jev judged against
  probability  real not null check (probability between 0 and 1),
  match        boolean not null,
  why          text,                       -- only for the top matches
  model        text not null default 'jev-latest',
  created_at   timestamptz not null default now(),
  unique (user_id, event_id, attendee_id)
);

-- Server-side only (service key bypasses RLS); no anon access.
alter table matches enable row level security;
