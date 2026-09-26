// The conversation itself. Transport-agnostic: takes what the user said,
// returns the texts to send back. index.ts wires it to Photon.

import type { Attendee, LumaEvent, MeetyUser, Services } from "./contracts.js";
import type { Brain } from "./brain.js";
import { copy } from "./copy.js";
import { SessionStore, type Session } from "./state.js";

const TOP_MATCHES = 3;

export interface FlowOptions {
  signupUrl: string;
}

export class Flow {
  readonly sessions = new SessionStore();

  constructor(
    private services: Services,
    private brain: Brain,
    private opts: FlowOptions,
  ) {}

  /** First contact after sign-up (landing page handoff). */
  async start(user: MeetyUser): Promise<string[]> {
    await this.services.users.upsert(user);
    const session = this.sessions.reset(user.phone);
    const out = copy.welcome(user.name, await this.services.luma.connectUrl(user));
    this.log(session, out);
    return out;
  }

  /** Pre-event nudge (~24h before), fired by whoever watches the calendar. */
  async preEvent(phone: string, eventId?: string): Promise<string[]> {
    const user = await this.services.users.findByPhone(phone);
    if (!user) return [];
    const session = this.sessions.getOrCreate(phone);
    const events = await this.services.luma.upcomingEvents(user);
    const event = events.find((e) => e.id === eventId) ?? events[0];
    if (!event) return [];
    // If they're mid-onboarding, restart the event part of the flow from here.
    return this.log(session, await this.offer(session, user, event));
  }

  /** One user turn (a debounced burst of texts, already joined). */
  async handle(phone: string, text: string): Promise<string[]> {
    const user = await this.services.users.findByPhone(phone);
    if (!user) return copy.notSignedUp(this.opts.signupUrl);

    const session = this.sessions.getOrCreate(phone);
    this.sessions.remember(session, "user", text);
    const out = await this.step(session, user, text);
    return this.log(session, out);
  }

  private log(session: Session, out: string[]) {
    for (const t of out) this.sessions.remember(session, "agent", t);
    return out;
  }

  private async step(session: Session, user: MeetyUser, text: string): Promise<string[]> {
    const people = session.attendees?.map((a) => a.name);
    const said = await this.brain.interpret(session, text, { people });
    if (said.kind === "help") return copy.help();

    switch (session.step) {
      case "connect_luma": {
        if (said.kind !== "done" && said.kind !== "yes") {
          return said.kind === "other" && said.reply ? [said.reply] : copy.lumaNotYet(await this.services.luma.connectUrl(user));
        }
        if (!(await this.services.luma.isConnected(user))) return copy.lumaNotYet(await this.services.luma.connectUrl(user));
        const profile = await this.services.research.profileFor(user);
        if (!profile) {
          session.step = "ask_links";
          return copy.noProfileFound();
        }
        session.profile = profile;
        session.step = "confirm_identity";
        return copy.isThisYou(profile);
      }

      case "confirm_identity": {
        if (said.kind === "links") return this.useLinks(session, user, said);
        if (said.kind === "yes") return this.chooseEvent(session, user);
        if (said.kind === "no") {
          session.step = "ask_links";
          return copy.askLinks();
        }
        return said.kind === "other" && said.reply ? [said.reply] : copy.isThisYou(session.profile!);
      }

      case "ask_links": {
        if (said.kind === "links") return this.useLinks(session, user, said);
        return said.kind === "other" && said.reply ? [said.reply] : copy.linksNotFound();
      }

      case "pick_event": {
        const options = session.eventOptions ?? [];
        if (session.offeredEvent && said.kind === "yes") return this.selectEvent(session, session.offeredEvent);
        if (session.offeredEvent && said.kind === "no") {
          session.offeredEvent = undefined;
          if (options.length <= 1) return copy.noEvents();
          return copy.listEvents(options);
        }
        if (said.kind === "choice") {
          const picked = options[said.index];
          return picked ? this.selectEvent(session, picked) : copy.pickNumber(options.length);
        }
        if (said.kind === "other" && said.reply) return [said.reply];
        return session.offeredEvent ? copy.offerEvent(session.offeredEvent) : copy.pickNumber(options.length);
      }

      case "ask_goal": {
        if (said.kind === "other" && said.reply) return [said.reply];
        const goal = said.kind === "new_goal" ? said.goal : text.trim();
        return this.setGoalAndMatch(session, user, goal);
      }

      case "ready": {
        if (said.kind === "switch_event") return this.chooseEvent(session, user, { list: true });
        if (said.kind === "new_goal") {
          session.goal = said.goal;
          return [...copy.goalUpdated(said.goal), ...(await this.matchSummary(session, user))];
        }
        if (said.kind === "ask_person") return this.askAbout(session, user, said.name, said.question);
        if (said.kind === "other" && said.reply) return [said.reply];
        return copy.fallback();
      }
    }
  }

  private async useLinks(session: Session, user: MeetyUser, links: { linkedinUrl?: string; xUrl?: string }) {
    await this.services.users.upsert({ ...user, ...links });
    const profile = await this.services.research.profileFromLinks(user, links);
    if (!profile) {
      session.step = "ask_links";
      return copy.linksNotFound();
    }
    session.profile = profile;
    session.step = "confirm_identity";
    return copy.isThisYou(profile);
  }

  private async chooseEvent(session: Session, user: MeetyUser, opts: { list?: boolean } = {}) {
    const events = await this.services.luma.upcomingEvents(user);
    session.step = "pick_event";
    session.eventOptions = events;
    session.offeredEvent = undefined;
    if (!events.length) return copy.noEvents();
    if (opts.list && events.length > 1) return copy.listEvents(events);
    session.offeredEvent = events[0];
    return copy.offerEvent(events[0]!);
  }

  private async offer(session: Session, user: MeetyUser, event: LumaEvent) {
    if (!session.profile) session.profile = (await this.services.research.profileFor(user)) ?? undefined;
    session.step = "pick_event";
    session.eventOptions = await this.services.luma.upcomingEvents(user);
    session.offeredEvent = event;
    return copy.offerEvent(event);
  }

  private selectEvent(session: Session, event: LumaEvent) {
    session.event = event;
    session.offeredEvent = undefined;
    session.attendees = undefined;
    session.step = "ask_goal";
    return copy.askGoal(event);
  }

  private async setGoalAndMatch(session: Session, user: MeetyUser, goal: string) {
    session.goal = goal;
    session.step = "ready";
    return this.matchSummary(session, user);
  }

  private async loadAttendees(session: Session, user: MeetyUser) {
    if (session.attendees === undefined && session.event) {
      session.attendees = await this.services.luma.attendees(user, session.event.id);
    }
    return session.attendees;
  }

  private async matchSummary(session: Session, user: MeetyUser): Promise<string[]> {
    const event = session.event!;
    const attendees = await this.loadAttendees(session, user);
    if (attendees === null || attendees === undefined) return copy.guestListHidden(event);
    const ranked = await this.services.match.rank({ profile: this.profile(session, user), goal: session.goal!, event, attendees });
    return copy.matches(event, ranked.filter((v) => v.match).slice(0, TOP_MATCHES));
  }

  private async askAbout(session: Session, user: MeetyUser, name: string, question?: string) {
    const event = session.event!;
    const attendees = (await this.loadAttendees(session, user)) ?? [];
    let attendee = findPerson(attendees, name);
    if (!attendee) {
      // Not on the list (or the list is hidden). If they told us something about
      // the person, judge on that; otherwise ask what the person does.
      const described = question && question.split(/\s+/).length > 5;
      if (!described) return copy.unknownPerson(name, event);
      attendee = { id: `adhoc:${name.toLowerCase()}`, name, profile: { name, summary: question } };
    }
    const verdict = await this.services.match.assess({
      profile: this.profile(session, user),
      goal: session.goal!,
      event,
      attendee,
      question,
    });
    return copy.verdict(verdict);
  }

  private profile(session: Session, user: MeetyUser) {
    return session.profile ?? { name: user.name, summary: user.name ?? user.phone };
  }
}

function findPerson(attendees: Attendee[], name: string): Attendee | undefined {
  const n = name.toLowerCase().trim();
  return (
    attendees.find((a) => a.name.toLowerCase() === n) ??
    attendees.find((a) => a.name.toLowerCase().split(" ")[0] === n.split(" ")[0])
  );
}
