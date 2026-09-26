// Public Luma pages carry their data as JSON in __NEXT_DATA__, so event details and
// guest profiles need no login or browser: a plain fetch is enough. Only the user's
// own events and an event's guest list need their Browserbase login.

export type EventDetails = {
  /** Canonical https://luma.com/<slug> */
  url: string;
  name: string;
  /** ISO 8601 */
  startsAt: string;
  city: string | null;
};

export type GuestProfile = {
  name: string;
  bio: string | null;
  linkedinUrl: string | null;
  xHandle: string | null;
};

async function nextData(url: string): Promise<Record<string, any> | null> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const match = (await res.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  return match ? JSON.parse(match[1]!).props?.pageProps?.initialData ?? null : null;
}

/** Null when the URL isn't an event (a calendar or profile link on the Luma home page). */
export async function fetchEvent(url: string): Promise<EventDetails | null> {
  const event = (await nextData(url))?.data?.event;
  if (!event?.start_at || !event.url) return null;
  return {
    url: `https://luma.com/${event.url}`,
    name: event.name,
    startsAt: event.start_at,
    city: event.geo_address_info?.city_state ?? null,
  };
}

/** A guest's public Luma profile: short bio plus the LinkedIn and X handles they linked. */
export async function fetchProfile(url: string): Promise<GuestProfile | null> {
  const user = (await nextData(url))?.user;
  if (!user?.name) return null;
  const linkedin = typeof user.linkedin_handle === "string" ? user.linkedin_handle.replace(/^\/+/, "") : "";
  return {
    name: user.name,
    bio: user.bio_short || null,
    linkedinUrl: linkedin ? `https://www.linkedin.com/${linkedin}` : null,
    xHandle: user.twitter_handle || null,
  };
}
