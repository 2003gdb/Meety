// The jev-integration lane inside the bot. Jev makes the decisions (who is worth
// meeting, what an open-ended message is asking for); the bot only talks.

import { systemOne, type Ask } from "../../jev-integration/src/jev.ts";
import { askAboutPerson, classifyInbound, rankAttendees } from "../../jev-integration/src/match.ts";
import { saveMatches } from "../../jev-integration/src/store.ts";
import { clip, type Person } from "../../jev-integration/src/templates.ts";
import { whyLine } from "../../jev-integration/src/why.ts";
import { rules, type Brain, type Interpretation } from "./brain.js";
import type { Attendee, MatchInput, MatchService, MatchVerdict, Profile } from "./contracts.js";
import type { Session } from "./state.js";

const MODEL = process.env.JEV_MODEL ?? "jev-latest";
/** Matches that get a "why" line; the flow shows the top 3. */
const EXPLAINED = 3;

function userPerson(p: Profile): Person {
  return {
    id: p.id ?? "user",
    name: p.name ?? "the user",
    headline: p.headline,
    location: p.location,
    summary: p.summary,
    interests: p.interests,
    evidence: p.evidence,
  };
}

function attendeePerson(a: Attendee): Person {
  const headline = a.headline ?? a.profile?.headline;
  // The "why" line must cite a fact; without research, the headline or what the user told us is all we have.
  const facts = a.profile?.evidence?.length
    ? a.profile.evidence
    : [headline, a.profile?.summary].filter((f): f is string => Boolean(f));
  return {
    id: a.id,
    name: a.name,
    headline,
    location: a.profile?.location,
    summary: a.profile?.summary || undefined,
    interests: a.profile?.interests,
    evidence: facts.length ? facts : undefined,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "can I talk to Priya about pricing?" → "pricing". Only an "about …" right after their name counts. */
export function topicOf(question: string | undefined, name: string): string | null {
  const first = name.split(/\s+/)[0];
  if (!question || !first) return null;
  const m = question.match(new RegExp(`\\b${escapeRe(first)}(?:\\s+\\w+)?,?\\s+about\\s+([^?.!]+)`, "i"));
  return m?.[1]?.trim() || null;
}

export class JevMatch implements MatchService {
  private ask: Ask;
  private save: boolean;

  /** `save` writes every verdict to the `matches` table; only set it when ids are real Supabase rows. */
  constructor(opts: { ask?: Ask; save?: boolean } = {}) {
    this.ask = opts.ask ?? systemOne;
    this.save = opts.save ?? false;
  }

  async rank({ profile, goal, event, attendees }: MatchInput & { attendees: Attendee[] }): Promise<MatchVerdict[]> {
    const user = userPerson(profile);
    const people = attendees.map(attendeePerson);
    const { matches, failed } = await rankAttendees(user, goal, people, { ask: this.ask });
    if (matches.length === 0 && failed.length) throw new Error(`Jev ranked none of ${failed.length} attendees`);

    const byId = new Map(people.map((person, i) => [person.id, { person, attendee: attendees[i]! }]));
    const top = matches.filter((m) => m.match).slice(0, EXPLAINED);
    const whys = new Map(
      await Promise.all(top.map(async (m) => [m.id, await whyLine(user, goal, byId.get(m.id)!.person)] as const)),
    );

    if (this.save && profile.id) {
      // Best effort: the user already gets their answer from this reply.
      await saveMatches(profile.id, event.id, goal, MODEL, matches.map((m) => ({ ...m, why: whys.get(m.id) }))).catch((err) =>
        console.error("[jev] saving matches failed", err),
      );
    }
    return matches.map((m) => ({
      attendee: byId.get(m.id)!.attendee,
      match: m.match,
      probability: m.probability,
      reason: whys.get(m.id) ?? "",
    }));
  }

  async assess({ profile, goal, attendee, question }: MatchInput & { attendee: Attendee; question?: string }): Promise<MatchVerdict> {
    const user = userPerson(profile);
    const person = attendeePerson(attendee);
    const v = await askAboutPerson(user, goal, person, topicOf(question, attendee.name), { ask: this.ask });
    const reason = v.yes
      ? await whyLine(user, goal, person)
      : `nothing in their profile connects to what you're after (${clip(goal, 80)}).`;
    return { attendee, match: v.yes, probability: v.topicProbability ?? v.probability, reason };
  }
}

/**
 * Once onboarding is done, Jev decides what an open-ended message is asking for
 * (intent routing, not model routing). Clear-cut replies, onboarding steps, and
 * anything Jev is unsure about stay with the conversation brain.
 */
export class JevBrain implements Brain {
  constructor(
    private inner: Brain,
    private ask: Ask = systemOne,
  ) {}

  async interpret(session: Session, text: string, context: { people?: string[] }): Promise<Interpretation> {
    if (session.step !== "ready" || rules(session.step, text, context.people)) {
      return this.inner.interpret(session, text, context);
    }
    const lastQuestion = [...session.history].reverse().find((t) => t.from === "agent")?.text ?? null;
    const intent = await classifyInbound(text, lastQuestion, { ask: this.ask }).catch((err) => {
      console.warn("[jev] classifyInbound failed", err);
      return null;
    });
    if (intent?.confident && intent.intent === "event_goal") return { kind: "new_goal", goal: text };
    if (intent?.confident && intent.intent === "matches_request") return { kind: "matches" };
    return this.inner.interpret(session, text, context);
  }
}
