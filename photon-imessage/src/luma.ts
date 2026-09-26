// Real per-user Luma, on browserbase-luma's Browserbase flow. Each user signs into
// Luma once in a Browserbase browser shown on the website (/connect-luma); the saved
// Browserbase context then lets Meety read their events and an event's guest list.
// Everything it reads lands in Supabase: events, user_events and attendees.

import {
  client,
  connect,
  createContext,
  HOME_URL,
  LOGIN_URL,
  releaseSession,
  startSession,
  wait,
} from "../../browserbase-luma/src/browserbase.ts";
import { loggedIn, readEvents, readNextEvent } from "../../browserbase-luma/src/extract.ts";
import { fetchEvent, fetchProfile, type EventDetails } from "../../browserbase-luma/src/public.ts";
import { dedupeAttendees, loadAttendees, type AttendeeRow } from "../../jev-integration/src/store.ts";
import { researchEvent } from "../../tavily-research/src/store.ts";
import type { Attendee, LumaEvent, LumaService, MeetyUser } from "./contracts.js";
import { EVENT_GRACE_MS, rest, toAttendee, toEvent, type EventRow } from "./supabase.js";

type Page = Awaited<ReturnType<typeof connect>>["page"];

/** Links from the Luma home page we check; upcoming events are listed first. */
const MAX_EVENTS = 8;
/** Guests whose public Luma profiles we read per event. */
const MAX_GUESTS = 60;

interface LumaRow {
  id: string;
  full_name: string | null;
  luma_context_id: string | null;
  luma_session_id: string | null;
}

export function browserbaseConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

async function lumaRow(phone: string): Promise<LumaRow | null> {
  const res = await rest(
    `profiles?select=id,full_name,luma_context_id,luma_session_id&phone=eq.${encodeURIComponent(phone)}&limit=1`,
  );
  return ((await res.json()) as LumaRow[])[0] ?? null;
}

async function patchProfile(id: string, fields: Record<string, unknown>): Promise<void> {
  await rest(`profiles?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(fields),
  });
}

async function eventRow(id: string): Promise<EventRow | null> {
  const res = await rest(`events?select=id,name,luma_url,starts_at&id=eq.${encodeURIComponent(id)}&limit=1`);
  return ((await res.json()) as EventRow[])[0] ?? null;
}

/** A short-lived browser on the user's saved Luma login. */
async function withLuma<T>(contextId: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const bb = client();
  const session = await startSession(bb, contextId, { persist: false, keepAlive: false, timeoutSeconds: 180 });
  const { browser, page } = await connect(session.connectUrl);
  try {
    return await fn(page);
  } finally {
    await browser.close();
    await releaseSession(bb, session.id);
  }
}

async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/** Upcoming events behind the links on their Luma home page, saved as theirs. */
async function saveEvents(userId: string, urls: string[]): Promise<void> {
  const since = Date.now() - EVENT_GRACE_MS;
  const details = await Promise.all(urls.map((url) => fetchEvent(url).catch(() => null)));
  const byUrl = new Map<string, EventDetails>();
  for (const e of details) if (e && Date.parse(e.startsAt) >= since) byUrl.set(e.url, e);
  if (!byUrl.size) return;

  const res = await rest("events?on_conflict=luma_url&select=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([...byUrl.values()].map((e) => ({ name: e.name, luma_url: e.url, starts_at: e.startsAt }))),
  });
  const saved = (await res.json()) as { id: string }[];
  await rest("user_events?on_conflict=user_id,event_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(saved.map((e) => ({ user_id: userId, event_id: e.id }))),
  });
}

/** The event's guests from Supabase, or read from Luma with this user's login the first time. */
async function loadGuestList(user: MeetyUser, eventId: string): Promise<Attendee[] | null> {
  const known = dedupeAttendees(await loadAttendees(eventId));
  if (known.length) return known.map(toAttendee);

  const [row, event] = await Promise.all([lumaRow(user.phone), eventRow(eventId)]);
  if (!row?.luma_context_id || !event?.luma_url) return null;
  const lumaUrl = event.luma_url;
  const page = await withLuma(row.luma_context_id, (p) => readNextEvent(p, { name: event.name, url: lumaUrl }));
  if (!page.guestListVisible) return null;

  const self = row.full_name?.trim().toLowerCase();
  const guests = page.guests.filter((g) => g.name.trim().toLowerCase() !== self).slice(0, MAX_GUESTS);
  const profiles = await inChunks(guests, 8, (g) => fetchProfile(g.profileUrl).catch(() => null));
  const rows = guests.map((g, i) => ({
    event_id: eventId,
    luma_url: g.profileUrl,
    name: profiles[i]?.name ?? g.name,
    bio: profiles[i]?.bio ?? null,
    linkedin_url: profiles[i]?.linkedinUrl ?? null,
    x_handle: profiles[i]?.xHandle ?? null,
  }));
  const res = await rest("attendees?on_conflict=event_id,luma_url&select=*", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  const saved = (await res.json()) as AttendeeRow[];

  // Tavily Pass 2 in the background: Jev reads the research once it's done, the bios until then.
  void researchEvent(eventId).catch((err) => console.error("[luma] attendee research failed", err));
  return saved.map(toAttendee);
}

export class LumaAccounts implements LumaService {
  private guestLists = new Map<string, Promise<Attendee[] | null>>();

  /** `siteUrl` is the landing page, which hosts /connect-luma. */
  constructor(private siteUrl: string) {}

  async connectUrl(user: MeetyUser): Promise<string> {
    const row = await lumaRow(user.phone);
    if (!row) throw new Error(`No profile for ${user.phone}`);
    const bb = client();
    if (row.luma_session_id) await releaseSession(bb, row.luma_session_id);
    const contextId = row.luma_context_id ?? (await createContext(bb));
    // Open for 30 minutes while they sign in; the context keeps their Luma cookies.
    const session = await startSession(bb, contextId, { persist: true, keepAlive: true, timeoutSeconds: 1800, forLogin: true });
    const { browser, page } = await connect(session.connectUrl);
    try {
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    } finally {
      await browser.close();
    }
    await patchProfile(row.id, { luma_context_id: contextId, luma_session_id: session.id });
    return `${this.siteUrl}/connect-luma?s=${session.id}`;
  }

  /** They texted "done": check the login and save their upcoming events. */
  async isConnected(user: MeetyUser): Promise<boolean> {
    const row = await lumaRow(user.phone);
    if (!row?.luma_context_id) return false;
    if (row.luma_session_id) {
      // Closing the login browser is what writes its cookies to the context.
      await releaseSession(client(), row.luma_session_id);
      await wait(5000);
    }
    const links = await withLuma(row.luma_context_id, async (page) => {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(2500);
      return (await loggedIn(page)) ? readEvents(page) : null;
    });
    await patchProfile(row.id, links ? { luma_session_id: null, luma_connected_at: new Date().toISOString() } : { luma_session_id: null });
    if (!links) return false;
    await saveEvents(row.id, links.slice(0, MAX_EVENTS).map((l) => l.url));
    return true;
  }

  async upcomingEvents(user: MeetyUser): Promise<LumaEvent[]> {
    const row = await lumaRow(user.phone);
    if (!row) return [];
    const res = await rest(`user_events?select=events(id,name,luma_url,starts_at)&user_id=eq.${row.id}`);
    const since = Date.now() - EVENT_GRACE_MS;
    return ((await res.json()) as { events: EventRow | null }[])
      .map((r) => r.events)
      .filter((e): e is EventRow => e !== null && Date.parse(e.starts_at) >= since)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
      .map(toEvent);
  }

  // One read per event at a time: the flow starts it when they pick the event and
  // awaits the same promise when they send their goal.
  attendees(user: MeetyUser, eventId: string): Promise<Attendee[] | null> {
    let pending = this.guestLists.get(eventId);
    if (!pending) {
      pending = loadGuestList(user, eventId).finally(() => this.guestLists.delete(eventId));
      this.guestLists.set(eventId, pending);
    }
    return pending;
  }
}
