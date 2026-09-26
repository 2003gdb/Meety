// People text in bursts ("hey" / "wait" / "actually who's Priya"). Following
// Photon's inbound-pipeline guidance, we wait for a burst to settle and answer
// it as one turn, and we never run two turns for the same chat at once.
// Messages stay in the buffer until the handler drains them, so nothing is
// lost if a burst lands while a reply is still being generated.

type TurnHandler<C> = (key: string, texts: string[], ctx: C) => Promise<void>;

interface Chat<C> {
  buffer: string[];
  ctx: C;
  timer?: NodeJS.Timeout;
  running: Promise<void>;
}

export class Inbox<C> {
  private chats = new Map<string, Chat<C>>();
  private seen = new Set<string>();

  constructor(
    private debounceMs: number,
    private onTurn: TurnHandler<C>,
  ) {}

  /** Returns false for a duplicate delivery (Photon is at-least-once). */
  push(key: string, messageId: string, text: string, ctx: C): boolean {
    if (this.seen.has(messageId)) return false;
    this.seen.add(messageId);
    if (this.seen.size > 5000) this.seen.delete(this.seen.values().next().value!);

    let chat = this.chats.get(key);
    if (!chat) {
      chat = { buffer: [], ctx, running: Promise.resolve() };
      this.chats.set(key, chat);
    }
    chat.buffer.push(text);
    chat.ctx = ctx;
    clearTimeout(chat.timer);
    chat.timer = setTimeout(() => this.flush(key), this.debounceMs);
    return true;
  }

  private flush(key: string) {
    const chat = this.chats.get(key)!;
    chat.running = chat.running.then(async () => {
      const texts = chat.buffer.splice(0);
      if (!texts.length) return;
      try {
        await this.onTurn(key, texts, chat.ctx);
      } catch (err) {
        console.error(`[inbox] turn failed for ${key}`, err);
      }
    });
  }

  /** Wait for everything queued so far (tests, shutdown). */
  async drain() {
    for (const [key, chat] of this.chats) {
      if (chat.timer) {
        clearTimeout(chat.timer);
        chat.timer = undefined;
        this.flush(key);
      }
    }
    await Promise.all([...this.chats.values()].map((c) => c.running));
  }
}
