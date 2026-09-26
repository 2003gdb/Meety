import { test } from 'node:test'
import assert from 'node:assert/strict'
import { companyFromEmail, confirmsAttendee, fromAttendeeRow, fromLuma, groupCandidates, nameMatches, profileKey } from '../src/research.ts'
import { parseJsonObject } from '../src/llm.ts'

test('companyFromEmail skips personal providers', () => {
  assert.equal(companyFromEmail('martin@autodesk.com'), 'Autodesk')
  assert.equal(companyFromEmail('a@eng.stripe.com'), 'Stripe')
  assert.equal(companyFromEmail('someone@gmail.com'), null)
  assert.equal(companyFromEmail('broken'), null)
})

test('nameMatches ignores accents and case', () => {
  assert.ok(nameMatches('Martín Gálaz', 'MARTIN GALAZ - Autodesk'))
  assert.ok(!nameMatches('Martin Galaz', 'Martin Lopez'))
})

test('profileKey groups LinkedIn posts under the profile', () => {
  assert.equal(profileKey('https://www.linkedin.com/in/MartinGalaz/')?.url, 'https://www.linkedin.com/in/martingalaz')
  assert.equal(
    profileKey('https://www.linkedin.com/posts/martingalaz_ai-activity-123')?.url,
    'https://www.linkedin.com/in/martingalaz',
  )
  assert.equal(profileKey('https://mx.linkedin.com/in/someone')?.handle, 'someone')
  assert.equal(profileKey('https://twitter.com/Jev_AI?lang=en')?.url, 'https://x.com/jev_ai')
  assert.equal(profileKey('https://x.com/search?q=a'), null)
  assert.equal(profileKey('https://linkedin.com/company/autodesk'), null)
  assert.equal(profileKey('not a url'), null)
})

test('groupCandidates dedupes by person and drops other names', () => {
  const candidates = groupCandidates('Martin Galaz', [
    { url: 'https://www.linkedin.com/posts/martingalaz_x-activity-1', title: 'Martin Galaz on LinkedIn: shipped it', content: 'post', score: 0.9 },
    { url: 'https://www.linkedin.com/posts/acme_x-activity-2', title: 'Why Martin Galaz joined | Acme posted on the topic', content: 'post', score: 0.99 },
    { url: 'https://www.linkedin.com/in/martingalaz', title: 'Martin Galaz', content: '# Martin Galaz\nAutodesk\nSan Francisco Bay Area', score: 0.8 },
    { url: 'https://www.linkedin.com/in/someoneelse', title: 'Jane Doe', content: 'Jane', score: 0.95 },
    { url: 'https://x.com/mgalaz', title: 'Martin Galaz (@mgalaz)', content: 'Builder', score: 0.5 },
  ])
  assert.equal(candidates.length, 2)
  assert.equal(candidates[0].url, 'https://www.linkedin.com/in/martingalaz')
  assert.equal(candidates[0].label, 'Autodesk · San Francisco Bay Area')
  assert.equal(candidates[1].source, 'x')
})

test('confirmsAttendee rejects posts that only mention the person', () => {
  const stripePost = {
    url: 'https://www.linkedin.com/posts/stripe_a-conversation-with-vercel-ceo-guillermo-activity-1',
    title: 'Vercel CEO Guillermo Rauch on AI | Stripe posted on the topic | LinkedIn',
    content: 'Guillermo Rauch of Vercel',
    score: 1,
  }
  const profile = { url: 'https://www.linkedin.com/in/rauchg', title: 'Guillermo Rauch', content: 'CEO Vercel', score: 1 }
  assert.ok(!confirmsAttendee({ name: 'Guillermo Rauch', company: 'Vercel' }, stripePost))
  assert.ok(confirmsAttendee({ name: 'Guillermo Rauch', company: 'Vercel' }, profile))
})

test('confirmsAttendee needs the name plus a Luma hint', () => {
  const result = { url: 'https://www.linkedin.com/in/x', title: 'Ana Ruiz', content: 'Engineer at Stripe', score: 1 }
  assert.ok(confirmsAttendee({ name: 'Ana Ruiz', company: 'Stripe' }, result))
  assert.ok(!confirmsAttendee({ name: 'Ana Ruiz', company: 'Figma' }, result))
  assert.ok(!confirmsAttendee({ name: 'Ana Ruiz' }, result))
})

test('parseJsonObject tolerates fences and rejects arrays', () => {
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 })
  assert.equal(parseJsonObject('[1]'), null)
  assert.equal(parseJsonObject('nope'), null)
})

test('fromLuma builds name, company hint and profile URLs', () => {
  const a = fromLuma({ first_name: 'Ana', last_name: 'Ruiz', email: 'ana@stripe.com', linkedin: 'linkedin.com/in/AnaRuiz/', x: '@ana_r' })
  assert.equal(a.name, 'Ana Ruiz')
  assert.equal(a.company, 'Stripe')
  assert.equal(a.linkedin_url, 'https://www.linkedin.com/in/anaruiz')
  assert.equal(a.x_url, 'https://x.com/ana_r')
  const b = fromLuma({ first_name: 'Bo', last_name: 'Li', email: 'bo@gmail.com' })
  assert.equal(b.company, null)
  assert.equal(b.linkedin_url, null)
})


test('fromAttendeeRow maps a shared attendees row', () => {
  const a = fromAttendeeRow({
    id: 'a1', event_id: 'e1', name: ' Priya Nair ', headline: 'Product designer', company: 'Independent',
    bio: 'Designs onboarding', linkedin_url: 'https://www.linkedin.com/in/priyanair/', x_handle: '@priyanair',
  })
  assert.equal(a.attendee_id, 'a1')
  assert.equal(a.name, 'Priya Nair')
  assert.equal(a.company, null) // "Independent" is not a search hint
  assert.equal(a.bio, 'Product designer. Designs onboarding')
  assert.equal(a.linkedin_url, 'https://www.linkedin.com/in/priyanair')
  assert.equal(a.x_url, 'https://x.com/priyanair')
})
