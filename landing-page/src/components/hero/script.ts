import type { ChatMessage } from "@/types";

/**
 * One message in the hero demo, plus its timing.
 * pause:  ms of silence before anything happens
 * typing: ms Meety shows the typing indicator (Meety messages only)
 * readAt: receipt time shown under the user's message once Meety reads it
 */
export type ScriptStep = ChatMessage & {
  pause: number;
  typing?: number;
  readAt?: string;
};

export const THREAD_STARTED_AT = "7:02 PM";

/** Messages rendered on the server, so the phone is never empty on first paint. */
export const INITIAL_SHOWN = 2;

export const SCRIPT: ScriptStep[] = [
  {
    id: "event",
    from: "meety",
    kind: "text",
    text: "You’re going to Agents Night SF tomorrow at 7pm. 140 people registered.",
    pause: 700,
    typing: 1300,
  },
  {
    id: "goal",
    from: "meety",
    kind: "text",
    text: "What do you want to walk out with?",
    pause: 300,
    typing: 900,
  },
  {
    id: "answer",
    from: "user",
    kind: "text",
    text: "A technical cofounder. Ideally someone deep in agent infra",
    pause: 900,
    readAt: "7:03 PM",
  },
  {
    id: "intro",
    from: "meety",
    kind: "text",
    text: "Went through all 140. These three are worth finding:",
    pause: 500,
    typing: 1900,
  },
  {
    id: "priya",
    from: "meety",
    kind: "person",
    person: {
      name: "Priya Raman",
      match: 84,
      why: "Built eval infra at a YC startup. Posted Tuesday that she’s leaving to start something.",
    },
    pause: 450,
  },
  {
    id: "marcus",
    from: "meety",
    kind: "person",
    person: {
      name: "Marcus Oyelaran",
      match: 77,
      why: "Maintains an open-source agent runtime. Wants a product-minded cofounder.",
    },
    pause: 450,
  },
  {
    id: "lena",
    from: "meety",
    kind: "person",
    person: {
      name: "Lena Hoffmann",
      match: 71,
      why: "Led infra at a Series B dev tools company. Left in June.",
    },
    pause: 450,
  },
  {
    id: "pick",
    from: "user",
    kind: "text",
    text: "Priya first. What do I open with?",
    pause: 1200,
    readAt: "7:05 PM",
  },
  {
    id: "opener",
    from: "meety",
    kind: "text",
    text: "Ask what she thinks agent evals get wrong. That was her Tuesday post, and it’s probably what she wants to build.",
    pause: 500,
    typing: 1700,
  },
];
