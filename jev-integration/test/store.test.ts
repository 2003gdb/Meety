import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attendeeToPerson, profileToPerson, roleLine } from '../src/store.ts'

test('roleLine joins headline and company, skips "Independent" and blanks', () => {
  assert.equal(roleLine('Seed investor', 'Harbor Ventures'), 'Seed investor at Harbor Ventures')
  assert.equal(roleLine('Product designer', 'Independent'), 'Product designer')
  assert.equal(roleLine(null, 'Parcel'), 'Parcel')
  assert.equal(roleLine(' ', null), undefined)
})

test('attendeeToPerson uses the bio as summary and as the citable fact', () => {
  const p = attendeeToPerson({
    id: 'a1', event_id: 'e1', name: 'Maya Chen', headline: 'Founding engineer', company: 'Northwind Labs',
    bio: 'Builds agent tooling.', linkedin_url: null, x_handle: null,
  })
  assert.deepEqual(p, { id: 'a1', name: 'Maya Chen', headline: 'Founding engineer at Northwind Labs', location: undefined, summary: 'Builds agent tooling.', interests: undefined, evidence: ['Builds agent tooling.'] })
  assert.equal(attendeeToPerson({ ...p, event_id: 'e1', headline: null, company: null, bio: '', linkedin_url: null, x_handle: null }).evidence, undefined)
})

test('profileToPerson falls back when full_name is empty', () => {
  const row = {
    id: 'u1', full_name: null, email: null, phone: null, linkedin_url: null, x_handle: null,
    headline: null, location: null, summary: null, interests: null, evidence: null,
  }
  const p = profileToPerson(row)
  assert.equal(p.name, 'the user')
  assert.equal(p.interests, undefined)
})

test('profileToPerson maps the user\'s research columns', () => {
  const p = profileToPerson({
    id: 'u1', full_name: 'Alex Rivera', email: null, phone: null, linkedin_url: null, x_handle: null,
    headline: 'Founder, Meety', location: 'San Francisco', summary: 'Builds an iMessage assistant.',
    interests: ['iMessage'], evidence: [],
  })
  assert.equal(p.headline, 'Founder, Meety')
  assert.equal(p.location, 'San Francisco')
  assert.equal(p.summary, 'Builds an iMessage assistant.')
  assert.deepEqual(p.interests, ['iMessage'])
  assert.equal(p.evidence, undefined)
})

test('attendeeToPerson adds research only once it is done', () => {
  const row = {
    id: 'a1', event_id: 'e1', name: 'Maya Chen', headline: null, company: null, bio: 'Builds agent tooling.',
    linkedin_url: null, x_handle: null, location: 'Oakland', summary: 'Ex-Stripe.', interests: ['agents'],
    evidence: ['Spoke at AI Engineer Summit.'],
  }
  const pending = attendeeToPerson({ ...row, research_status: 'pending' })
  assert.equal(pending.summary, 'Builds agent tooling.')
  assert.deepEqual(pending.evidence, ['Builds agent tooling.'])
  assert.equal(pending.interests, undefined)
  const done = attendeeToPerson({ ...row, research_status: 'done' })
  assert.equal(done.summary, 'Builds agent tooling. Ex-Stripe.')
  assert.equal(done.location, 'Oakland')
  assert.deepEqual(done.interests, ['agents'])
  assert.deepEqual(done.evidence, ['Spoke at AI Engineer Summit.'])
})

test('dedupeAttendees keeps one row per person', async () => {
  const { dedupeAttendees } = await import('../src/store.ts')
  const base = { event_id: 'e1', headline: null, bio: null, x_handle: null }
  const rows = [
    { ...base, id: '1', name: 'Maya Chen', company: 'Northwind', linkedin_url: null },
    { ...base, id: '2', name: 'maya chen ', company: 'Northwind', linkedin_url: null },
    { ...base, id: '3', name: 'Theo', company: null, linkedin_url: 'https://linkedin.com/in/theo/' },
    { ...base, id: '4', name: 'Theo M', company: null, linkedin_url: 'https://LinkedIn.com/in/theo' },
    { ...base, id: '5', name: 'Maya Chen', company: 'Other Co', linkedin_url: null },
  ]
  assert.deepEqual(dedupeAttendees(rows).map(r => r.id), ['1', '3', '5'])
})
