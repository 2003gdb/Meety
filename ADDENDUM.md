# Addendum to granola.md

Details pulled from the full Granola transcripts of the Sep 26, 2026 recordings that `granola.md` summarized. This file only adds to or corrects `granola.md`; it does not restate it. Transcripts are auto-generated from room audio, so names and some words are unreliable. Where a detail comes from inference rather than the transcript itself, it says so.

## Source coverage

| Recording | Granola ID | Status for this addendum |
|---|---|---|
| Jev Hackathon (w/ The AI Collective), kickoff. Calendar slot 10:00 AM, audio starts ~11:59 AM PDT | `7ac12ff2-46ce-438b-ad6d-74cedc88a58f` | Full transcript read |
| Requirements Gathering Jevcaton, 12:17 PM PDT | `240d47a3-4d49-47db-b116-0767d1969775` | Full transcript read |
| "New note" task-split session, ~1:03 PM PDT | not available | **Not retrievable.** It no longer appears in Granola listings or search. It may still be recording, unsynced, or deleted. Everything `granola.md` says about the task split is still unverified by this addendum. |

The requirements recording ends with the recorder stopping it to "move it to the computer and then we'll do another one." The task-split note is most likely that follow-up recording.

## Kickoff: details not in granola.md

- **Time budget:** the organizer said "You guys have three hours," with the clock at "12 o'clock, just about." That puts the end of hacking at roughly **3:00 PM**. This conflicts with `granola.md`'s ~2:30 PM estimate, which came from a teammate's "12:54 and like 90 minutes left" (≈2:24 PM). Confirm the real cutoff on Discord or Notion.
- **Submission goes through Luma,** backed by Hacker Squad for the 1-minute video.
- **Credits and prizes are split among listed team members,** which is why the organizers want the full team roster and contributor emails. This matters for the team-of-5 question.
- **Originality bar, quoted:** "If you show me a Snake demo, I might actually jump off of this building." Toy demos are penalized.
- **Anti-slop tells the organizer named:** little "eyebrow" labels, decorative dividers, and "it's not this, it's that" phrasing. The goal is that it "feel like somebody actually thought about" it. This applies to the landing page, the iMessage copy, and the demo video script.
- **Technical criterion:** stronger technical infrastructure and architecture is favored by judges.
- **Judges:** technical staff from xAI, Anthropic, and Cognition; YC-backed founders; CodeRabbit; angels and institutional investors.
- **Venue logistics:** COR HQ. Keep the space clean (it's the company's working floor). The rooftop is rented for hackers, but security doesn't unlock it. Get a key card from the interns, Hendrick, or Sarah. Questions go to the Discord channel (organizers and tool partners are there) and the Notion page. Slides were promised by email.

## Requirements meeting: details not in granola.md

### Who said what (inferred from the transcript)

The transcript labels five voices, Speaker A through E. Only one mapping is well supported:

- **Speaker B is very likely Martin.** B says they work at Autodesk, offers to build materials and present, and says "I have all the context with Granola." Inferred from content, not confirmed by Granola.
- **Speaker C proposed the networking-agent idea.** C had built a job-application tool at a previous hackathon and was told the space was too competitive. C also found the Luma MCP (`mcp.luma.com`).
- **Speaker E is likely "Gab/Gav."** B asks "Gab, are you sold on the idea?" and E answers. E pitched the job-application idea, pointed out the team was 5 against a max of 4, said Jev's model routing had benchmarked poorly, and **does not have Jev access yet**.
- **Speaker D** described the usual hackathon split (two people code, one does the demo, one does slides). D also surfaced a similar product someone built about three weeks earlier.
- **Speaker A** said "I'm gonna try to make a diagram of all the things we can do and then we can all divide and conquer." **This conflicts with `granola.md` and the Granola summary, which both assign the diagram to Martin.** If B is Martin, then someone else took the diagram. Confirm who owns it.

### Rejected ideas, with the detail that was dropped

- **Dropshipping research tool:** check about 10 competing store pages for a product, then decide whether it can be sold ~30% below their average price and still be profitable. Pitched by B, who said a family member runs a dropshipping business. Rejected because it's hard to fit into a Jev classification prompt.
- **Job-application filter:** Browserbase pulls job listings in bulk and Jev picks which ones to deliver. It fits Jev's "many decisions in parallel" strength well. Rejected for low novelty; C was told the space is very competitive at a prior hackathon.

### Prior art and why the team still went ahead

- Someone built a similar Luma matchmaker about three weeks earlier and "didn't present well." The team's read: the edge is the product framing, the pain point, and good visuals.
- B had been on a team at a go-to-market hackathon about two months earlier. Someone there later turned the idea into a product that got Luma data through a security exploit ("found exploit"). The team rejected that approach and chose the official route.
- A Chrome-extension matcher was also discussed. It only compares your profile against everyone else's. The team's differentiator is **profile plus a per-event goal**, so the same person can get different matches at different events (for example, product people at one event and engineers at the next).

### How the team understood Jev

- Jev takes text and returns a probability over **predefined options**. So each decision needs to be one prompt with all the context packed in: the attendee's gathered info, the user's profile, and the user's goal for the event, then "is this person related to what I want?"
- Advice attributed to the Jev team member: don't let an agent write complex questions to Jev on the fly. Use a fixed set of question templates and swap variables in.
- The idea of using Jev as an "airport controller" to route between LLMs, including GMI's multimodal models, was dropped after E's benchmark point. A cheap model handles routing and conversation instead.
- Jev fits best in the **live at-event case**, where the user needs an immediate yes/no with a probability (for example "yes, 60%"). One member (C) still wanted Jev "at every point" for judging credit, even where it performs worse.
- **Access:** B says they got Jev access "last Friday" but hasn't actively used it. E's access didn't work. B suggested going through GMI, unverified. The team agreed one working account is enough.

### Onboarding sequence, in the order it was worked out

1. A minimal landing page sign-up, possibly with SSO. It exists to gate access and prevent abuse (a "distributed attack" was the stated worry).
2. The sign-up email triggers a **Tavily** background search right away.
3. Handoff to iMessage via Photon. The first request is to log into Luma through the Browserbase credential flow.
4. From the user's Luma events, the agent offers the next one by default: "Are you coming to this event tomorrow?"
5. Identity check (the team called it "KYC"): "Is this you?" using the Tavily result. The user can supply LinkedIn and/or X instead.
6. "We noticed you're interested in X, and your next event is Y" — delivering value straight away.
7. The goal question: "What are you trying to get from this event?"

A concern was raised that this adds too much friction. The answer was to accept voice messages and transcribe them, estimated at about one minute, similar to answering a Luma application question.

### Data facts that shape the design

- **What attendees can see:** the same guest data the host sees, except the host also sees answers to the registration questions.
- **Guest lists are optional:** some events hide the attendee list. The kickoff event's own Luma page was one example of an event without a visible list.
- **LinkedIn vs. X personas:** many technical attendees are only on X, not LinkedIn, which is why X stays optional but supported.
- **Host-side option:** C suggested that a host could plug their own `mcp.luma.com` access into the agent and invite guests to text a number. The team noted this changes the target user to organizers. They kept attendees as the user, but the host route remains a possible extension.

### Demo and pitch notes

- **Live demo idea:** match people who are in the room, for example "I should talk to Cheryl because she also likes figuring out how to talk to customers." The team found this compelling but "very crazy."
- **Pitch hook:** "everybody can relate to the problem." Normal networking means walking up to random people and hoping.
- **Priority:** B's stated priority was to get the *what* right before the *how*.

## Corrections to granola.md

- The deadline is ~3:00 PM by the kickoff's "three hours," not ~2:30 PM (see above).
- Diagram ownership conflicts between the transcript (Speaker A) and the Granola summary (Martin).
- The third-meeting section in `granola.md` was written from a transcript that can no longer be retrieved. Treat its owner assignments as unverified.
