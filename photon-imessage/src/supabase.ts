// The landing-page, tavily-research and Luma lanes, through the shared Supabase project.
// Sign-ups are `profiles` rows (landing-page), and tavily-research writes each
// user's research onto the same row right after sign-up. Plain fetch, no SDK.

import { attendeeToPerson, dedupeAttendees, loadAttendees, type AttendeeRow } from "../../jev-integration/src/store.ts";
import { confirmUser } from "../../tavily-research/src/research.ts";
import { saveUserResearch } from "../../tavily-research/src/store.ts";
import type { Candidate, PersonProfile, ResearchStatus } from "../../tavily-research/src/types.ts";
import type { Attendee, LumaEvent, LumaService, MeetyUser, Profile, ResearchService, UserDirectory } from "./contracts.js";

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string;
  linkedin_url: string | null;
  x_handle: string | null;
  headline: string | null;
  location: string | null;
  summary: string | null;
  interests: string[] | null;
  evidence: string[] | null;
  candidates: Candidate[] | null;
  research_status: ResearchStatus;
}

const COLUMNS =
  "id,full_name,email,phone,linkedin_url,x_handle,headline,location,summary,interests,evidence,candidates,research_status";

/** Same env vars tavily-research's store.ts reads, so one config serves both. */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

export async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res;
}

async function patch(filter: string, fields: Record<string, unknown>): Promise<void> {
  await rest(`profiles?${filter}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fields) });
}

async function rowByPhone(phone: string): Promise<ProfileRow | null> {
  const res = await rest(`profiles?select=${COLUMNS}&phone=eq.${encodeURIComponent(phone)}&limit=1`);
  const rows = (await res.json()) as ProfileRow[];
  return rows[0] ?? null;
}

export const xUrl = (handle: string | null) => (handle ? `https://x.com/${handle}` : undefined);
const xHandle = (url: string) => url.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i)?.[1];

export class SupabaseUsers implements UserDirectory {
  async findByPhone(phone: string): Promise<MeetyUser | null> {
    const row = await rowByPhone(phone);
    if (!row) return null;
    return {
      phone: row.phone,
      name: row.full_name ?? undefined,
      email: row.email ?? undefined,
      linkedinUrl: row.linkedin_url ?? undefined,
      xUrl: xUrl(row.x_handle),
    };
  }

  // The landing page creates sign-ups; the bot only adds links the user texts in.
  async upsert(user: MeetyUser): Promise<void> {
    const fields: Record<string, string> = {};
    if (user.linkedinUrl) fields.linkedin_url = user.linkedinUrl;
    const handle = user.xUrl && xHandle(user.xUrl);
    if (handle) fields.x_handle = handle;
    if (Object.keys(fields).length) await patch(`phone=eq.${encodeURIComponent(user.phone)}`, fields);
  }
}

function toProfile(row: ProfileRow): Profile | null {
  const base = {
    id: row.id,
    name: row.full_name ?? undefined,
    headline: row.headline ?? undefined,
    location: row.location ?? undefined,
    interests: row.interests?.length ? row.interests : undefined,
    evidence: row.evidence?.length ? row.evidence : undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
    xUrl: xUrl(row.x_handle),
  };
  if (row.summary) return { ...base, summary: row.summary };
  // Summarizing the likeliest match failed at sign-up: show its one-line label instead.
  const top = row.candidates?.[0];
  if (!top) return null;
  const link = top.source === "linkedin" ? { linkedinUrl: top.url } : { xUrl: top.url };
  return { ...base, ...link, summary: `${row.full_name}, ${top.label}` };
}

function fromResearch(p: PersonProfile): Profile {
  return {
    id: p.profile_id ?? undefined,
    name: p.name,
    headline: p.headline || undefined,
    location: p.location || undefined,
    summary: p.summary || [p.name, p.headline].filter(Boolean).join(", "),
    interests: p.interests.length ? p.interests : undefined,
    evidence: p.evidence.length ? p.evidence : undefined,
    linkedinUrl: p.linkedin_url ?? undefined,
    xUrl: p.x_url ?? undefined,
  };
}

export class SupabaseResearch implements ResearchService {
  async profileFor(user: MeetyUser): Promise<Profile | null> {
    const row = await rowByPhone(user.phone);
    return row ? toProfile(row) : null;
  }

  async profileFromLinks(user: MeetyUser, links: { linkedinUrl?: string; xUrl?: string }): Promise<Profile | null> {
    const row = await rowByPhone(user.phone);
    if (!row) return null;
    const urls = [links.linkedinUrl, links.xUrl].filter((u): u is string => Boolean(u));
    const research = await confirmUser({ profile_id: row.id, name: row.full_name ?? user.name ?? "" }, urls);
    if (research.research_status !== "done") return null;
    // The user sent these links themselves, so the research counts as confirmed.
    await saveUserResearch(row.id, research);
    return fromResearch(research);
  }

  // Never throws: a failed write must not break the chat after "yes".
  async confirm(user: MeetyUser): Promise<void> {
    try {
      const row = await rowByPhone(user.phone);
      // Only the sign-up's best guess needs confirming; research from their own links is already done.
      if (row?.research_status !== "ambiguous") return;
      const top = row.candidates?.[0];
      if (!top) return;
      if (row.summary) {
        // The summary describes the top candidate, so its link is confirmed too.
        const link = top.source === "linkedin" ? { linkedin_url: top.url } : { x_handle: xHandle(top.url) };
        return await patch(`id=eq.${encodeURIComponent(row.id)}`, { research_status: "done", ...link });
      }
      // They picked a candidate we only had a label for: research it off the chat path.
      void confirmUser({ profile_id: row.id, name: row.full_name ?? user.name ?? "" }, [top.url])
        .then((research) => saveUserResearch(row.id, research))
        .catch((err) => console.error("[research] researching the confirmed candidate failed", err));
    } catch (err) {
      console.error("[research] confirm failed", err);
    }
  }
}

export interface EventRow {
  id: string;
  name: string;
  luma_url: string | null;
  starts_at: string;
}

/** Keep offering an event for a while after it starts, so people can use Meety while they're there. */
export const EVENT_GRACE_MS = 12 * 3_600_000;

export const toEvent = (e: EventRow): LumaEvent => ({ id: e.id, name: e.name, startsAt: e.starts_at, url: e.luma_url ?? undefined });

/**
 * Events and guest lists from the tables the Luma scraper fills. Logging into Luma
 * (connectUrl / isConnected) is still browserbase-luma's stub, and nothing records
 * which user is going to which event yet, so every upcoming event is offered.
 */
export class SupabaseLuma implements LumaService {
  constructor(private login: Pick<LumaService, "connectUrl" | "isConnected">) {}

  connectUrl(user: MeetyUser) {
    return this.login.connectUrl(user);
  }

  isConnected(user: MeetyUser) {
    return this.login.isConnected(user);
  }

  async upcomingEvents(_user: MeetyUser): Promise<LumaEvent[]> {
    const since = new Date(Date.now() - EVENT_GRACE_MS).toISOString();
    const res = await rest(`events?select=id,name,luma_url,starts_at&starts_at=gte.${encodeURIComponent(since)}&order=starts_at`);
    const rows = (await res.json()) as EventRow[];
    return rows.map(toEvent);
  }

  // No scraped guests reads as a hidden guest list.
  async attendees(_user: MeetyUser, eventId: string): Promise<Attendee[] | null> {
    const rows = dedupeAttendees(await loadAttendees(eventId));
    return rows.length ? rows.map(toAttendee) : null;
  }
}

/** An `attendees` row as the bot sees it, using jev-integration's mapping: the bio, plus Tavily research once it's done. */
export function toAttendee(row: AttendeeRow): Attendee {
  const p = attendeeToPerson(row);
  const headline = p.headline ?? undefined;
  const profile: Profile = {
    id: row.id,
    name: row.name,
    headline,
    location: p.location ?? undefined,
    summary: p.summary ?? "",
    interests: p.interests ?? undefined,
    evidence: p.evidence ?? undefined,
  };
  return { id: row.id, name: row.name, headline, profileUrl: row.linkedin_url ?? xUrl(row.x_handle), profile };
}
