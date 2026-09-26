# Tavily Research

**Owner:** Martin

Finds out who the user is and who else is at their event, so nobody types out a profile. See [DESIGN.md](DESIGN.md) for the full design.

- **Pass 1, the user:** name + email → up to 3 "Is this you?" candidates → the picked LinkedIn/X page is summarized onto the user's `profiles` row.
- **Pass 2, attendees:** the event's `attendees` rows (from the Browserbase scraper) are researched in place. Guests without a link get a name search using their work-email company, kept only when a profile page matches; otherwise `no_match`.
- **Handoff to Jev:** the Jev templates and the "why you two should talk" line live in [../jev-integration](../jev-integration), which reads `profiles` / `attendees` rows and reuses `src/llm.ts`.

## Run

Node 23.6+ (runs TypeScript directly, no dependencies).

```bash
npm test
node src/cli.ts user "Martin Galaz" martin@autodesk.com [--save <profile_id>]
node src/cli.ts confirm "Martin Galaz" https://www.linkedin.com/in/martingalaz [--save <profile_id>]
node src/cli.ts attendees guests.json   # print only
node src/cli.ts event <event_id>        # research the event's attendees rows, skipping ones done this week
```

## Keys

Each key is read from an env var, or from a gitignored `*.key` file in this folder. Never commit them.

| Env var | File | Used for |
|---|---|---|
| `TAVILY_API_KEY` | `tavily.key` | search + extract |
| `GMI_API_KEY` | `gmi.key` | summaries and the "why" line (heuristic fallback without it) |
| `GMI_BASE_URL`, `GMI_MODEL` | | defaults: `https://api.gmi-serving.com/v1`, `deepseek-ai/DeepSeek-V4-Pro` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `supabase.key` | reading and writing `profiles` / `attendees` (research columns in `schema.sql`) |

## Code

| File | What |
|---|---|
| `src/tavily.ts` | Tavily search + batched extract |
| `src/llm.ts` | GMI chat → JSON, 45 s timeout, retry once |
| `src/research.ts` | Pass 1, Pass 2, `fromLuma` adapter, name/author matching |
| `src/store.ts` | Supabase reads/PATCHes, 7-day freshness skip, `researchEvent` |
| `schema.sql` | the research columns on `profiles` and `attendees` (applied) |
