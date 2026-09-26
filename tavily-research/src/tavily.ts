// Thin wrapper over Tavily's REST API. No SDK: two endpoints, plain fetch.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const API = 'https://api.tavily.com'

// TAVILY_API_KEY wins; otherwise read the gitignored tavily.key next to this lane.
function apiKey(): string {
  if (process.env.TAVILY_API_KEY) return process.env.TAVILY_API_KEY
  const keyFile = fileURLToPath(new URL('../tavily.key', import.meta.url))
  if (existsSync(keyFile)) {
    const match = readFileSync(keyFile, 'utf8').match(/tvly-[A-Za-z0-9_-]+/)
    if (match) return match[0]
  }
  throw new Error('No Tavily key: set TAVILY_API_KEY or add tavily-research/tavily.key')
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Tavily ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

export interface SearchResult {
  url: string
  title: string
  content: string
  score: number
}

export async function search(
  query: string,
  opts: { includeDomains?: string[]; maxResults?: number; depth?: 'basic' | 'advanced' } = {},
): Promise<SearchResult[]> {
  const data = await post<{ results?: SearchResult[] }>('/search', {
    query,
    search_depth: opts.depth ?? 'basic',
    max_results: opts.maxResults ?? 5,
    include_domains: opts.includeDomains ?? [],
  })
  return data.results ?? []
}

export interface ExtractResult {
  url: string
  raw_content: string
}

const EXTRACT_BATCH = 20 // Tavily's per-request URL limit

// Extract many URLs; failures are returned, never thrown, so one bad profile
// can't sink a whole attendee list.
export async function extract(
  urls: string[],
): Promise<{ results: ExtractResult[]; failed: string[] }> {
  const batches: string[][] = []
  for (let i = 0; i < urls.length; i += EXTRACT_BATCH) batches.push(urls.slice(i, i + EXTRACT_BATCH))

  const settled = await Promise.allSettled(
    batches.map(batch =>
      post<{ results?: ExtractResult[]; failed_results?: { url: string }[] }>('/extract', {
        urls: batch,
        extract_depth: 'advanced', // needed for LinkedIn
        format: 'text',
      }),
    ),
  )

  const results: ExtractResult[] = []
  const failed: string[] = []
  settled.forEach((s, i) => {
    if (s.status === 'rejected') {
      failed.push(...batches[i])
      return
    }
    results.push(...(s.value.results ?? []))
    failed.push(...(s.value.failed_results ?? []).map(f => f.url))
  })
  return { results, failed }
}
