// The cheap conversation brain. It only interprets what the user said so the
// flow can decide what to do; it never decides matches (that's Jev's job).
// Clear-cut replies are handled by rules; the LLM covers everything else.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Session, Step } from "./state.js";

export type Interpretation =
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "done" }
  | { kind: "choice"; index: number }
  | { kind: "links"; linkedinUrl?: string; xUrl?: string }
  | { kind: "ask_person"; name: string; question?: string }
  | { kind: "new_goal"; goal: string }
  | { kind: "switch_event" }
  | { kind: "matches" }
  | { kind: "help" }
  | { kind: "other"; reply?: string };

export interface Brain {
  interpret(session: Session, text: string, context: { people?: string[] }): Promise<Interpretation>;
}

const YES = /^(y|ya|yes|yeah|yep|yup|sure|ok|okay|correct|that'?s me|it'?s me|definitely|sounds good|👍)\b/i;
const NO = /^(n|no|nope|nah|not me|wrong|that'?s not me|not really)\b/i;
const DONE = /^(done|did it|ok done|connected|finished|i'?m in|logged in)\b/i;
const HELP = /^(help|\?|what can you do)\b/i;
const SWITCH = /\b(different|another|other|switch|change)\b.*\bevent\b/i;
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_\-%]+/i;
const X_URL = /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+/i;
const X_HANDLE = /(?:^|\s)@([A-Za-z0-9_]{2,15})\b/;

/** Deterministic interpretation; returns null when the text needs judgement. */
export function rules(step: Step, text: string, people: string[] = []): Interpretation | null {
  const t = text.trim();

  const linkedin = t.match(LINKEDIN)?.[0];
  const x = t.match(X_URL)?.[0] ?? (t.match(X_HANDLE)?.[1] ? `https://x.com/${t.match(X_HANDLE)![1]}` : undefined);
  if (linkedin || (x && step === "ask_links")) return { kind: "links", linkedinUrl: linkedin, xUrl: x };

  if (HELP.test(t)) return { kind: "help" };
  if (step === "connect_luma" && (DONE.test(t) || YES.test(t))) return { kind: "done" };

  if (step === "pick_event") {
    const n = t.match(/^#?(\d{1,2})\b/);
    if (n) return { kind: "choice", index: Number(n[1]) - 1 };
  }

  if (step === "ready") {
    if (SWITCH.test(t)) return { kind: "switch_event" };
    const name = people.find((p) => new RegExp(`\\b${escape(p.split(" ")[0]!)}\\b`, "i").test(t));
    if (name) return { kind: "ask_person", name, question: t };
    return null;
  }

  if (YES.test(t)) return { kind: "yes" };
  if (NO.test(t)) return { kind: "no" };
  return null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class RuleBrain implements Brain {
  async interpret(session: Session, text: string, context: { people?: string[] }) {
    return rules(session.step, text, context.people) ?? fallbackFor(session.step, text);
  }
}

function fallbackFor(step: Step, text: string): Interpretation {
  if (step === "ready") {
    // "I'm talking to Dana, she does X" → treat a capitalised word after a cue as a name.
    const m = text.match(/\b(?:talking to|talk to|in front of|with|about|meet|met|is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
    if (m?.[1]) return { kind: "ask_person", name: m[1], question: text };
    if (/\b(actually|now|instead)\b.*\b(looking|want|hiring|raising|meet)\b/i.test(text)) return { kind: "new_goal", goal: text };
  }
  return { kind: "other" };
}

const STEP_GUIDE: Record<Step, string> = {
  connect_luma: "We asked the user to log into Luma through a link and text 'done'. Intent 'done' if they say they've finished.",
  confirm_identity: "We showed a research summary and asked 'is this you?'. Intent 'yes' or 'no'.",
  ask_links: "We asked for their LinkedIn URL and optionally their X handle. Intent 'links' with the URLs.",
  pick_event: "We offered one or more upcoming events. 'yes'/'no' about the single offered event, or 'choice' with a 1-based number.",
  ask_goal: "We asked what they want to get out of the event. Intent 'new_goal' with their goal restated in a few words.",
  ready:
    "Onboarding is done and they may be at the event. 'ask_person' when they ask about someone (name + their question), 'new_goal' when they change what they're after, 'switch_event' to pick another event, 'help' when they ask what you can do.",
};

const Output = z.object({
  intent: z.enum(["yes", "no", "done", "choice", "links", "ask_person", "new_goal", "switch_event", "help", "other"]),
  choice_number: z.number().int().nullable(),
  person_name: z.string().nullable(),
  question: z.string().nullable(),
  goal: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  x_url: z.string().nullable(),
  reply: z.string().nullable().describe("Only for intent 'other': a one or two sentence text reply that nudges them back to the current step."),
});

const SYSTEM = `You interpret iMessage replies for Meety, an agent that tells people who to meet at their next Luma event.
Classify the user's latest message for the current step. Extract fields only when the user actually said them; otherwise null.
When the intent is 'other', write a short, plain reply in Meety's voice: casual, lowercase is fine, no emoji, no exclamation marks, no filler.`;

export class LlmBrain implements Brain {
  private client = new Anthropic();

  constructor(private model: string) {}

  async interpret(session: Session, text: string, context: { people?: string[] }): Promise<Interpretation> {
    const ruled = rules(session.step, text, context.people);
    if (ruled) return ruled;

    try {
      const history = session.history
        .slice(-8)
        .map((t) => `${t.from === "user" ? "User" : "Meety"}: ${t.text}`)
        .join("\n");
      const facts = [
        `Current step: ${session.step}. ${STEP_GUIDE[session.step]}`,
        session.event && `Selected event: ${session.event.name}`,
        session.goal && `User's goal: ${session.goal}`,
        session.eventOptions?.length && `Events on offer: ${session.eventOptions.map((e, i) => `${i + 1}. ${e.name}`).join("; ")}`,
        context.people?.length && `People on the guest list: ${context.people.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: 512,
          system: SYSTEM,
          messages: [{ role: "user", content: `${facts}\n\nRecent conversation:\n${history}\n\nLatest message from the user:\n${text}` }],
          output_config: { format: zodOutputFormat(Output) },
        },
        { timeout: 10_000, maxRetries: 1 },
      );
      const o = res.parsed_output;
      if (!o) return fallbackFor(session.step, text);
      return toInterpretation(o, text) ?? fallbackFor(session.step, text);
    } catch (err) {
      if (err instanceof Anthropic.APIError) console.warn(`[brain] Claude API ${err.status}: ${err.message}`);
      else console.warn("[brain] interpret failed", err);
      return fallbackFor(session.step, text);
    }
  }
}

function toInterpretation(o: z.infer<typeof Output>, text: string): Interpretation | null {
  switch (o.intent) {
    case "choice":
      return o.choice_number ? { kind: "choice", index: o.choice_number - 1 } : null;
    case "links":
      return o.linkedin_url || o.x_url ? { kind: "links", linkedinUrl: o.linkedin_url ?? undefined, xUrl: o.x_url ?? undefined } : null;
    case "ask_person":
      return o.person_name ? { kind: "ask_person", name: o.person_name, question: o.question ?? text } : null;
    case "new_goal":
      return { kind: "new_goal", goal: o.goal ?? text };
    case "other":
      return { kind: "other", reply: o.reply ?? undefined };
    default:
      return { kind: o.intent };
  }
}

export function makeBrain(): Brain {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return new LlmBrain(process.env.MEETY_BRAIN_MODEL || "claude-haiku-4-5");
  }
  console.warn("[brain] no Anthropic credentials, using rule-based interpretation only");
  return new RuleBrain();
}
