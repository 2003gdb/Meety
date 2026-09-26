# Jev Integration

**Owners:** Martin, Carlos, Shrey

Jev (TypeSafe's System One model) makes Meety's decisions. The conversation model only writes text. Every question sent to Jev is a fixed template in [src/templates.ts](src/templates.ts). No agent writes free-form prompts to Jev.

## The three decisions

| Function | When it runs | Jev question | What code does with the answer |
|---|---|---|---|
| `rankAttendees(user, goal, attendees)` | Pre-event pass, ~24 h before | One **Noul** per attendee: "Would talking to `attendee` help `user` make progress on `goal`?" Sent in batches of 25, with the user and goal in `state` once per batch | Sorts by probability. `match = p >= 0.5`. Failed batches are returned in `failed` and never throw. |
| `askAboutPerson(user, goal, person, topic?)` | Live at the event: "Should I talk to Priya about hiring?" | The same Noul, plus a topic Noul when a topic is given. Both go in one call | The topic decides when present. `formatVerdict` gives "Yes, 72%". |
| `classifyInbound(message, botLastQuestion)` | Every inbound iMessage | One **Choice** over `ask_about_person`, `event_goal`, `identity_reply`, `matches_request` and `other` | Routes in code when confidence ≥ 0.5. Otherwise the conversation model handles the message. |

`whyLine(user, goal, attendee)` writes the "why you two should talk" sentence for the top matches only. It uses GMI through `tavily-research/src/llm.ts` and must cite one of the attendee's `evidence` facts. With no GMI key it falls back to quoting the first fact.

`classifyInbound` is intent routing, which is a documented Jev pattern. The team's decision against Jev covered **model** routing (picking which LLM to call), and this does not do that.

## Inputs

`Person` is what Jev reads: `id`, `name`, `headline`, `location`, `summary`, `interests` and `evidence`. `src/store.ts` builds it from Supabase. An attendee's headline becomes "headline at company", and the bio fills both `summary` and `evidence`. A user's `profiles` row carries their own research (`headline`, `location`, `summary`, `interests`, `evidence`). An attendee's research columns are added on top of the bio only once `research_status = 'done'`. Jev only sees `name`, `headline`, `location`, `summary` (clipped to 1,200 chars) and up to 6 `interests`. The Jev docs say accuracy drops as the state fills with irrelevant detail, so sources and evidence stay out.

Attendee text is written by strangers. Each question fences it off with a note and uses explicit criteria. The demo fixture includes a prompt-injection line on "Dana Kim" so you can check how Jev handles it.

## Output

[schema.sql](schema.sql) adds a `matches` table (Carlos owns Supabase). It holds one row per user, event and attendee, with the probability, the `match` flag, the `why` line for top matches, and the Jev model version.

## Run it

Needs Node ≥ 23.6 and no install step. The key goes in `TYPESAFE_API_KEY` or in the gitignored `jev-integration/jev.key`.

```bash
npm test
```

```bash
node src/cli.ts match fixtures/demo.json
```

```bash
node src/cli.ts ask fixtures/demo.json priya "fixing trial activation"
```

```bash
node src/cli.ts intent "should I talk to Priya?" "What are you trying to get from this event?"
```

Live data comes from the Meety Supabase project (`fobnnyklnsnpltxisiph`). The user is a `profiles` row, looked up by id or by `+phone`. The guests are the `attendees` rows for the event; duplicate rows for the same person are dropped. `--save` writes the ranked rows to `matches` ([schema.sql](schema.sql), applied Sep 26). Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, or put both in the gitignored `jev-integration/supabase.key`.

```bash
node src/cli.ts match-event <profile_id|+phone> <event_id> "find a design partner" --save
```

For testing, [seed/demo-user.ts](seed/demo-user.ts) creates a fake user, Alex Rivera (`22222222-2222-4222-8222-222222222222`, `+15555550100`). The seeded event is `11111111-1111-4111-8111-111111111111`.

```bash
node seed/demo-user.ts
```

```bash
node src/cli.ts match-event +15555550100 11111111-1111-4111-8111-111111111111 "find a design partner for an iMessage event assistant" --dry
```

Add `--dry` to any command to print the exact request body without calling Jev. The fixture's people are fictional.

## Status (Sep 26, ~2:30 PM)

- **Verified:** the request and response shapes follow the published API reference (`POST https://api.typesafe.ai/v1/systemone`, `docs.typesafe.ai/api.md`). All 8 unit tests pass against a fake Jev, and the dry-run bodies match the spec. The GMI "why" line works live, at about 5–6 s per line.
- **Not verified:** no call has reached Jev yet because no TypeSafe key is on this machine. The 0.5 thresholds and the batch size of 25 are starting guesses. Run `match` on the fixture once there's a key, and tune from there.
- **Integration points:** Gab's bot calls `classifyInbound` on each message, then `askAboutPerson` or reads `matches`. The event's `attendees` rows feed `rankAttendees` through `match-event`.
