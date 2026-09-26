// Manual runner for the demo and for testing on teammates.
//   node src/cli.ts user "Martin Galaz" martin@autodesk.com [--save <profile_id>]
//   node src/cli.ts confirm "Martin Galaz" https://www.linkedin.com/in/martingalaz [more urls]
//   node src/cli.ts attendees guests.json   (Luma rows: first_name, last_name, email, linkedin/x)
//   node src/cli.ts event <event_id>        (researches the event's attendees rows in place, skipping fresh ones)
//   --save <profile_id> writes candidates / research onto that profiles row
import { readFileSync } from 'node:fs'
import { confirmUser, findUserCandidates, fromLuma, researchAttendees } from './research.ts'
import { llmConfigured } from './llm.ts'
import { researchEvent, saveCandidates, saveUserResearch } from './store.ts'
import type { LumaGuest } from './types.ts'

const [command, ...args] = process.argv.slice(2)
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))

if (!llmConfigured()) console.error('note: GMI_API_KEY not set, summaries use the heuristic fallback')

switch (command) {
  case 'user': {
    const at = args.indexOf('--save')
    const profileId = at === -1 ? null : args[at + 1]
    const [name, email = ''] = at === -1 ? args : args.slice(0, at)
    const { query, candidates } = await findUserCandidates(name, email)
    if (profileId) await saveCandidates(profileId, candidates)
    console.error(`query: ${query}`)
    console.log('Is one of these you?')
    candidates.forEach((c, i) => console.log(`${i + 1}) ${name}, ${c.label}  <${c.url}>`))
    console.log(`${candidates.length + 1}) None of these. Send me your LinkedIn or X link.`)
    break
  }
  case 'confirm': {
    const at = args.indexOf('--save')
    const profileId = at === -1 ? null : args[at + 1]
    const [name, ...urls] = at === -1 ? args : [...args.slice(0, at), ...args.slice(at + 2)]
    const profile = await confirmUser({ name, profile_id: profileId }, urls)
    print(profile)
    if (profileId) await saveUserResearch(profileId, profile)
    break
  }
  case 'attendees': {
    const guests = JSON.parse(readFileSync(args[0], 'utf8')) as LumaGuest[]
    print(await researchAttendees(guests.map(fromLuma)))
    break
  }
  case 'event': {
    print(await researchEvent(args[0]))
    break
  }
  default:
    console.error('usage: node src/cli.ts user <name> <email> [--save <profile_id>] | confirm <name> <url...> [--save <profile_id>] | attendees <file.json> | event <event_id>')
    process.exit(1)
}
