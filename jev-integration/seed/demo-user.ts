// Creates the fake signed-up user (auth user + profiles row) for testing match-event.
// Re-runnable. Uses the service key (the Supabase MCP connector is read-only).
//   node seed/demo-user.ts
import { config, rest } from '../src/store.ts'

const ID = '22222222-2222-4222-8222-222222222222'
const EMAIL = 'demo-user@meety.test'

const { url, key } = config()
const auth = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: ID, email: EMAIL, email_confirm: true, user_metadata: { full_name: 'Alex Rivera' } }),
})
// 422 = already registered, which is fine on a re-run.
if (!auth.ok && auth.status !== 422) throw new Error(`auth user failed: ${auth.status} ${await auth.text()}`)

const now = new Date().toISOString()
await rest('profiles?on_conflict=id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({
    id: ID,
    email: EMAIL,
    full_name: 'Alex Rivera',
    phone: '+15555550100',
    headline: 'Founder, Meety',
    location: 'San Francisco',
    summary: 'Building Meety, an iMessage assistant that tells you who to meet at an event before you walk in. Pre-seed, two-person team, looking for design partners among event hosts and community builders.',
    interests: ['iMessage', 'events', 'agents', 'community', 'matching'],
    evidence: ['Founder of Meety, an iMessage assistant for event networking.'],
    research_status: 'done',
    researched_at: now,
    onboarded_at: now,
  }),
})
console.log(`seeded profile ${ID} (${EMAIL})`)
