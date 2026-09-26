Searched all meetings from today (Sep 26): the kickoff "Jev Hackathon (w/ The AI Collective)", this "Requirements Gathering Jevcaton" meeting, and the "New note" task-split session. Here's the export — copy it into `MEETING_CONTEXT.md` (I can't create files):

---

# MEETING_CONTEXT.md

> Source data export from three meetings on Sep 26, 2026. NOT an implementation plan. Anything not established in the meetings is marked NOT SPECIFIED.

# Project and demo goal

- **Project:** Event networking agent for Luma events. A personal agent that matches an attendee with the right people at an event based on their profile (LinkedIn, optionally X) **plus their stated goal for that specific event** — not just profile-to-profile matching (this goal-context is the stated differentiator vs. prior similar tools).
- **Interface:** primarily iMessage (via Photon), with a minimal sign-up landing page.
- **Long-term vision (stated, not in scope for demo):** personal agent for all events — including suggesting future events worth attending.
- **Demo goal:** working prototype with a video of the thing working plus a live presentation/demo. A live matchmaking demo at the actual event was raised as a "very crazy" stretch idea, not committed.

# Latest agreed decisions

1. **Chosen idea:** event networking agent (rejected alternatives: dropshipping product-viability research tool; job-application filtering agent — job idea judged too competitive/low novelty by prior hackathon feedback).
2. **Target user:** the event attendee (not the host). Host-only Luma MCP was considered and rejected because attendee-credential access via Browserbase covers the need.
3. **Luma data access:** Browserbase using the user's own Luma credentials. Luma MCP (mcp.luma.com) is host-only — not used. An illegal/exploit-based Luma access method someone else used previously was explicitly rejected.
4. **Jeff (Jev) usage:** used for classification decisions (yes/no match + probability). Use Jeff at as many points as possible for judging points (per team member preference), BUT do NOT use Jeff for model routing (benchmarked poorly) — use a separate cheap LLM as the conversation "brain."
5. **Prompting approach:** deterministic — swap variables into pre-built prompt templates rather than letting an agent freeform prompts to Jeff ("the less deterministic, the better" was the agreed direction, per guidance from the Jeff team person).
6. **Data sources per user:** LinkedIn required, X optional, GitHub rejected (too technical-only).
7. **Build order:** nail the onboarding flow first; the live at-event use case second. "Get the what correct" before the how.
8. **Onboarding scope:** 5–7 touch points maximum.
9. **UI:** as little UI as possible; a simple sign-up landing page is needed (partly to prevent abuse/distributed attacks). UI should be "cool, simple and minimalist." Sign-up via SSO discussed; Supabase named as making it "very simple".
10. **Chat-session decision (post-meeting, from Martin):** the landing page is the single entry point; if an unregistered user texts the agent, reply prompting them to sign up at the landing page and do not proceed. (Established in chat, not in a recorded meeting.)
11. **Repo:** team agreed to create a base GitHub repo with a context markdown file so members can build pieces in parallel. Repo not yet created at time of recording.

# Requested features, ranked by importance if the meetings establish a ranking

Explicit ranking: onboarding flow first, live at-event use case second. Otherwise no numeric ranking established.

1. **Onboarding flow (build first):** landing page sign-up → Photon iMessage handoff → Luma credential connect (Browserbase) → background research on user (Tavily) with "Is this you?" confirmation → surface next Luma event → ask "What are you trying to get from this event?" (voice message supported, transcribed).
2. **Pre-event matching:** 24-hour pre-event research; per-person yes/no relevance decisions via Jeff; deliver matched attendees with reasoning.
3. **Live at-event Q&A (build second):** user texts mid-event ("I'm in front of Carlos, what does he do?" / "Can I talk to Sherry about X?"); Jeff answers yes/no with probability and reasoning.
4. **Optional/idea-stage:** generate artifacts for the user via GMI Cloud multimodal, sent over iMessage — raised, not committed.

# User flow and expected demo

- **Triggers (from notebook diagram):** (1) Notification Agent fires before event; (2) user registers to event.
- **Starting points:** (1) Conversation iMessage Prep; (2) Ask About Person.
- **Activity flow (from notebook):** Sign Up Online → Photon iMessage → Luma Signup; Scrape X/LinkedIn of person ⇄ Next Event Suggestion → "Goal at event?"
- **Trigger timing discussed:** ~one day before the event the agent messages the user.
- **Expected demo/deliverable:** video demo of the working product + live presentation. From this meeting: "no slides" understood (one member was verifying against the Notion page — unconfirmed). Kickoff meeting adds: 1-minute video walkthrough required to submit via Hacker Squad, hosted URL judges can open, public repo.

# Tech stack, tools, APIs, and repository details mentioned

- **Photon** — iMessage interface (onboarding conversation + live at-event chat)
- **Browserbase** — Luma scraping/automation with user credentials; open question on credential/session handoff (see Open questions)
- **Tavily** — background research; described as ~1,000 free credits/month, near-free, triggered at sign-up
- **Jeff (Jev)** — classification (yes/no + probability); only one team account has access so far; possibly reachable through GMI (unconfirmed)
- **GMI Cloud** — multimodal / outsourced LLMs / image generation (optional)
- **Cheap LLM (unnamed)** — conversation brain and routing; model NOT SPECIFIED
- **Supabase** — mentioned for simple sign-up/SSO
- **LinkedIn / X scraping** — LinkedIn "very locked up," cannot scrape without credentials; discussed collecting credentials as part of signup
- **Luma MCP (mcp.luma.com)** — evaluated, host-only, not used
- **Repository:** public GitHub repo required, MIT or Apache 2.0 license. A base repo with a project-context markdown file was agreed; ownership of creating it was informally claimed but attribution is ambiguous in the transcript. Repo name/structure NOT SPECIFIED.

# Team members, responsibilities, and availability mentioned

- **Team size:** 5 people at the table (note: kickoff rules say teams of 1–4; someone at the event reportedly said 5 "was fine" — unresolved, see Open questions).
- **Names:** Only Martin Galaz is identified with certainty. One member introduced as "Gav"/Gab (spelling uncertain). Others unidentified (in-person meeting, speakers not labeled).
- **Responsibilities (from the task-split session, most speaker attribution unavailable):**
  - Sign-up online / landing page / presentation — claimed by one member ("I can do the sign-up online and the landing page and the presentation")
  - iMessage workflow / user conversation — claimed by one member
  - Photon iMessage messaging on sign-up — needs an owner
  - Luma signup via Browserbase — needs an owner
  - X + LinkedIn scraping of the person — needs an owner
  - Agent conversation workflow (next-event suggestion, goal question) — identified as the main remaining gap
  - "Jest integration" (likely Jeff/Jev — transcription ambiguity) — assigned but owner NOT SPECIFIED
  - GitHub repo creation — informally claimed, owner ambiguous
- **Split model:** 2–3 people build distinct pieces, then reconvene to integrate. Also discussed (from prior hackathon habits): two people code, one demo, one slides/presentation.
- Martin stated he is good at building presentations with AI and can do materials + presenting.
- **Availability:** NOT SPECIFIED beyond the event window (~90 minutes remained at 12:54 PM during this meeting).

# Existing assets, links, designs, credentials needed (NEVER include secrets)

- **Notebook diagrams (photographed):** judging criteria page; "User Agent" diagram with Triggers (Notification Agent Before Event; Register to Event), Starting points (Conversation iMessage Prep; Ask About Person), and Activity flow (Sign Up Online → Photon iMessage → Luma Signup; Scrape X/LinkedIn Person ⇄ Next Event Suggestion → Goal at event?)
- **Awesome Jev:** awesomejev.com — reference gallery of Jeff projects
- **Event Notion page + Discord channel** — for questions/tools; slides sent via email
- **Credentials needed (types only, no secrets):** user Luma credentials (via Browserbase flow); user LinkedIn (and optional X) profile info, possibly LinkedIn credentials collected at signup; Jeff API access (one account confirmed); Tavily account; GMI Cloud access; Photon setup.
- **Granola meeting context** — Martin offered his notes as shared context for the team.
- Prior related asset mentioned but NOT owned/used: a Chrome-extension profile-matching tool seen previously (rejected as comparison point); Martin's earlier "Overlap" Luma extension existed in a July hackathon context but was not adopted here.

# Constraints, judging criteria, and deadline

- **Judging (25% each):** (1) Use of Jev — how central to architecture; (2) Originality/Novelty — no "1,000,000,001st B2B SaaS app"; (3) Technical/Architecture — understandable and usable, accessibility evidenced not claimed; (4) Anti-Slop — clean, intentional product, no generic AI tells. (This meeting's shorthand: Jeff use / novelty / architecture / anti-slop.)
- **Rules:** teams 1–4 (conflict: this team has 5, verbally waived per one member); free and partner resources only; everything open source — public repo, MIT or Apache 2.0.
- **Submission:** working prototype at a hosted URL; public GitHub repo; team names + contributor emails; tag @TypeSafe AI x @AICollectiveCo on X; 1-minute video walkthrough via Hacker Squad.
- **Deadline:** exact time NOT SPECIFIED; at 12:54 PM the team noted ~90 minutes left (implying roughly a 2:30 PM working deadline for building).
- **Legal constraint:** exploit-based Luma data access explicitly rejected; official/user-credential routes only.

# Open questions and conflicting statements

- **Can Browserbase access the Luma attendee list with user credentials?** Core assumption; team said it must be proven before building anything else. Unresolved.
- **Credential/session handoff:** can credentials/cookies/session be passed to the browser agent and persisted? Proposed (ask user once, save cookies/session), not verified.
- **Attendee list availability varies by event** — some Luma events don't expose the attendee list; unresolved how to handle those.
- **Team size 5 vs. rule of 1–4** — one member said organizers were "fine with it"; not formally confirmed.
- **Slides or not:** "video only + live presentation, no slides" stated, but a member was still checking the Notion page for submission requirements. Kickoff requirements (hosted URL, tagging on X) were not discussed in this meeting — reconcile before submitting.
- **Jeff access:** only one member has working access; whether Jeff can be used via GMI is unconfirmed; how the organizers grant access to all was raised, unanswered.
- **"Jest integration"** in the task-split transcript — almost certainly Jeff/Jev, but the transcript says "Jest"; flagged rather than resolved.
- **Repo creation ownership** — informally claimed ("Yeah, I can do it" / "just do it") but speaker identity ambiguous; repo not created as of the 1:03 PM session.
- **Conversation workflow** — identified as "the one thing that's missing" in the task-split session; design NOT SPECIFIED beyond "defined set of things, let the AI handle deviations."
- **Conflicting framing (resolved late in meeting, note history):** host-as-user vs. attendee-as-user — final direction was attendee; earlier statements favoring host-targeting are superseded.
- **LinkedIn scraping method** — LinkedIn is credential-gated; collecting credentials at signup was proposed but not finalized.

# Meeting-by-meeting provenance for important decisions

**1. Jev Hackathon kickoff (w/ The AI Collective) — Sep 26, 10:00 AM**
- Judging criteria (4×25%), anti-slop definition, originality guidance
- Rules: teams 1–4, free/partner resources, open source (MIT/Apache 2.0)
- Submission: hosted URL, public repo, team details, X tagging, 1-min video
- Resources: awesomejev.com, Discord, Notion, judges' backgrounds

**2. Requirements Gathering Jevcaton — Sep 26, 12:17 PM (current meeting)**
- Idea selection: event networking agent chosen over dropshipping research and job-application ideas
- Differentiator: profile + per-event goal context
- Attendee (not host) as target user; Browserbase with user credentials over host-only Luma MCP; exploit route rejected
- Jeff for classification (yes/no + probability); cheap LLM for routing/conversation; deterministic prompt templates
- LinkedIn required / X optional / GitHub rejected; onboarding 5–7 touch points; onboarding-first build order
- Tools: Photon, Browserbase, Tavily, GMI Cloud, Jeff
- Deliverable understanding: video + live presentation, no slides (unconfirmed)

**3. Task-split session ("New note") — Sep 26, 1:03 PM**
- Work broken into: UI/sign-up (SSO, Supabase), Photon messaging, Luma signup via Browserbase, X/LinkedIn scraping, agent conversation workflow, Jeff ("Jest") integration
- Base GitHub repo + context markdown file agreed; repo not yet created; ownership claimed but attribution ambiguous
- Individual claims: one member took landing page + presentation; one took iMessage workflow
- LinkedIn credential constraint surfaced; conversation workflow flagged as the remaining gap
- Demo approach: live demo supported by recorded working video

**4. Chat-session addition (not a recorded meeting):** landing page is the sole entry point; unregistered inbound texts get a sign-up redirect and no agent processing.

---

**Coverage note:** Searched all meetings recorded today (Sep 26, 2026) — found and read all 3: the 10 AM kickoff, this 12:17 PM requirements meeting (in context), and the 1:03 PM task-split note (read via transcript since it had no summary). The July "GTM Hackaton" meeting was excluded as out of scope (different event, not today). Speaker attribution in the two in-person sessions is limited — most decisions are reported as team-level rather than per-person. Exact submission deadline and team member names/emails were not captured in any meeting.