# Photon setup and what we learned

How to get Meety running on real iMessage, plus the Photon behaviour we hit while testing on Sep 26. Read this before building anything that makes Meety text someone.

## Status

Tested end to end on a real iPhone. Inbound texts reach the server, Meety replies, and `/handoff` sends the welcome message. The project is on Photon's **Pro** plan, which uses a shared pool of lines.

## Setup

1. **Use the right credentials.** In [app.photon.codes](https://app.photon.codes), open the Spectrum **project** (ours is "Jev hackathon"), go to **Settings**, and copy the **Project ID** and **Project Secret**. The Project ID is a UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), and it is also in the dashboard URL. Don't use the values under **Developer → Apps**: those belong to an OAuth app and Photon rejects them with `VALIDATION_ERROR`.
2. **Fill in `.env`** from `.env.example` with `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET`.
3. **Allowlist every phone that will talk to Meety.** In the project, open **Users** and add each number: teammates, demo phones, judges. Pro allows 100. The **Texts on** column shows which Photon number that person should text.
4. **Start the server** with `npm start`. You should see `[meety] connected via imessage` and `[http] listening on :8787`.
5. **Text the Photon number first** from the allowlisted phone (see the next section), then run the handoff:
   ```bash
   curl -X POST localhost:8787/handoff -H 'content-type: application/json' -d '{"phone":"+1XXXXXXXXXX","name":"Your Name"}'
   ```
   The server logs every incoming text as `[meety] text from <handle> in <chat id>`. That's the quickest way to see which handle Photon matches a person to.

## Pro plan rules

These come from testing and Photon's docs. The Business plan (one dedicated number for the project) removes the first two.

| Rule | What happens | What it means for us |
|---|---|---|
| Only allowlisted **Users** can be messaged | Sending to anyone else fails with `Target not allowed for this project` | Every sign-up has to be added to Photon's Users list, by hand or through Photon, before Meety can reach them |
| **The user has to text first** | `/handoff` to an allowlisted number failed with `Target not allowed` until that phone had texted the line once; after that, the same call worked | Meety can't start a conversation with a brand-new sign-up. This is from our test, not stated in Photon's docs |
| Shared line pool | Different users may be given different Photon numbers | Don't hardcode one Meety number in the landing page. Read it from the user's **Texts on** column, or move to Business |
| 50 new conversations per line per day | Extra first messages are rejected | Fine for the demo |
| 5,000 messages per server per day | Extra sends are rejected | Fine for the demo |

### What this changes in onboarding

The landing page can't promise "we'll text you". How it works now:

1. The landing page calls `POST /handoff`. Meety registers the user and tries to text first.
2. If Photon refuses, the response is `{ "ok": true, "texted": false, "reason": "..." }`. The user is still registered.
3. The landing page then shows a **Text Meety** button: an `sms:` link to the Photon number with a message already typed, e.g. `sms:+1XXXXXXXXXX&body=hey Meety`. *(Landing page lane, not built yet.)*
4. Whatever the user's first text says, Meety replies with the welcome and onboarding carries on from there.

On the Business plan step 1 simply succeeds (`texted: true`), so the same code works on both plans.

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `SPECTRUM_PROJECT_ID should be the project's UUID` | The value isn't a Spectrum project ID | Copy it from the project's **Settings** (step 1) |
| `SpectrumCloudError ... VALIDATION_ERROR` | Same as above, on an older build | Same as above |
| `Target not allowed for this project` | The number isn't under **Users**, or that phone hasn't texted the line yet | Add it under Users, text the Photon number once, then retry |
| Still `Target not allowed` after both | Apple sends that person's iMessages from another handle (often their Apple ID email) | Open [debug.photon.codes](https://debug.photon.codes) on the phone; it replies with the real handle. Add that handle, or on the iPhone set **Settings → Messages → Send & Receive → Start new conversations from** to the phone number |
| Meety answers with the sign-up link | The server restarted, and users only live in memory | Run `/handoff` again |
| `/handoff` returns an error | Photon refused the send | The JSON `error` field and the server log carry Photon's reason |

## Useful links

- [Spectrum docs](https://photon.codes/docs/spectrum-ts/introduction)
- [iMessage lines and routing](https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing)
- [Photon CLI](https://photon.codes/docs/cli/spectrum): `npx @photon-ai/cli login`, then `projects ls` and `spectrum users add`
