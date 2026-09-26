// The three Jev decisions Meety makes: rank attendees before an event, answer
// "should I talk to X?" live, and classify inbound iMessages.
import { noul, systemOne, type Ask, type Question } from './jev.ts'
import {
  goodForTopic, inboundIntent, inboundState, INTENTS, userState, worthMeeting,
  type Intent, type Person,
} from './templates.ts'

/** Attendees per request. ~300 tokens each keeps a batch well under Jev's context window. */
export const BATCH_SIZE = 25
export const MATCH_THRESHOLD = 0.5
/** Below this, the intent is too uncertain to route in code; hand the message to the conversation model. */
export const INTENT_MIN_CONFIDENCE = 0.5

export interface Match {
  id: string
  name: string
  probability: number
  match: boolean
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Pre-event pass. One Noul per attendee, fanned out in batches; the user and goal
 * sit in state once per batch. Ranking and the threshold stay in code.
 */
export async function rankAttendees(
  user: Person,
  goal: string,
  attendees: Person[],
  { ask = systemOne, threshold = MATCH_THRESHOLD }: { ask?: Ask; threshold?: number } = {},
): Promise<{ matches: Match[]; failed: string[] }> {
  const state = userState(user, goal)
  const others = attendees.filter(a => a.id !== user.id)
  const batches = chunk(others, BATCH_SIZE)

  const settled = await Promise.allSettled(
    batches.map(batch =>
      ask(state, Object.fromEntries(batch.map((a, i) => [`a${i}`, worthMeeting(a)]))),
    ),
  )

  const matches: Match[] = []
  const failed: string[] = []
  settled.forEach((s, b) => {
    if (s.status === 'rejected') console.error(`batch ${b} failed: ${String(s.reason?.message ?? s.reason).slice(0, 200)}`)
    batches[b]!.forEach((a, i) => {
      const p = s.status === 'fulfilled' ? noul(s.value, `a${i}`) : null
      if (p === null) failed.push(a.id)
      else matches.push({ id: a.id, name: a.name, probability: p, match: p >= threshold })
    })
  })
  matches.sort((x, y) => y.probability - x.probability)
  return { matches, failed }
}

export interface Verdict {
  yes: boolean
  /** P(worth meeting given the goal). */
  probability: number
  /** P(good person for the topic), only when a topic was asked about. */
  topicProbability: number | null
}

/** Live at-event check. Both questions go in one call. */
export async function askAboutPerson(
  user: Person,
  goal: string,
  person: Person,
  topic: string | null = null,
  { ask = systemOne }: { ask?: Ask } = {},
): Promise<Verdict> {
  const questions: Record<string, Question> = topic
    ? { worth: worthMeeting(person), topic: goodForTopic(person, topic) }
    : { worth: worthMeeting(person) }
  const res = await ask(userState(user, goal), questions)
  const probability = noul(res, 'worth')
  if (probability === null) throw new Error('Jev returned no answer for "worth"')
  const topicProbability = topic ? noul(res, 'topic') : null
  // With a topic, the topic decides: the user already knows why they want to talk.
  const deciding = topicProbability ?? probability
  return { yes: deciding >= MATCH_THRESHOLD, probability, topicProbability }
}

/** "Yes, 72%" — the format the team settled on for live answers. */
export function formatVerdict(v: Verdict): string {
  const p = v.topicProbability ?? v.probability
  return `${v.yes ? 'Yes' : 'Probably not'}, ${Math.round(p * 100)}%`
}

/** Names that contain every token the user typed, e.g. "carlos" → "Carlos Ruiz". Ambiguity goes back to the user. */
export function findByName(query: string, people: Person[]): Person[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const tokens = norm(query).split(/\s+/).filter(t => t.length >= 2)
  if (tokens.length === 0) return []
  return people.filter(p => {
    const name = norm(p.name).split(/\s+/)
    return tokens.every(t => name.some(part => part.startsWith(t)))
  })
}

export interface IntentResult {
  intent: Intent
  confidence: number
  /** False when confidence is too low to route in code; the conversation model should handle it. */
  confident: boolean
}

export async function classifyInbound(
  message: string,
  botLastQuestion: string | null = null,
  { ask = systemOne }: { ask?: Ask } = {},
): Promise<IntentResult> {
  const res = await ask(inboundState(message, botLastQuestion), { intent: inboundIntent() })
  const a = res.answers.intent
  if (a?.type !== 'choice' || !(a.choice in INTENTS)) return { intent: 'other', confidence: 0, confident: false }
  return { intent: a.choice as Intent, confidence: a.confidence, confident: a.confidence >= INTENT_MIN_CONFIDENCE }
}
