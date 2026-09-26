-- Research columns added by the tavily-research lane to the shared Meety tables.
-- profiles  = people who signed up (Pass 1), attendees = event guests from Browserbase (Pass 2).
-- Existing columns (name, headline, company, bio, linkedin_url, x_handle) are left as the
-- sign-up / scraper wrote them; research only fills linkedin_url / x_handle when it finds one.
alter table profiles
  add column if not exists headline        text,
  add column if not exists location        text,
  add column if not exists summary         text,            -- what Jev reads
  add column if not exists interests       text[] not null default '{}',
  add column if not exists evidence        text[] not null default '{}', -- feeds the "why" line
  add column if not exists sources         jsonb not null default '[]',
  add column if not exists candidates      jsonb,           -- Pass 1 "Is this you?" options
  add column if not exists research_status text not null default 'pending'
    check (research_status in ('pending', 'ambiguous', 'done', 'no_match')),
  add column if not exists researched_at   timestamptz;

alter table attendees
  add column if not exists location        text,
  add column if not exists summary         text,
  add column if not exists interests       text[] not null default '{}',
  add column if not exists evidence        text[] not null default '{}',
  add column if not exists sources         jsonb not null default '[]',
  add column if not exists research_status text not null default 'pending'
    check (research_status in ('pending', 'ambiguous', 'done', 'no_match')),
  add column if not exists researched_at   timestamptz;
