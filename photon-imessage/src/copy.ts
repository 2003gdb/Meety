// Everything Meety says, in one place so the voice stays consistent.
// Write like a friend texting: short, lowercase is fine, no filler.

import type { LumaEvent, MatchVerdict, Profile } from "./contracts.js";

const firstName = (name?: string) => name?.split(" ")[0];

export function when(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `tomorrow at ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const pct = (p: number) => `${Math.round(p * 100)}%`;

export const copy = {
  notSignedUp: (url: string) => [`hey, I'm Meety. I only talk to people who've signed up, so grab a spot here first: ${url}`],

  welcome: (name: string | undefined, connectUrl: string) => [
    `hey${name ? ` ${firstName(name)}` : ""}, it's Meety. I'll tell you who's worth meeting at your next Luma event.`,
    `first I need to see your events. log into Luma here and text me "done" when you're in: ${connectUrl}`,
  ],

  lumaNotYet: (connectUrl: string) => [`I can't see your Luma account yet. try the link again and text me when it's done: ${connectUrl}`],

  isThisYou: (p: Profile) => [`quick check so I match you properly. is this you?`, p.summary],

  noProfileFound: () => [`I couldn't find you online. send me your LinkedIn link (and your X if you use it more)`],

  askLinks: () => [`no worries. send me your LinkedIn link, and your X handle if that's where you actually post`],

  linksNotFound: () => [`I couldn't read that one. can you paste the full LinkedIn URL?`],

  noEvents: () => [
    `you don't have anything coming up on Luma. register for something and I'll text you the day before with who to meet`,
  ],

  offerEvent: (e: LumaEvent) => [`you're down for ${e.name} ${when(e.startsAt)}. want me to prep you for that one?`],

  listEvents: (events: LumaEvent[]) => [
    `which one then?\n${events.map((e, i) => `${i + 1}. ${e.name}, ${when(e.startsAt)}`).join("\n")}`,
  ],

  pickNumber: (n: number) => [`just send the number, 1 to ${n}`],

  askGoal: (e: LumaEvent) => [
    `what do you want to get out of ${e.name}? hiring, raising, finding a cofounder, meeting users, anything. a voice note works too`,
  ],

  voiceFailed: () => [`I couldn't make out that voice note. mind typing it?`],

  guestListHidden: (e: LumaEvent) => [
    `the host of ${e.name} hid the guest list, so I can't pre-screen people. when you're there, text me who you're talking to and I'll tell you if they're worth your time`,
  ],

  matches: (e: LumaEvent, top: MatchVerdict[]) =>
    top.length
      ? [
          `here's who I'd find at ${e.name}:`,
          top.map((v, i) => `${i + 1}. ${v.attendee.name}, ${v.attendee.headline ?? ""}\n${v.reason}`).join("\n\n"),
          `when you're there, text me something like "I'm talking to Priya, what does she do?" and I'll tell you if it's worth it`,
        ]
      : [
          `nobody on the ${e.name} list is an obvious fit for that. I'd still go, and text me whoever you end up talking to so I can check them`,
        ],

  verdict: (v: MatchVerdict) => [
    `${v.match ? "yes" : "probably not"}, ${pct(v.probability)}. ${v.attendee.headline ? `${v.attendee.name}: ${v.attendee.headline}. ` : ""}${v.reason}`,
  ],

  unknownPerson: (name: string, e: LumaEvent) => [
    `I don't see ${name} on the ${e.name} list. what do they do? I'll tell you if it's worth the chat`,
  ],

  goalUpdated: (goal: string) => [`got it, now looking for: ${goal}`],

  help: () => [
    `you can ask me about anyone at the event ("should I talk to Sherry?"), change what you're after ("actually I'm hiring"), or switch events ("different event")`,
  ],

  fallback: () => [`not sure I follow. ask me about someone at the event, or say "help"`],

  error: () => [`something broke on my end. give me a minute and try again`],
};
