import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { client, connect, createContext, liveViewUrl, LOGIN_URL, releaseSession, startSession } from "./browserbase";
import { packageRoot } from "./env";
import "./env";
import { readSession, writeSession } from "./store";

const bb = client();
const existing = await readSession();

if (existing?.loginSessionId) {
  await releaseSession(bb, existing.loginSessionId);
}

const contextId = existing?.contextId ?? (await createContext(bb));
const session = await startSession(bb, contextId, {
  persist: true,
  keepAlive: true,
  timeoutSeconds: 1800,
  forLogin: true,
});

const { browser, page } = await connect(session.connectUrl);
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
await browser.close();

const url = await liveViewUrl(bb, session.id);
await writeSession({
  contextId,
  loginSessionId: session.id,
  liveViewUrl: url,
  updatedAt: new Date().toISOString(),
});

const livePath = path.join(packageRoot, "data", "index.html");
await mkdir(path.dirname(livePath), { recursive: true });
await writeFile(
  livePath,
  `<!doctype html>
<meta charset="utf-8">
<title>Luma sign in</title>
<style>
  html, body { margin: 0; height: 100%; background: #111; }
  iframe { border: 0; width: 100%; height: 100%; }
</style>
<iframe
  src="${url.replaceAll("&", "&amp;")}"
  sandbox="allow-same-origin allow-scripts"
  allow="clipboard-read; clipboard-write"
></iframe>
`,
);

console.log("Open http://127.0.0.1:8787");
console.log("Log in with the email code in that browser. Then run: npm run pull");
