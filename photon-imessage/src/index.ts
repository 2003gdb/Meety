import type { Message, Space } from "spectrum-ts";
import { makeBrain } from "./brain.js";
import type { Services } from "./contracts.js";
import { copy } from "./copy.js";
import { Flow } from "./flow.js";
import { startHttp } from "./http.js";
import { Inbox } from "./inbox.js";
import { stubServices } from "./stubs.js";
import { connectIMessage, connectTerminal, normalizeHandle, type Transport } from "./transport.js";

const env = process.env;
const config = {
  transport: env.MEETY_TRANSPORT === "terminal" ? "terminal" : "imessage",
  signupUrl: env.MEETY_SIGNUP_URL || "https://meety.example.com",
  port: Number(env.MEETY_HTTP_PORT || 8787),
  secret: env.MEETY_INTERNAL_SECRET || undefined,
  debounceMs: Number(env.MEETY_DEBOUNCE_MS || 2500),
  demoPhone: "+15550000000",
  demoName: env.MEETY_DEMO_NAME || "Sam Taylor",
} as const;

/** Gap between consecutive bubbles so a multi-part reply reads like typing. */
const BUBBLE_GAP_MS = 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendAll(space: Space, texts: string[]) {
  for (const [i, t] of texts.entries()) {
    if (i > 0) await sleep(BUBBLE_GAP_MS);
    await space.send(t);
  }
}

/** Text we can feed the flow, or null for things we ignore (reactions, read receipts...). */
async function toText(message: Message, services: Services): Promise<string | null> {
  const c = message.content;
  if (c.type === "text") return c.text;
  if (c.type === "reply" && c.content.type === "text") return c.content.text;
  const isAudio = c.type === "voice" || (c.type === "attachment" && c.mimeType.startsWith("audio/"));
  if (isAudio) {
    const audio = await c.read();
    return (await services.transcriber.transcribe(audio, c.mimeType)) ?? "";
  }
  return null;
}

async function main() {
  const services = stubServices();
  const flow = new Flow(services, makeBrain(), { signupUrl: config.signupUrl });
  const transport: Transport =
    config.transport === "terminal" ? await connectTerminal(config.demoPhone) : await connectIMessage();
  console.log(`[meety] connected via ${transport.kind}`);

  const inbox = new Inbox<{ space: Space; phone: string }>(config.debounceMs, async (_key, texts, { space, phone }) => {
    // An empty entry is a voice note we couldn't transcribe.
    const said = texts.filter(Boolean);
    let out: string[];
    if (!said.length) out = copy.voiceFailed();
    else {
      try {
        out = await space.responding(() => flow.handle(phone, said.join("\n")));
      } catch (err) {
        console.error("[meety] flow failed", err);
        out = copy.error();
      }
    }
    await sendAll(space, out);
  });

  startHttp(config.port, config.secret, {
    async handoff(body) {
      const phone = normalizeHandle(body.phone);
      const out = await flow.start({ ...body, phone });
      try {
        await sendAll(await transport.openDm(phone), out);
        return { texted: true };
      } catch (err) {
        // Expected on Photon's Pro plan until the user has texted Meety once.
        flow.welcomeFailed(phone);
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[meety] couldn't text ${phone} first (${reason}); welcome will go out when they text in`);
        return { texted: false, reason };
      }
    },
    async notify(body) {
      const phone = normalizeHandle(body.phone);
      const out = await flow.preEvent(phone, body.eventId);
      if (out.length) await sendAll(await transport.openDm(phone), out);
    },
  });

  if (transport.kind === "terminal") {
    // Pretend the landing page just handed this user over.
    const out = await flow.start({ phone: config.demoPhone, name: config.demoName });
    await sendAll(await transport.openDm("chat-1"), out);
  }

  const shutdown = async () => {
    await transport.stop();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  for await (const [space, message] of transport.messages) {
    if (message.direction === "outbound") continue;
    const phone = transport.phoneOf(message);
    if (!phone) continue;
    console.log(`[meety] ${message.content.type} from ${message.sender?.id} in ${space.id}`);

    if (message.content.type === "text" && message.content.text.trim() === "/reset") {
      const user = await services.users.findByPhone(phone);
      if (user) {
        await sendAll(space, await flow.start(user));
        continue;
      }
    }

    // Don't block the stream on transcription.
    void toText(message, services)
      .then((text) => {
        if (text !== null) inbox.push(space.id, message.id, text, { space, phone });
      })
      .catch((err) => console.error("[meety] could not read message", err));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
