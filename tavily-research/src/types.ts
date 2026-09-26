// Shapes shared by both research passes. `PersonProfile` is written onto the
// shared `profiles` / `attendees` rows in Supabase (see schema.sql).

export type ResearchStatus = 'pending' | 'ambiguous' | 'done' | 'no_match'

export interface Candidate {
  /** Profile URL we would extract if the user picks this one. */
  url: string
  /** One line for the "Is this you?" message, e.g. "Autodesk · San Francisco Bay Area". */
  label: string
  source: 'linkedin' | 'x'
}

export interface PersonProfile {
  /** profiles.id for the person who signed up */
  profile_id?: string | null
  /** attendees.id for an event guest */
  attendee_id?: string | null
  name: string
  linkedin_url: string | null
  x_url: string | null
  headline: string
  location: string
  summary: string
  interests: string[]
  evidence: string[]
  sources: string[]
  candidates?: Candidate[] | null
  research_status: ResearchStatus
  researched_at: string
}

/**
 * One guest row as the browserbase-luma lane scrapes it: first and last name,
 * email, and a LinkedIn or X link when the guest shared one. Key spellings vary,
 * so `fromLuma` accepts the common ones.
 */
export interface LumaGuest {
  luma_user_id?: string | null
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  email?: string | null
  linkedin?: string | null
  linkedin_url?: string | null
  x?: string | null
  x_url?: string | null
  twitter?: string | null
}

/** One row of the shared `attendees` table. */
export interface AttendeeRow {
  id: string
  event_id: string
  name: string
  headline: string | null
  company: string | null
  bio: string | null
  linkedin_url: string | null
  x_handle: string | null
  research_status?: ResearchStatus | null
  researched_at?: string | null
}

/** Normalized attendee the research pass works on. */
export interface Attendee {
  attendee_id?: string | null
  name: string
  email?: string | null
  bio?: string | null
  company?: string | null
  location?: string | null
  linkedin_url?: string | null
  x_url?: string | null
}
