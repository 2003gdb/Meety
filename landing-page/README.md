# Landing Page

**Owner:** Carlos

A minimal sign-up page, and the only way into the product.

## Signup flow

1. `/` → `/signup`: email magic link through Supabase Auth.
2. `/auth/callback` exchanges the link's code for a session. The link must be opened in the same browser that requested it.
3. `/onboarding`: name and phone number (required, phone stored as E.164), optional LinkedIn URL and X handle.
4. `/welcome`: **Text Meety** opens Messages with "Hey Meety" prefilled to the Photon line. The user sends the first text.

`/welcome` sends logged-out users to `/signup` and users without a phone to `/onboarding`.

The user texts first on purpose. Photon's [deliverability guide](https://photon.codes/docs/best-practices/imessage-deliverability) calls inbound-first "the decision that matters": it avoids Apple's "Report Junk" banner and the 50 new outbound conversations per line per day quota.

## Local setup

```bash
npm i
cp .env.example .env
npm run dev   # http://localhost:3000
```

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, the deployed URL in production |
| `NEXT_PUBLIC_PHOTON_NUMBER` | Meety's iMessage line in E.164, e.g. `+14155550123` (`photon spectrum lines ls`) |

`NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing them.

## Supabase setup

1. Run `supabase/migrations/0001_profiles.sql` in the SQL editor (or `supabase db push`).
2. Authentication → URL Configuration: set Site URL to the production URL and add `http://localhost:3000/auth/callback` and `https://<production-domain>/auth/callback` to Redirect URLs.
3. Authentication → Emails → SMTP: Supabase's built-in sender only delivers to project team members and is heavily rate limited. Add a custom SMTP provider (e.g. Resend) before letting the public sign up.

## Contract for the iMessage agent

Signups land in `public.profiles` (one row per `auth.users` row, created by a trigger on signup):

| Column | Notes |
| --- | --- |
| `id` | `auth.users.id` |
| `phone` | Unique, E.164 (`+14155550123`, enforced by a check constraint). Null until onboarding. |
| `email` | Copied from `auth.users` at signup |
| `full_name` | Entered at onboarding |
| `linkedin_url` | Optional, normalized to `https://www.linkedin.com/in/<slug>` |
| `x_handle` | Optional, without the `@` |
| `onboarded_at` | Set when onboarding saves the phone. Null means the user hasn't finished. |

To react to new signups (research, first message), add a Supabase Database Webhook on `profiles` UPDATE and act on rows where `onboarded_at` is set.

On each inbound iMessage:

- Normalize the sender handle to E.164 and look it up in `public.profiles.phone`. Use the service role key: RLS only lets a signed-in user read their own row.
- Row found: the user signed up. Use the other columns for matching.
- No row: reply with the landing page link so they sign up first.

A sender texting from an Apple ID email instead of a phone number won't match. `/welcome` tells users which number to send from.
