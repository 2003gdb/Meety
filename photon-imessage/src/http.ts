// Internal HTTP endpoints the other lanes call to make Meety text someone first.
//   POST /handoff  { phone, name?, email?, linkedinUrl?, xUrl? }  landing page, right after sign-up
//   POST /notify   { phone, eventId? }                              pre-event trigger (~24h before)
//   GET  /health

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";

const Handoff = z.object({
  phone: z.string().min(3),
  name: z.string().optional(),
  email: z.string().optional(),
  linkedinUrl: z.string().optional(),
  xUrl: z.string().optional(),
});
const Notify = z.object({ phone: z.string().min(3), eventId: z.string().optional() });

export type HandoffBody = z.infer<typeof Handoff>;
export type NotifyBody = z.infer<typeof Notify>;

export interface HttpHandlers {
  handoff(body: HandoffBody): Promise<void>;
  notify(body: NotifyBody): Promise<void>;
}

export function startHttp(port: number, secret: string | undefined, handlers: HttpHandlers) {
  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
      if (req.method !== "POST") return send(res, 404, { error: "not found" });
      if (secret && req.headers["x-meety-secret"] !== secret) return send(res, 401, { error: "unauthorized" });

      const body = await readJson(req);
      if (req.url === "/handoff") {
        const parsed = Handoff.safeParse(body);
        if (!parsed.success) return send(res, 400, { error: parsed.error.issues });
        await handlers.handoff(parsed.data);
        return send(res, 202, { ok: true });
      }
      if (req.url === "/notify") {
        const parsed = Notify.safeParse(body);
        if (!parsed.success) return send(res, 400, { error: parsed.error.issues });
        await handlers.notify(parsed.data);
        return send(res, 202, { ok: true });
      }
      return send(res, 404, { error: "not found" });
    } catch (err) {
      console.error("[http]", err);
      return send(res, 500, { error: "internal error" });
    }
  });
  server.listen(port, () => console.log(`[http] listening on :${port}`));
  return server;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}
