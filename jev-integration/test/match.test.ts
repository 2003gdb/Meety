import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Ask, Question } from '../src/jev.ts'
import {
  askAboutPerson, BATCH_SIZE, chunk, classifyInbound, findByName, formatVerdict, rankAttendees,
} from '../src/match.ts'
import { clip, personState, worthMeeting, type Person } from '../src/templates.ts'
import { fallbackWhy } from '../src/why.ts'

const user: Person = { id: 'u', name: 'Demo User', summary: 'Founder' }
const people = (n: number): Person[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i}`, summary: `score ${i}` }))

// Fake Jev: noul = the number in the attendee summary / 100, so ranking is predictable.
function fakeAsk(calls: { state: unknown; questions: Record<string, Question> }[] = []): Ask {
  return async (state, questions) => {
    calls.push({ state, questions })
    const answers = Object.fromEntries(
      Object.entries(questions).map(([id, q]) => {
        const summary = ((q.instructions as { attendee?: { summary: string } }).attendee?.summary) ?? ''
        const n = Number(summary.match(/\d+/)?.[0] ?? 50)
        return [id, { type: 'noul' as const, noul: n / 100 }]
      }),
    )
    return { model: 'jev-test', answers, usage: { input_tokens: 0, output_tokens: 0 } }
  }
}

test('chunk splits into batches', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(chunk([], 3), [])
})

test('rankAttendees batches, skips the user, sorts, and thresholds', async () => {
  const calls: { state: unknown; questions: Record<string, Question> }[] = []
  const list = [...people(60), { ...user }]
  const { matches, failed } = await rankAttendees(user, 'find a cofounder', list, { ask: fakeAsk(calls) })
  assert.equal(calls.length, Math.ceil(60 / BATCH_SIZE))
  assert.ok(calls.every(c => Object.keys(c.questions).length <= BATCH_SIZE))
  assert.equal(matches.length, 60)
  assert.equal(failed.length, 0)
  assert.equal(matches[0].id, 'p59')
  assert.ok(matches.every((m, i) => i === 0 || matches[i - 1].probability >= m.probability))
  assert.equal(matches.find(m => m.id === 'p50')?.match, true)
  assert.equal(matches.find(m => m.id === 'p49')?.match, false)
})

test('rankAttendees reports a failed batch instead of throwing', async () => {
  let n = 0
  const flaky: Ask = async (s, q) => {
    if (n++ === 0) throw new Error('529')
    return fakeAsk()(s, q)
  }
  const { matches, failed } = await rankAttendees(user, 'goal', people(30), { ask: flaky })
  assert.equal(failed.length, BATCH_SIZE)
  assert.equal(matches.length, 30 - BATCH_SIZE)
})

test('askAboutPerson: the topic decides when given', async () => {
  const ask: Ask = async (_s, q) => ({
    model: 't', usage: { input_tokens: 0, output_tokens: 0 },
    answers: Object.fromEntries(Object.keys(q).map(id => [id, { type: 'noul', noul: id === 'topic' ? 0.3 : 0.9 }])),
  })
  const v = await askAboutPerson(user, 'g', { id: 'x', name: 'X' }, 'fundraising', { ask })
  assert.equal(v.yes, false)
  assert.equal(formatVerdict(v), 'Probably not, 30%')
  const plain = await askAboutPerson(user, 'g', { id: 'x', name: 'X' }, null, { ask })
  assert.equal(formatVerdict(plain), 'Yes, 90%')
})

test('classifyInbound gates on confidence and rejects unknown labels', async () => {
  const answer = (choice: string, confidence: number): Ask => async () => ({
    model: 't', usage: { input_tokens: 0, output_tokens: 0 },
    answers: { intent: { type: 'choice', choice, probabilities: {}, confidence } },
  })
  assert.deepEqual(await classifyInbound('hi', null, { ask: answer('event_goal', 0.8) }),
    { intent: 'event_goal', confidence: 0.8, confident: true })
  assert.equal((await classifyInbound('hi', null, { ask: answer('event_goal', 0.2) })).confident, false)
  assert.equal((await classifyInbound('hi', null, { ask: answer('made_up', 0.9) })).intent, 'other')
})

test('findByName matches name prefixes, ignoring accents and case', () => {
  const list: Person[] = [
    { id: '1', name: 'Carlos Méndez' }, { id: '2', name: 'Carla Ruiz' }, { id: '3', name: 'Priya Raman' },
  ]
  assert.deepEqual(findByName('carlos', list).map(p => p.id), ['1'])
  assert.deepEqual(findByName('car', list).map(p => p.id), ['1', '2'])
  assert.deepEqual(findByName('mendez', list).map(p => p.id), ['1'])
  assert.deepEqual(findByName('x', list), [])
})

test('templates clip long, untrusted fields and keep state small', () => {
  assert.equal(clip('a'.repeat(10), 5), 'aaaa…')
  assert.equal(clip(null, 5), '')
  const s = personState({ id: 'x', name: 'X', summary: 'z'.repeat(5000), interests: Array(20).fill('i') })
  assert.ok(s.summary.length <= 1200)
  assert.equal(s.interests.length, 6)
  assert.equal('evidence' in s, false)
  const q = worthMeeting({ id: 'x', name: 'X' })
  assert.equal(q.type, 'noul')
})

test('fallbackWhy cites evidence, then headline', () => {
  assert.equal(fallbackWhy({ id: 'a', name: 'A', evidence: ['gave a talk'], headline: 'h' }), 'A: gave a talk')
  assert.equal(fallbackWhy({ id: 'a', name: 'A', headline: 'PM' }), 'A: PM')
})
