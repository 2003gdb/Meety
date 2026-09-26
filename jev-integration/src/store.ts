// Reads the signed-up user (`profiles`) and an event's guest list (`attendees`) from the
// Meety Supabase project, and writes Jev results to `matches` (schema.sql).
// PostgREST over plain fetch, same pattern as tavily-research/src/store.ts.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Match } from './match.ts'
import type { Person } from './templates.ts'

// SUPABASE_URL / SUPABASE_SERVICE_KEY win; otherwise a gitignored supabase.key in this
// lane or in tavily-research, holding the project URL and a service key on any lines.
export function config(): { url: string; key: string } {
  let url = process.env.SUPABASE_URL
  let key = process.env.SUPABASE_SERVICE_KEY
  for (const file of ['../supabase.key', '../../tavily-research/supabase.key']) {
    const keyFile = fileURLToPath(new URL(file, import.meta.url))
    if ((url && key) || !existsSync(keyFile)) continue
    const text = readFileSync(keyFile, 'utf8')
    url ??= text.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
    key ??= text.match(/sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]{40,}/)?.[0]
  }
  if (!url || !key) throw new Error('No Supabase config: set SUPABASE_URL and SUPABASE_SERVICE_KEY or add jev-integration/supabase.key')
  return { url, key }
}

export async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, key } = config()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} failed: ${res.status} ${await res.text()}`)
  return res
}

export interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  x_handle: string | null
  headline: string | null
  location: string | null
  summary: string | null
  interests: string[] | null
  evidence: string[] | null
}

const PROFILE_COLUMNS = 'id,full_name,email,phone,linkedin_url,x_handle,headline,location,summary,interests,evidence'

export interface AttendeeRow {
  id: string
  event_id: string
  name: string
  headline: string | null
  company: string | null
  bio: string | null
  linkedin_url: string | null
  x_handle: string | null
  /** tavily-research Pass 2; only used once research_status is 'done'. */
  location?: string | null
  summary?: string | null
  interests?: string[] | null
  evidence?: string[] | null
  research_status?: string | null
}

const ATTENDEE_COLUMNS = 'id,event_id,name,headline,company,bio,linkedin_url,x_handle,location,summary,interests,evidence,research_status'

export interface EventRow {
  id: string
  name: string
  luma_url: string | null
  starts_at: string | null
}

/** "Seed investor at Harbor Ventures"; either half alone when the other is missing. */
export function roleLine(headline: string | null, company: string | null): string | undefined {
  const h = headline?.trim()
  const c = company?.trim()
  if (h && c && c.toLowerCase() !== 'independent') return `${h} at ${c}`
  return h || c || undefined
}

/**
 * The bio is the source of truth and doubles as the fact the "why" line may cite.
 * Finished research adds to it; pending or ambiguous research is ignored.
 */
export function attendeeToPerson(row: AttendeeRow): Person {
  const bio = row.bio?.trim() || undefined
  const researched = row.research_status === 'done'
  const extra = researched ? row.summary?.trim() || undefined : undefined
  const evidence = researched && row.evidence?.length ? row.evidence : bio ? [bio] : undefined
  return {
    id: row.id,
    name: row.name,
    headline: roleLine(row.headline, row.company),
    location: researched ? row.location?.trim() || undefined : undefined,
    summary: [bio, extra].filter(Boolean).join(' ') || undefined,
    interests: researched && row.interests?.length ? row.interests : undefined,
    evidence,
  }
}

/** The user's own research (tavily-research Pass 1) is trusted, unlike attendee text. */
export function profileToPerson(row: ProfileRow): Person {
  return {
    id: row.id,
    name: row.full_name?.trim() || 'the user',
    headline: row.headline?.trim() || undefined,
    location: row.location?.trim() || undefined,
    summary: row.summary?.trim() || undefined,
    interests: row.interests?.length ? row.interests : undefined,
    evidence: row.evidence?.length ? row.evidence : undefined,
  }
}

/** By auth user id, or by E.164 phone (how the iMessage bot knows the user). */
export async function loadUser(idOrPhone: string): Promise<ProfileRow | null> {
  const filter = idOrPhone.startsWith('+') ? `phone=eq.${encodeURIComponent(idOrPhone)}` : `id=eq.${encodeURIComponent(idOrPhone)}`
  const res = await rest(`profiles?select=${PROFILE_COLUMNS}&${filter}&limit=1`)
  return ((await res.json()) as ProfileRow[])[0] ?? null
}

export async function loadEvent(eventId: string): Promise<EventRow | null> {
  const res = await rest(`events?select=id,name,luma_url,starts_at&id=eq.${encodeURIComponent(eventId)}&limit=1`)
  return ((await res.json()) as EventRow[])[0] ?? null
}

export async function loadAttendees(eventId: string): Promise<AttendeeRow[]> {
  const res = await rest(
    `attendees?select=${ATTENDEE_COLUMNS}&event_id=eq.${encodeURIComponent(eventId)}&order=name`,
  )
  return (await res.json()) as AttendeeRow[]
}

/**
 * Same person scraped twice (re-run seed or scraper) → keep the first row. Keyed on the
 * LinkedIn URL when there is one, else name + company.
 */
export function dedupeAttendees(rows: AttendeeRow[]): AttendeeRow[] {
  const seen = new Set<string>()
  return rows.filter(r => {
    const key = r.linkedin_url?.trim().toLowerCase().replace(/\/+$/, '')
      || `${r.name.trim().toLowerCase()}|${(r.company ?? '').trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** One row per ranked attendee; re-running for the same user and event overwrites. */
export async function saveMatches(
  userId: string,
  eventId: string,
  goal: string,
  model: string,
  matches: (Match & { why?: string })[],
): Promise<void> {
  if (matches.length === 0) return
  const rows = matches.map(m => ({
    user_id: userId, event_id: eventId, attendee_id: m.id, goal, model,
    probability: m.probability, match: m.match, why: m.why ?? null,
  }))
  await rest('matches?on_conflict=user_id,event_id,attendee_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
}
