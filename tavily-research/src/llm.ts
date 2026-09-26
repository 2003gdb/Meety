// GMI Cloud chat completions (OpenAI-compatible). Returns null when no key is
// configured so callers can fall back to a heuristic profile.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE_URL = process.env.GMI_BASE_URL ?? 'https://api.gmi-serving.com/v1'
const MODEL = process.env.GMI_MODEL ?? 'deepseek-ai/DeepSeek-V4-Pro'

// GMI_API_KEY wins; otherwise read the gitignored gmi.key ("Gmi:<token>").
function apiKey(): string | null {
  if (process.env.GMI_API_KEY) return process.env.GMI_API_KEY
  const keyFile = fileURLToPath(new URL('../gmi.key', import.meta.url))
  if (!existsSync(keyFile)) return null
  return readFileSync(keyFile, 'utf8').match(/[A-Za-z0-9._-]{20,}/)?.[0] ?? null
}

export function llmConfigured(): boolean {
  return apiKey() !== null
}

// GMI latency swung from 4s to 70s on the same prompt; cap it so one slow call
// falls back to the heuristic instead of stalling a whole event.
const TIMEOUT_MS = 45_000

async function chat(prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`GMI chat failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

// Pull the first {...} block out of a reply that may carry prose or code fences.
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const value = JSON.parse(text.slice(start, end + 1))
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** Ask for JSON; retry once with a stricter nudge. Null if the model never complies. */
export async function chatJson(prompt: string): Promise<Record<string, unknown> | null> {
  if (!llmConfigured()) return null
  try {
    const first = parseJsonObject(await chat(prompt))
    if (first) return first
    return parseJsonObject(
      await chat(`${prompt}\n\nReturn ONLY the JSON object. Start with { and end with }.`),
    )
  } catch (err) {
    console.error(`GMI call failed, using fallback: ${(err as Error).message}`)
    return null
  }
}
