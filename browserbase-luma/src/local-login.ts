import { chromium, type Page } from "playwright-core";
import { client, connect, HOME_URL, LOGIN_URL, releaseSession, startSession, wait } from "./browserbase";
import { loggedIn } from "./extract";
import "./env";
import { readSession, writeSession } from "./store";

const stored = await readSession();
if (!stored?.contextId) {
  throw new Error("No Browserbase context yet. Run npm run connect first.");
}

const bb = client();
if (stored.loginSessionId) {
  await releaseSession(bb, stored.loginSessionId);
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
console.log("Chrome is open. Sign in with the email code there.");

await page.waitForURL((url) => !/\/(signin|sign-in|login)(\/|$)/.test(url.pathname), { timeout: 300_000 });
await page.waitForTimeout(1500);

const cookies = await context.cookies();
const localStorageItems = await readLocalStorage(page);
await browser.close();

const session = await startSession(bb, stored.contextId, {
  persist: true,
  keepAlive: false,
  timeoutSeconds: 120,
});
const remote = await connect(session.connectUrl);

try {
  await remote.page.context().addCookies(cookies);
  await remote.page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await writeLocalStorage(remote.page, localStorageItems);
  await remote.page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await remote.page.waitForTimeout(2000);
  if (!(await loggedIn(remote.page))) {
    throw new Error("The local login did not carry over. Sign in again with npm run login.");
  }
} finally {
  await remote.browser.close();
  await releaseSession(bb, session.id);
}

await wait(5000);
await writeSession({
  ...stored,
  loginSessionId: null,
  liveViewUrl: null,
  updatedAt: new Date().toISOString(),
});
console.log("Login saved. Run npm run pull");

async function readLocalStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) items[key] = localStorage.getItem(key) ?? "";
    }
    return items;
  });
}

async function writeLocalStorage(page: Page, items: Record<string, string>): Promise<void> {
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, items);
}
