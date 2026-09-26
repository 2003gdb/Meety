# Photon iMessage

**Owner:** Gab

The iMessage conversation with the user, built on Photon's [Spectrum SDK](https://photon.codes/docs/spectrum-ts/introduction) (`spectrum-ts`). It covers onboarding after sign-up and the live Q&A during events.

- Onboarding, 5–7 touch points: connect Luma → "Is this you?" → suggest the next event → "What are you trying to get from this event?" (voice messages are transcribed)
- Live Q&A during an event: "I'm in front of Carlos, what does he do?"
- If someone texts before signing up, send them the landing page link and stop there
- A cheap LLM runs the conversation; Jev only makes the yes/no calls

**Status:** v1 works on real iMessage (tested on an iPhone). Sign-ups, research, events and guest lists come from Supabase and matching from Jev when configured; the Luma login is still stubbed. Photon's Pro plan adds limits that change how onboarding starts; see [PHOTON_SETUP.md](PHOTON_SETUP.md) before building the landing page handoff.

## Run it

```bash
npm install
npm test               # flow + debounce tests, no network
npm run chat           # local chat in the terminal via Spectrum's terminal provider, no Photon account needed
npm start              # real iMessage; needs SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET
```

First time on real iMessage? Follow [PHOTON_SETUP.md](PHOTON_SETUP.md): the right credentials, allowlisting phones, and why each phone has to text Meety first.

Copy `.env.example` to `.env` and fill it in; the npm scripts load it automatically. With `ANTHROPIC_API_KEY` set, the conversation brain is `claude-haiku-4-5` (override with `MEETY_BRAIN_MODEL`); without it, a rule-based interpreter runs instead. The terminal provider downloads Photon's `tuichat` binary from GitHub on first run.

## How it works

```
iMessage ──► Spectrum (app.messages) ──► Inbox (debounce bursts, 1 turn per chat at a time)
                                             │
                                             ▼
                               Flow (state machine per phone number)
                                 │  Brain: rules first, Claude Haiku for anything fuzzy
                                 │  Services: users · luma · research · match(Jev) · transcriber
                                 ▼
                           reply bubbles ──► space.send()
```

| File | What it does |
|---|---|
| `src/index.ts` | Boots Spectrum and the HTTP server, reads messages, handles voice notes |
| `src/transport.ts` | iMessage (cloud) or terminal provider behind one interface |
| `src/flow.ts` | The conversation: onboarding steps, then live Q&A |
| `src/brain.ts` | Turns a user's text into an intent (yes/no, event choice, "ask about person"...) |
| `src/inbox.ts` | Burst debounce, per-chat serialisation, duplicate-delivery guard |
| `src/copy.ts` | Every line Meety sends, in one place |
| `src/contracts.ts` | **The interfaces other lanes implement** |
| `src/stubs.ts` | Demo stand-ins for those interfaces |
| `src/supabase.ts` | Real `UserDirectory`, `ResearchService` and `LumaService` reads: sign-ups and research from `profiles`, events and guest lists from `events` / `attendees` |
| `src/luma.ts` | Real per-user `LumaService` (with `BROWSERBASE_API_KEY`): Luma login in Browserbase shown at the website's `/connect-luma`, then the user's events and guest lists read from Luma into `events` / `user_events` / `attendees`. Needs `landing-page/supabase/migrations/0002_luma.sql` |
| `src/jev.ts` | Real `MatchService` (jev-integration's `rankAttendees` / `askAboutPerson`, results saved to `matches`) and `JevBrain` (Jev's `classifyInbound` routes open-ended messages once onboarding is done) |

Onboarding steps: `connect_luma → confirm_identity (→ ask_links) → pick_event → ask_goal → ready`. Once `ready`, the user can ask about anyone ("should I talk to Sherry?"), change their goal, or switch events.

## Integration points

### Calls into this module (HTTP, default port 8787)

If `MEETY_INTERNAL_SECRET` is set, send it as the `x-meety-secret` header.

| Endpoint | Caller | Body | Effect |
|---|---|---|---|
| `POST /handoff` | landing-page, right after sign-up | `{ phone, name?, email?, linkedinUrl?, xUrl? }` | Registers the user and tries to text them first. Returns `{ ok, texted, reason? }`. `texted: false` is normal on the Pro plan ([why](PHOTON_SETUP.md#pro-plan-rules)): the welcome then goes out as soon as the user texts Meety |
| `POST /notify` | whoever schedules the ~24h pre-event trigger | `{ phone, eventId? }` | Texts "you're down for X tomorrow, want me to prep you?" |
| `GET /health` | anyone | | `{ ok: true }` |

```bash
curl -X POST localhost:8787/handoff -H 'content-type: application/json' -d '{"phone":"+15551234567","name":"Sam Taylor"}'
```

### Calls out of this module (`src/contracts.ts`)

Swap the stub in `stubServices()` for the real implementation when each lane is ready. With `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` set, `index.ts` already uses `src/supabase.ts` for users and research (links the user texts in are researched with `TAVILY_API_KEY`). It also reads events and guest lists from Supabase; the Luma login itself is still a stub. With `TYPESAFE_API_KEY` set, Jev does the matching and message routing (`src/jev.ts`). For the terminal demo, set `MEETY_DEMO_PHONE` to a signed-up number.

| Interface | Lane | Methods |
|---|---|---|
| `UserDirectory` | landing-page (Supabase) | `findByPhone`, `upsert` |
| `LumaService` | browserbase-luma | `connectUrl`, `isConnected`, `upcomingEvents`, `attendees` (return `null` for a hidden guest list) |
| `ResearchService` | tavily-research | `profileFor`, `profileFromLinks`, `confirm` (user said "yes, that's me") |
| `MatchService` | jev-integration | `rank` (pre-event pass), `assess` (live yes/no + probability) |
| `Transcriber` | unassigned | `transcribe(audio, mimeType)`; the current stub returns `null`, so Meety asks the user to type instead |

On failure, `/handoff` and `/notify` return Photon's reason in the JSON `error` field.

## Known gaps in v1

- **The landing page needs a "Text Meety" button.** On the Pro plan Meety can't text a new sign-up first, so the user has to message first; Meety then replies with the welcome. See [PHOTON_SETUP.md](PHOTON_SETUP.md#what-this-changes-in-onboarding).
- **Every phone must be allowlisted** under Users in the Photon dashboard (Pro plan).
- **Sessions are in memory.** Onboarding progress is lost on restart (users and research come from Supabase when configured).
- **No voice transcription provider** has been picked yet.
- **No LLM without a key.** Without `ANTHROPIC_API_KEY`, replies are read by fixed rules, and unexpected wording gets "not sure I follow".
