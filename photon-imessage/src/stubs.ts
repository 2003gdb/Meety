// Stand-ins for the other lanes so the conversation runs end to end today.
// Replace each one with the real implementation at integration time.

import type {
  Attendee,
  LumaEvent,
  LumaService,
  MatchService,
  MatchVerdict,
  MeetyUser,
  Profile,
  ResearchService,
  Services,
  Transcriber,
  UserDirectory,
} from "./contracts.js";

export class MemoryUserDirectory implements UserDirectory {
  private users = new Map<string, MeetyUser>();

  async findByPhone(phone: string) {
    return this.users.get(phone) ?? null;
  }

  async upsert(user: MeetyUser) {
    this.users.set(user.phone, { ...this.users.get(user.phone), ...user });
  }
}

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const DEMO_EVENTS: LumaEvent[] = [
  { id: "evt_agents_night", name: "Agents Night SF", startsAt: inHours(26), location: "COR HQ", url: "https://lu.ma/agents-night" },
  { id: "evt_founder_breakfast", name: "Founder Breakfast", startsAt: inHours(72), location: "Hayes Valley", url: "https://lu.ma/founder-breakfast" },
  { id: "evt_devtools_meetup", name: "Devtools Meetup", startsAt: inHours(120), location: "SoMa", url: "https://lu.ma/devtools" },
];

const DEMO_ATTENDEES: Attendee[] = [
  { id: "a1", name: "Priya Raman", headline: "Head of Product at a voice AI startup, talks to customers every week" },
  { id: "a2", name: "Carlos Mendez", headline: "Designer building consumer apps, ex-Figma" },
  { id: "a3", name: "Sherry Liu", headline: "Seed investor focused on AI infrastructure and devtools" },
  { id: "a4", name: "Tom Becker", headline: "Backend engineer, distributed systems and databases" },
  { id: "a5", name: "Amara Okafor", headline: "Founder hiring founding engineers for an agent platform" },
  { id: "a6", name: "Leo Park", headline: "Growth lead, B2B go-to-market and customer discovery" },
  { id: "a7", name: "Nina Kowalski", headline: "ML researcher working on evals and model routing" },
];

export class StubLuma implements LumaService {
  async connectUrl(user: MeetyUser) {
    return `https://meety.example.com/connect-luma?u=${encodeURIComponent(user.phone)}`;
  }
  async isConnected() {
    return true;
  }
  async upcomingEvents() {
    return DEMO_EVENTS;
  }
  async attendees(_user: MeetyUser, eventId: string) {
    return eventId === "evt_devtools_meetup" ? null : DEMO_ATTENDEES;
  }
}

export class StubResearch implements ResearchService {
  async profileFor(user: MeetyUser): Promise<Profile | null> {
    if (!user.name) return null;
    return {
      name: user.name,
      headline: "Software engineer",
      summary: `${user.name}, a software engineer in San Francisco who builds AI products and goes to a lot of hackathons.`,
      linkedinUrl: user.linkedinUrl,
    };
  }
  async profileFromLinks(user: MeetyUser, links: { linkedinUrl?: string; xUrl?: string }): Promise<Profile | null> {
    const handle = (links.linkedinUrl ?? links.xUrl ?? "").split("/").filter(Boolean).pop();
    return {
      name: user.name ?? handle,
      summary: `${user.name ?? handle}, going by the profile at ${links.linkedinUrl ?? links.xUrl}.`,
      ...links,
    };
  }
}

const STOPWORDS = new Set("a an and the to of in on for at with who is are i me my want wants meet people talk get from this that it be".split(" "));
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );

/** Keyword overlap, so the demo gives plausible answers before Jev is wired in. */
export class StubMatch implements MatchService {
  private verdict(goal: string, attendee: Attendee): MatchVerdict {
    const want = words(goal);
    const have = words(`${attendee.headline ?? ""} ${attendee.profile?.summary ?? ""}`);
    const overlap = [...want].filter((w) => [...have].some((h) => h.startsWith(w) || w.startsWith(h)));
    const probability = Math.min(0.95, 0.2 + overlap.length * 0.25);
    return {
      attendee,
      match: probability >= 0.5,
      probability,
      reason: overlap.length
        ? `overlaps with what you said about ${overlap.join(" and ")}.`
        : `nothing there overlaps with what you're after.`,
    };
  }

  async rank({ goal, attendees }: Parameters<MatchService["rank"]>[0]) {
    return attendees.map((a) => this.verdict(goal, a)).sort((x, y) => y.probability - x.probability);
  }

  async assess({ goal, attendee }: Parameters<MatchService["assess"]>[0]) {
    return this.verdict(goal, attendee);
  }
}

export class NoTranscriber implements Transcriber {
  async transcribe() {
    return null;
  }
}

export function stubServices(): Services {
  return {
    users: new MemoryUserDirectory(),
    luma: new StubLuma(),
    research: new StubResearch(),
    match: new StubMatch(),
    transcriber: new NoTranscriber(),
  };
}
