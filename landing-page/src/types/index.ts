/** Who sent an iMessage in a Meety thread. */
export type ChatSender = "meety" | "user";

/** An attendee Meety suggests meeting, with the match probability (0-100). */
export interface PersonMatch {
  name: string;
  match: number;
  why: string;
}

export type ChatMessage =
  | { id: string; from: ChatSender; kind: "text"; text: string }
  | { id: string; from: "meety"; kind: "person"; person: PersonMatch };

/** Row in public.profiles (supabase/migrations/0001_profiles.sql). */
export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  x_handle: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

/** State returned by form Server Actions to useActionState. */
export interface ActionState {
  error: string | null;
}

export interface SignupState extends ActionState {
  sentTo: string | null;
}
