// Manual runner for the demo and for testing templates.
//   node src/cli.ts match fixtures/demo.json          rank attendees, write "why" lines for the top 3
//   node src/cli.ts match-event <profile_id|+phone> <event_id> "<goal>" [--save]   same, on live Supabase data
//   node src/cli.ts ask fixtures/demo.json Priya "hiring ML engineers"
//   node src/cli.ts intent "should I talk to Priya?" "What are you trying to get from this event?"
// Add --dry to print the exact Jev request bodies instead of calling the API.
import { readFileSync } from 'node:fs'
import { jevConfigured, systemOne, type Ask } from './jev.ts'
import { askAboutPerson, classifyInbound, findByName, formatVerdict, rankAttendees } from './match.ts'
import { whyLine } from './why.ts'
import { attendeeToPerson, dedupeAttendees, loadAttendees, loadEvent, loadUser, profileToPerson, saveMatches } from './store.ts'
import type { Person } from './templates.ts'

const argv = process.argv.slice(2)
const dry = argv.includes('--dry')
const [command, ...args] = argv.filter(a => !a.startsWith('--'))
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))

// Dry run: show each request and answer 0.5 so the pipeline still completes.
const dryAsk: Ask = async (state, questions) => {
  print({ model: process.env.JEV_MODEL ?? 'jev-latest', state, questions })
  const answers = Object.fromEntries(
    Object.entries(questions).map(([id, q]) =>
      q.type === 'choice'
        ? [id, { type: 'choice', choice: Object.keys(q.criteria)[0], probabilities: {}, confidence: 0 }]
        : [id, { type: 'noul', noul: 0.5 }],
    ),
  )
  return { model: 'dry-run', answers, usage: { input_tokens: 0, output_tokens: 0 } } as Awaited<ReturnType<Ask>>
}

if (!dry && !jevConfigured()) {
  console.error('No TypeSafe key: set TYPESAFE_API_KEY or add jev-integration/jev.key (or pass --dry)')
  process.exit(1)
}
const ask = dry ? dryAsk : systemOne

interface Fixture { user: Person; goal: string; attendees: Person[] }
const load = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Fixture

switch (command) {
  case 'match': {
    const { user, goal, attendees } = load(args[0])
    const started = Date.now()
    const { matches, failed } = await rankAttendees(user, goal, attendees, { ask })
    console.error(`${attendees.length} attendees ranked in ${Date.now() - started} ms`)
    const byId = new Map(attendees.map(a => [a.id, a]))
    const top = matches.filter(m => m.match).slice(0, 3)
    const whys = await Promise.all(top.map(m => whyLine(user, goal, byId.get(m.id)!)))
    print({ top: top.map((m, i) => ({ ...m, why: whys[i] })), all: matches, failed })
    break
  }
  case 'ask': {
    const [file, name, topic = null] = args
    const { user, goal, attendees } = load(file)
    const found = findByName(name, attendees)
    if (found.length !== 1) {
      console.log(found.length ? `Which one? ${found.map(p => p.name).join(', ')}` : `No attendee named "${name}"`)
      break
    }
    const verdict = await askAboutPerson(user, goal, found[0], topic, { ask })
    console.log(formatVerdict(verdict))
    print(verdict)
    break
  }
  case 'intent': {
    const [message, last = null] = args
    print(await classifyInbound(message, last, { ask }))
    break
  }
  case 'match-event': {
    // Live data: the user's profile + the event's attendees from Supabase.
    const [who, eventId, goal] = args
    if (!who || !eventId || !goal) {
      console.error('usage: node src/cli.ts match-event <profile_id|+phone> <event_id> "<goal>" [--save] [--dry]')
      process.exit(1)
    }
    const [profile, event, rows] = await Promise.all([loadUser(who), loadEvent(eventId), loadAttendees(eventId)])
    if (!profile) throw new Error(`No profile for ${who}`)
    if (!event) throw new Error(`No event ${eventId}`)
    const user = profileToPerson(profile)
    const unique = dedupeAttendees(rows)
    if (unique.length < rows.length) console.error(`dropped ${rows.length - unique.length} duplicate attendee rows`)
    const attendees = unique.map(attendeeToPerson)
    const started = Date.now()
    const { matches, failed } = await rankAttendees(user, goal, attendees, { ask })
    console.error(`${event.name}: ${attendees.length} attendees ranked in ${Date.now() - started} ms`)
    const byId = new Map(attendees.map(a => [a.id, a]))
    const top = matches.filter(m => m.match).slice(0, 3)
    const whys = new Map(await Promise.all(top.map(async m => [m.id, await whyLine(user, goal, byId.get(m.id)!)] as const)))
    const ranked = matches.map(m => ({ ...m, why: whys.get(m.id) }))
    if (argv.includes('--save') && !dry) {
      await saveMatches(profile.id, event.id, goal, process.env.JEV_MODEL ?? 'jev-latest', ranked)
      console.error(`saved ${ranked.length} rows to matches`)
    }
    print({ user: user.name, event: event.name, top: ranked.filter(m => m.why), all: ranked, failed })
    break
  }
  default:
    console.error('usage: node src/cli.ts match <file.json> | match-event <profile_id|+phone> <event_id> "<goal>" [--save] | ask <file.json> <name> [topic] | intent <message> [bot_last_question]  [--dry]')
    process.exit(1)
}
