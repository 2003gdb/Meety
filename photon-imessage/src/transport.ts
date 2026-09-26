// The Photon Spectrum connection. iMessage in production, the terminal
// provider for local development (same Space/Message API, no credentials).

import { Spectrum, type Message, type Space } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { terminal } from "spectrum-ts/providers/terminal";

export interface Transport {
  kind: "imessage" | "terminal";
  messages: AsyncIterable<[Space, Message]>;
  /** Open (or reuse) the 1:1 chat with a user so we can text first. */
  openDm(phone: string): Promise<Space>;
  /** The Meety user key for an inbound message's sender. */
  phoneOf(message: Message): string | undefined;
  stop(): Promise<void>;
}

/** E.164 for phone numbers, lowercase for Apple ID emails. */
export function normalizeHandle(raw: string): string {
  const s = raw.trim();
  if (s.includes("@")) return s.toLowerCase();
  const digits = s.replace(/[^\d]/g, "");
  if (s.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function connectIMessage(): Promise<Transport> {
  if (!process.env.SPECTRUM_PROJECT_ID || !process.env.SPECTRUM_PROJECT_SECRET) {
    throw new Error("Set SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET, or run with MEETY_TRANSPORT=terminal");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(process.env.SPECTRUM_PROJECT_ID)) {
    throw new Error("SPECTRUM_PROJECT_ID should be the project's UUID (xxxxxxxx-xxxx-...) from app.photon.codes project Settings");
  }
  const app = await Spectrum({
    projectId: process.env.SPECTRUM_PROJECT_ID,
    projectSecret: process.env.SPECTRUM_PROJECT_SECRET,
    providers: [imessage.config()],
  });
  const im = imessage(app);
  return {
    kind: "imessage",
    messages: app.messages,
    async openDm(phone) {
      return im.space.create(await im.user(phone));
    },
    phoneOf(message) {
      return message.sender?.id ? normalizeHandle(message.sender.id) : undefined;
    },
    stop: () => app.stop(),
  };
}

/**
 * Local dev: every terminal chat belongs to one demo user, and "texting first"
 * opens a chat named after the phone number.
 */
export async function connectTerminal(demoPhone: string): Promise<Transport> {
  // Spectrum falls back to these env vars; keep terminal mode fully offline.
  delete process.env.SPECTRUM_PROJECT_ID;
  delete process.env.SPECTRUM_PROJECT_SECRET;
  const app = await Spectrum({
    providers: [terminal.config({ commands: [{ name: "/reset", description: "Start onboarding over" }] })],
  });
  const t = terminal(app);
  return {
    kind: "terminal",
    messages: app.messages,
    openDm: (phone) => t.space.get(phone),
    phoneOf: () => demoPhone,
    stop: () => app.stop(),
  };
}
