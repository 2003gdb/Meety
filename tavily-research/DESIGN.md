# Design: Tavily Research

**Owner:** Martin
**Status:** Built and tested live, Sep 26 2026. Supabase read/write verified on the shared Meety project.

## Problem

Meety needs to know who the user is and who else is at their event, without making anyone type out their profile. This lane does that research in two passes:

1. **Pass 1, the user.** Runs when someone signs up. Finds who they are, then asks them to confirm: "Is this you?"
2. **Pass 2, the attendees.** Runs when Jozi's lane returns the attendee list. Builds a short profile for each person.

The user's goal for the event is not part of this lane's research. It is used later, when Jev decides each match and the conversation model writes a "why you two should talk" line.

## What makes this cool

- The "Is this you?" message comes with specific evidence, not a form. For example, "Martin Galaz, Partner Integration at Autodesk, SF?"
- When a name is shared with other people, the user picks from a short numbered list. With "Martin Galaz" that list includes a singer with millions of Spotify streams, which makes a funny, relatable demo line.
- The "why you two should talk" line cites something real the attendee did, such as a post they liked or a talk they gave.

## Verified facts (tested today with the Tavily MCP)

| Claim | Result |
|---|---|
| A name alone is ambiguous | Searching "Martin Galaz" returned a singer (Spotify, last.fm), someone else's Instagram, plus Martin's LinkedIn and martingalaz.com. |
| Name plus one hint finds the person | "Martin Galaz Autodesk", limited to linkedin.com and x.com, returned Martin's LinkedIn profile and posts as the top results. |
| Tavily extract reads LinkedIn with no login | Extracting `linkedin.com/in/martingalaz` at `advanced` depth returned the headline, location, education, certifications, volunteering and ~12 recently liked posts. Experience came back as "N/A". |
| Tavily extract reads X | It returned the bio, location and link. Martin's posts are protected, so the posts of public accounts are **not tested**. |
| Tavily extract reads public X posts | `x.com/rauchg` returned bio, location and recent posts. |
| Latency | Extract: ~0.4–1 s per profile. Search: ~1–1.5 s. GMI summary: 4 s typical, up to 70 s under load, so calls are capped at 45 s with a heuristic fallback. |
| Posts mention other people | A name search for "Guillermo Rauch Vercel" returned a Stripe post titled "Vercel CEO Guillermo Rauch on AI". Matches now require authorship: a profile page in the person's name, or a post titled "<Name> posted…". Pass 2 accepts profile pages only. |

This overturns the meeting note that LinkedIn "cannot scrape without credentials". We do not need anyone's LinkedIn password.

## Premises

1. The sign-up form collects **name and email only**. Tavily does the identifying.
2. A personal email (gmail, icloud, outlook and similar) gives no hint to search on. A work email's domain gives a company hint. The name is always required.
3. Luma guest profiles usually include LinkedIn and X links, so attendee research reads URLs instead of searching names. This is inferred, and Jozi has to confirm what the attendee list actually contains.
4. GitHub was rejected as a data source in the requirements meeting, so neither pass searches it.
5. Profiles are neutral: they do not depend on any particular goal. The goal only comes in at match time, so one attendee profile can serve every user at the same event.

## Pass 1: the user

**Trigger:** a new sign-up row in Supabase (Carlos's lane).
**Input:** `{ user_id, name, email }`

Steps:

1. **Pick a hint.** Take the email domain. If it is not a personal email provider, turn it into a company name (for example `autodesk.com` becomes `Autodesk`).
2. **Search.** Run `tavily_search("<name> <company?>", include_domains=["linkedin.com","x.com"], max_results=5, search_depth="advanced")`. Without a company hint, run the name alone.
3. **Build the candidates.** Group the results by person, using the profile URL as the key. Keep at most 3 people, and give each one a single line built from the result: headline, company and city.
4. **Save.** Set the user's `research_status` to `ambiguous` and store the `candidates` list. Gab's bot then sends:

   > Is one of these you?
   > 1) Martin Galaz, Partner Integration, Autodesk, SF
   > 2) Martin Galaz, singer, Mexico
   > 3) None of these. Send me your LinkedIn or X link.

5. **When the user picks a number or pastes a link:** extract that URL at `advanced` depth, then summarize it with the conversation model (see the output schema below) and set `research_status` to `done`.
6. **Show value right away.** The user's `interests` feed the "We noticed you're into X, and your next event is Y" message.

If step 2 finds only one strong candidate, the bot still asks, but shows just that one line.

## Pass 2: attendees

**Trigger:** Jozi's lane writes the attendee list for an event.
**Input, per attendee (confirmed by Jozi):** first name, last name, email, and a LinkedIn or X link when shared. `fromLuma()` normalizes the row; a work email's domain becomes the company hint.

This pass runs as soon as the list arrives. It does not wait for the user's goal.

1. **Attendees with a LinkedIn or X link:** batch the URLs 20 at a time into `tavily_extract(extract_depth="advanced")`, then summarize each person.
2. **Attendees with no links:** if their email is a work email, run one basic search on name plus company. Keep the result only if it is a profile page in their name that also mentions the company. Otherwise mark them `no_match`. A personal email gives no hint, so there is no search. This avoids the singer problem for people who never get asked "Is this you?"
3. **Skip attendees researched in the last 7 days.** Research sits on the attendee row, not per user, so a second user at the same event costs nothing.

## Output: research columns on the shared Meety tables

The Meety Supabase project (`fobnnyklnsnpltxisiph`) has `profiles` (sign-ups), `events` and `attendees` (both from the Browserbase scraper). Research is written onto those rows rather than into a separate table, so Jev and the bot read one row per person. Migration `tavily_research_columns` (`schema.sql`) added these columns, applied 2026-09-26:

| Column | On | Notes |
|---|---|---|
| `headline` | profiles only | attendees already have one from Luma, left as scraped |
| `location` | both | |
| `summary` | both | 2–3 plain sentences; this is what Jev reads |
| `interests` | both | 3–6 short tags taken from posts and likes |
| `evidence` | both | 1–3 short, specific facts, used to write "why you two should talk" |
| `sources` | both | The URLs used, so any claim can be traced back |
| `candidates` | profiles only | Pass 1: the "Is this you?" list |
| `research_status` | both | `pending`, `ambiguous`, `done` or `no_match` |
| `researched_at` | both | Pass 2 skips rows researched in the last 7 days |

Existing columns (`name`, `headline`, `company`, `bio`) are never overwritten. `linkedin_url` / `x_handle` are filled in only when research finds a link.

**Summarizing:** one call to the conversation model per person turns the raw extract into `headline`, `summary`, `interests` and `evidence` as JSON. The prompt stays fixed and only the extracted text changes, which follows the team's deterministic-prompt rule. The model must not add facts that are not in the extract. If a field isn't there, it stays empty.

## Handoff to jev-integration and the "why" line

This handoff is also Martin's work, with Carlos and Shrey.

- **Jev template:** `Profile of the user: {user.summary}. Their goal at this event: {goal}. Profile of the attendee: {attendee.summary}. Should the user seek out this attendee? yes/no`. Jev returns yes or no with a probability.
- **"Why" line:** for the top Jev "yes" results, the conversation model gets both profiles, the goal and the attendee's `evidence`. It writes one sentence that cites one real fact.
- Pass 2 runs before the goal is known (the chosen option 5B), so the goal is used only in these two steps.

## Credit budget

| Item | Credits (inferred from Tavily pricing, not measured) |
|---|---|
| Pass 1: one advanced search and one extract | ~3–4 per user |
| Pass 2: 100 attendees with links (20 batches, advanced) | ~40 per event |
| Pass 2: ~30 attendees without links (basic search) | ~30 per event |
| One demo run | ~75, so about 13 full runs fit in the free 1,000 credits |

For demo rehearsals, cap Pass 2 at the first 30 attendees so the budget covers them.

## Relation to roommate-finder

Martin's `roommate-finder` already did Tavily research. Per decision 11B, nothing was copied into this public repo; these ideas were **rewritten fresh**:

- Parallel Tavily calls where one failure never sinks the batch (`extract` never throws).
- URL cleanup into one canonical profile URL (`profileKey`).
- Scraped text is untrusted: strip `<>`, truncate, wrap in tags, tell the model to treat it as data.
- Parse JSON, retry once, then normalize every field before it reaches the table.
- Same-name disambiguation, now the "Is this you?" candidate list.

What changed: one GMI call per person instead of 4 chained Claude calls, extract instead of search snippets, and plain `fetch` instead of an SDK.

## Build status

| Step | Status |
|---|---|
| Tavily client, GMI client | Done, live-tested |
| Pass 1 `findUserCandidates` + `confirmUser` | Done, live-tested on Martin |
| Pass 2 `researchAttendees` + `fromLuma` / `fromAttendeeRow` | Done, live-tested on 4 guests (link, X only, name + work email, name + gmail) |
| Jev templates + `whyLine` | Moved to `jev-integration/` (single owner for Jev prompts); it imports `src/llm.ts` |
| Supabase `store.ts` (`saveCandidates`, `saveUserResearch`, `researchEvent`) | Columns applied; read + PATCH verified against the live `attendees` table (test row restored). Full `event` run not done yet |
| Unit tests | 9 passing (`npm test`) |

## Open questions for other lanes

- **Gab:** which language and runtime does the bot use? This lane follows it (option 2C). Until Gab answers, the module assumes TypeScript on Node, with plain `fetch` and no SDKs.
- **Jozi:** answered. The scraper writes `attendees` rows directly; research keys on `attendees.id`, so no Luma user ID is needed.
- **Carlos:** answered. The landing page runs Pass 1 in `after()` when onboarding saves the profile (`landing-page/src/lib/research.ts`). With no links it summarizes the top candidate and leaves it `ambiguous`; the bot's "yes" marks it `done` (`photon-imessage/src/supabase.ts`).
- **Privacy, for the pitch:** Pass 2 profiles attendees who never signed up. It uses only public pages, and the user only ever sees the one-line reason to talk to someone, never a full profile. Say this in the demo before a judge asks.

## Risks

- **Stale or indexed data.** Extract seems to return an indexed copy of LinkedIn, not a live page, because Experience came back "N/A". Old profiles may be out of date.
- **Speed.** GMI latency swings from 4 s to 70 s. With 8 calls in parallel and a 45 s cap, 100 attendees should take ~6 minutes (estimate). Start Pass 2 as soon as the list arrives.
- **Wrong person.** Name matching can still pick the wrong person in Pass 2, where nobody confirms the match. The rule of keeping only clear matches is the defense, and it trades coverage for accuracy.
