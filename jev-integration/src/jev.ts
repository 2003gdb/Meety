// Thin wrapper over TypeSafe's System One endpoint (Jev). No SDK: one endpoint, plain fetch.
// Spec: https://docs.typesafe.ai/api.md
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const API = process.env.TYPESAFE_BASE_URL ?? 'https://api.typesafe.ai/v1'
const MODEL = process.env.JEV_MODEL ?? 'jev-latest'
const RETRYABLE = new Set([429, 529])
const MAX_ATTEMPTS = 3

type Text = string | Record<string, unknown> | unknown[]

export type Question =
  | { type: 'noul'; instructions: Text; criteria?: { true?: Text; false?: Text } }
  | { type: 'choice'; instructions: Text; criteria: Record<string, Text | null> }
  | { type: 'score'; instructions: Text; criteria: Text[] }

export type Answer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; legend: Record<string, string>; confidence: number }

export interface SystemOneResponse {
  model: string
  answers: Record<string, Answer>
  usage: { input_tokens: number; output_tokens: number }
}

/** Same signature as `systemOne`, so callers can swap in a fake for tests or dry runs. */
export type Ask = (state: unknown, questions: Record<string, Question>) => Promise<SystemOneResponse>

// TYPESAFE_API_KEY wins; otherwise read the gitignored jev.key ("Jev:<token>") next to this lane.
function apiKey(): string | null {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY
  for (const name of ['jev.key', 'typesafe.key']) {
    const keyFile = fileURLToPath(new URL(`../${name}`, import.meta.url))
    if (!existsSync(keyFile)) continue
    const key = readFileSync(keyFile, 'utf8').match(/[A-Za-z0-9._-]{20,}/)?.[0]
    if (key) return key
  }
  return null
}

export function jevConfigured(): boolean {
  return apiKey() !== null
}

export const systemOne: Ask = async (state, questions) => {
  const key = apiKey()
  if (!key) throw new Error('No TypeSafe key: set TYPESAFE_API_KEY or add jev-integration/jev.key')

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/systemone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, state, questions }),
    })
    if (res.ok) return (await res.json()) as SystemOneResponse
    // 429 rate limit and 529 overload are the two statuses the docs say to back off on.
    if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)))
      continue
    }
    throw new Error(`Jev systemone failed: ${res.status} ${await res.text()}`)
  }
}

export function noul(res: SystemOneResponse, id: string): number | null {
  const a = res.answers[id]
  return a?.type === 'noul' ? a.noul : null
}
