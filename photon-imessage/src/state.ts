import type { Attendee, LumaEvent, Profile } from "./contracts.js";

/**
 * Onboarding runs top to bottom, then the user stays in "ready" for live Q&A.
 * connect_luma → confirm_identity (→ ask_links) → pick_event → ask_goal → ready
 */
export type Step = "connect_luma" | "confirm_identity" | "ask_links" | "pick_event" | "ask_goal" | "ready";

export interface Turn {
  from: "user" | "agent";
  text: string;
}

export interface Session {
  phone: string;
  step: Step;
  profile?: Profile;
  /** Events currently on offer, in the order the user saw them. */
  eventOptions?: LumaEvent[];
  /** Set while we're asking "are you going to X?" about a single event. */
  offeredEvent?: LumaEvent;
  event?: LumaEvent;
  goal?: string;
  /** undefined = not fetched, null = guest list hidden. */
  attendees?: Attendee[] | null;
  history: Turn[];
}

const HISTORY_LIMIT = 16;

export class SessionStore {
  private sessions = new Map<string, Session>();

  get(phone: string): Session | undefined {
    return this.sessions.get(phone);
  }

  getOrCreate(phone: string): Session {
    let s = this.sessions.get(phone);
    if (!s) {
      s = { phone, step: "connect_luma", history: [] };
      this.sessions.set(phone, s);
    }
    return s;
  }

  reset(phone: string): Session {
    this.sessions.delete(phone);
    return this.getOrCreate(phone);
  }

  remember(session: Session, from: Turn["from"], text: string) {
    session.history.push({ from, text });
    if (session.history.length > HISTORY_LIMIT) session.history.splice(0, session.history.length - HISTORY_LIMIT);
  }
}
