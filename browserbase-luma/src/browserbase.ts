import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright-core";
import { projectId, requireApiKey } from "./env.ts";

const LOGIN_URL = "https://luma.com/signin";
const HOME_URL = "https://luma.com/home";

export { HOME_URL, LOGIN_URL };

export function client(): Browserbase {
  return new Browserbase({ apiKey: requireApiKey() });
}

export async function createContext(bb: Browserbase): Promise<string> {
  const context = await bb.contexts.create({
    name: `meety-luma-${Date.now()}`,
    projectId: projectId(),
  });
  return context.id;
}

export async function startSession(
  bb: Browserbase,
  contextId: string,
  options: { persist: boolean; keepAlive: boolean; timeoutSeconds: number; forLogin?: boolean },
) {
  return bb.sessions.create({
    projectId: projectId(),
    region: "us-west-2",
    keepAlive: options.keepAlive,
    api_timeout: options.timeoutSeconds,
    browserSettings: {
      context: { id: contextId, persist: options.persist },
      viewport: options.forLogin ? { width: 1280, height: 720 } : undefined,
      recordSession: options.forLogin ? false : undefined,
      logSession: options.forLogin ? false : undefined,
    },
  });
}

export function embedLiveViewUrl(raw: string): string {
  const parsed = new URL(raw);
  parsed.searchParams.delete("debug");
  parsed.searchParams.set("navbar", "false");
  return parsed.toString();
}

export async function liveViewUrl(bb: Browserbase, sessionId: string): Promise<string> {
  const debug = await bb.sessions.debug(sessionId);
  return embedLiveViewUrl(debug.pages[0]?.debuggerFullscreenUrl ?? debug.debuggerFullscreenUrl);
}

export async function releaseSession(bb: Browserbase, sessionId: string): Promise<void> {
  try {
    await bb.sessions.update(sessionId, {
      status: "REQUEST_RELEASE",
      projectId: projectId(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found|completed|timed out|released/i.test(message)) return;
    throw error;
  }
}

export async function connect(sessionConnectUrl: string): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.connectOverCDP(sessionConnectUrl);
  const context = browser.contexts()[0]!;
  const page = context.pages()[0] ?? (await context.newPage());
  return { browser, page };
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
