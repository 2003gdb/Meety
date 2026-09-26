// Reads and writes the shared Meety tables through PostgREST: the user's research
// goes onto `profiles`, guests' onto `attendees` (columns in schema.sql). Plain fetch.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromAttendeeRow, researchAttendees } from './research.ts'
import type { AttendeeRow, Candidate, PersonProfile } from './types.ts'

const FRESH_DAYS = 7

// SUPABASE_URL / SUPABASE_SERVICE_KEY win; otherwise the gitignored supabase.key
// holding the project URL and a service_role (or sb_secret_) key on any lines.
function config(): { url: string; key: string } {
  let url = process.env.SUPABASE_URL
  let key = process.env.SUPABASE_SERVICE_KEY
  // A path, not new URL(..., import.meta.url): bundlers (Next.js) would ship the key as an asset.
  const keyFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase.key')
  if ((!url || !key) && existsSync(keyFile)) {
    const text = readFileSync(keyFile, 'utf8')
    url ??= text.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
    key ??= text.match(/sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]{40,}/)?.[0]
  }
  if (!url || !key) throw new Error('No Supabase config: set SUPABASE_URL and SUPABASE_SERVICE_KEY or add tavily-research/supabase.key')
  return { url, key }
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, key } = config()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} failed: ${res.status} ${await res.text()}`)
  return res
}

// "https://x.com/handle" → "handle", the shape both tables store.
function xHandle(url: string | null): string | undefined {
  return url?.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i)?.[1]
}

/** Research fields for one row. Links are only written when found, never blanked. */
function researchFields(p: PersonProfile): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    location: p.location || null,
    summary: p.summary || null,
    interests: p.interests,
    evidence: p.evidence,
    sources: p.sources,
    research_status: p.research_status,
    researched_at: p.researched_at,
  }
  if (p.linkedin_url) fields.linkedin_url = p.linkedin_url
  const handle = xHandle(p.x_url)
  if (handle) fields.x_handle = handle
  return fields
}

async function patch(table: string, id: string, fields: Record<string, unknown>): Promise<void> {
  await rest(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  })
}

/** Pass 1, step 1: park the "Is this you?" options on the user's profile. */
export async function saveCandidates(profileId: string, candidates: Candidate[]): Promise<void> {
  await patch('profiles', profileId, {
    candidates,
    research_status: candidates.length ? 'ambiguous' : 'no_match',
  })
}

/** Pass 1, step 2: the confirmed research, onto the user's profile. */
export async function saveUserResearch(profileId: string, p: PersonProfile): Promise<void> {
  await patch('profiles', profileId, { ...researchFields(p), headline: p.headline || null })
}

/** Pass 2: one PATCH per attendee row (rows already exist, the scraper made them). */
export async function saveAttendeeResearch(profiles: PersonProfile[]): Promise<void> {
  for (const p of profiles) if (p.attendee_id) await patch('attendees', p.attendee_id, researchFields(p))
}

/** The event's guests, as the Browserbase scraper stored them. */
export async function loadAttendees(eventId: string): Promise<AttendeeRow[]> {
  const res = await rest(
    `attendees?select=id,event_id,name,headline,company,bio,linkedin_url,x_handle,research_status,researched_at&event_id=eq.${encodeURIComponent(eventId)}&order=name`,
  )
  return (await res.json()) as AttendeeRow[]
}

function isFresh(row: AttendeeRow): boolean {
  if (!row.researched_at || row.research_status === 'pending') return false
  return Date.now() - Date.parse(row.researched_at) < FRESH_DAYS * 86_400_000
}

/** Pass 2 end to end: load the event's guests, skip rows researched this week, research the rest, save. */
export async function researchEvent(eventId: string): Promise<{ researched: number; skipped: number }> {
  const rows = await loadAttendees(eventId)
  const todo = rows.filter(r => r.name?.trim() && !isFresh(r)).map(fromAttendeeRow)
  await saveAttendeeResearch(await researchAttendees(todo))
  return { researched: todo.length, skipped: rows.length - todo.length }
}
