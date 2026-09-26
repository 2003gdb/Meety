// The seams between this module and the other lanes.
// Each interface is implemented by a stub in stubs.ts today and by the owning
// lane's real code at integration time. Keep these shapes small and stable.

export interface MeetyUser {
  /** Canonical iMessage handle: E.164 phone number (or Apple ID email). */
  phone: string;
  name?: string;
  email?: string;
  linkedinUrl?: string;
  xUrl?: string;
}

/** tavily-research output: who the user (or an attendee) is. */
export interface Profile {
  /** profiles.id or attendees.id when it came from Supabase. */
  id?: string;
  name?: string;
  headline?: string;
  location?: string;
  /** One or two sentences, used for "Is this you?" and inside Jev prompts. */
  summary: string;
  /** Topic tags Jev reads, and checkable facts the "why" line may cite. */
  interests?: string[];
  evidence?: string[];
  linkedinUrl?: string;
  xUrl?: string;
}

/** browserbase-luma output. */
export interface LumaEvent {
  id: string;
  name: string;
  /** ISO 8601 */
  startsAt: string;
  url?: string;
  location?: string;
}

export interface Attendee {
  id: string;
  name: string;
  headline?: string;
  profileUrl?: string;
  profile?: Profile;
}

/** jev-integration output: one yes/no call with its probability. */
export interface MatchVerdict {
  attendee: Attendee;
  match: boolean;
  /** 0..1 */
  probability: number;
  reason: string;
}

export interface MatchInput {
  profile: Profile;
  goal: string;
  event: LumaEvent;
}

/** landing-page lane: who has signed up. */
export interface UserDirectory {
  findByPhone(phone: string): Promise<MeetyUser | null>;
  upsert(user: MeetyUser): Promise<void>;
}

/** browserbase-luma lane. */
export interface LumaService {
  /** Link the user opens to log into Luma through the Browserbase flow. */
  connectUrl(user: MeetyUser): Promise<string>;
  isConnected(user: MeetyUser): Promise<boolean>;
  /** Soonest first. */
  upcomingEvents(user: MeetyUser): Promise<LumaEvent[]>;
  /** null when the host hides the guest list. */
  attendees(user: MeetyUser, eventId: string): Promise<Attendee[] | null>;
}

/** tavily-research lane. */
export interface ResearchService {
  /** Background research kicked off at sign-up; null if nothing found yet. */
  profileFor(user: MeetyUser): Promise<Profile | null>;
  /** Re-run research from links the user gave us after "that's not me". */
  profileFromLinks(user: MeetyUser, links: { linkedinUrl?: string; xUrl?: string }): Promise<Profile | null>;
  /** The user said "yes, that's me" to the profile we showed. */
  confirm(user: MeetyUser): Promise<void>;
}

/** jev-integration lane. */
export interface MatchService {
  /** Pre-event pass over every attendee. Sorted best first. */
  rank(input: MatchInput & { attendees: Attendee[] }): Promise<MatchVerdict[]>;
  /** Live "should I talk to this person?" check. */
  assess(input: MatchInput & { attendee: Attendee; question?: string }): Promise<MatchVerdict>;
}

/** Voice note to text. Provider not chosen yet. */
export interface Transcriber {
  transcribe(audio: Buffer, mimeType: string): Promise<string | null>;
}

export interface Services {
  users: UserDirectory;
  luma: LumaService;
  research: ResearchService;
  match: MatchService;
  transcriber: Transcriber;
}
