import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { client, connect, HOME_URL, releaseSession, startSession, wait } from "./browserbase";
import { loggedIn, readEvents, readNextEvent } from "./extract";
import { packageRoot } from "./env";
import "./env";
import { readSession, writeSession } from "./store";

const stored = await readSession();
if (!stored?.contextId) {
  throw new Error("No saved Luma login. Run npm run connect first.");
}

const bb = client();
if (stored.loginSessionId) {
  await releaseSession(bb, stored.loginSessionId);
  await wait(5000);
}

const session = await startSession(bb, stored.contextId, {
  persist: false,
  keepAlive: false,
  timeoutSeconds: 180,
});

const { browser, page } = await connect(session.connectUrl);

try {
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  const signedIn = await loggedIn(page);

  if (!signedIn) {
    const result = {
      loggedIn: false,
      events: [],
      nextEvent: null,
      note: "Luma is still on the sign-in page. Finish login in the live view, then run npm run pull again.",
    };
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else {
    const events = await readEvents(page);
    const nextEvent = events[0] ? await readNextEvent(page, events[0]) : null;
    const result = {
      loggedIn: true,
      events,
      nextEvent,
    };
    const outPath = path.join(packageRoot, "data", "luma-pull.json");
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await browser.close();
  await releaseSession(bb, session.id);
  await writeSession({
    ...stored,
    loginSessionId: null,
    liveViewUrl: null,
    updatedAt: new Date().toISOString(),
  });
}
