import type { Page } from "playwright-core";

export type LumaEvent = {
  name: string;
  url: string;
};

export type LumaGuest = {
  name: string;
  profileUrl: string;
};

export type NextEvent = {
  name: string;
  url: string;
  guestListVisible: boolean;
  goingLabel: string | null;
  guests: LumaGuest[];
  note: string;
};

const SKIPPED_SLUGS = new Set([
  "signin",
  "sign-in",
  "login",
  "join",
  "register",
  "home",
  "discover",
  "pricing",
  "create",
  "settings",
  "calendar",
  "map",
  "help",
  "about",
  "user",
  "explore",
  "cities",
  "notifications",
  "profile",
  "ios",
  "android",
]);

export async function loggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (/\/(signin|sign-in|login)(\/|$|\?)/.test(url)) return false;
  const text = await page.locator("body").innerText().catch(() => "");
  if (/enter your email/i.test(text) && /verification code|continue with/i.test(text)) return false;
  return true;
}

export async function readEvents(page: Page): Promise<LumaEvent[]> {
  return page.evaluate((skipped) => {
    const skip = new Set(skipped);
    const seen = new Set<string>();
    const events: { name: string; url: string }[] = [];
    for (const anchor of document.querySelectorAll("a[href]")) {
      let url: URL;
      try {
        url = new URL((anchor as HTMLAnchorElement).href);
      } catch {
        continue;
      }
      if (!/^(luma\.com|www\.luma\.com|lu\.ma|www\.lu\.ma)$/.test(url.hostname)) continue;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1 || skip.has(parts[0].toLowerCase())) continue;
      const clean = `${url.origin}${url.pathname}`;
      if (seen.has(clean)) continue;
      seen.add(clean);
      const name = (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
      events.push({ name, url: clean });
    }
    return events;
  }, [...SKIPPED_SLUGS]);
}

export async function readNextEvent(page: Page, event: LumaEvent): Promise<NextEvent> {
  await page.goto(event.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  const opener = page.getByRole("button", { name: /see all|view all|guest list/i }).or(
    page.getByRole("link", { name: /see all|view all|guest list/i }),
  );
  if ((await opener.count()) > 0) {
    await opener.first().click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }

  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 900);
    const dialog = page.locator('[role="dialog"]');
    if ((await dialog.count()) > 0) {
      await dialog.first().evaluate((el) => el.scrollBy(0, 800)).catch(() => undefined);
    }
    await page.waitForTimeout(400);
  }

  const title = (await page.locator("h1").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const body = await page.locator("body").innerText().catch(() => "");
  const going = body.match(/(\d[\d,]*)\s+Going/i);
  const guests = await page.evaluate(() => {
    const seen = new Set<string>();
    const people: { name: string; profileUrl: string }[] = [];
    for (const anchor of document.querySelectorAll('a[href*="/user/"]')) {
      const profileUrl = (anchor as HTMLAnchorElement).href.split("?")[0];
      if (seen.has(profileUrl)) continue;
      seen.add(profileUrl);
      const name = (anchor.textContent || anchor.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      if (!name) continue;
      people.push({ name, profileUrl });
    }
    return people;
  });

  const hidden = /guest list is (hidden|private)|only visible to the host/i.test(body);
  const guestListVisible = guests.length > 0 && !hidden;

  let note = "Guest profiles were on the event page.";
  if (hidden) note = "The host hid the guest list.";
  else if (guests.length === 0) {
    note = "No guest profiles on the page. The host may have hidden the list, or this account is not marked Going.";
  }

  return {
    name: title || event.name,
    url: page.url(),
    guestListVisible,
    goingLabel: going ? going[0] : null,
    guests,
    note,
  };
}
