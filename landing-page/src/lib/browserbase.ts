import "server-only";

// The live view of a Browserbase login session the iMessage bot opened on Luma's
// sign-in page (photon-imessage/src/luma.ts). Same embed as browserbase-luma.

interface SessionDebug {
  debuggerFullscreenUrl?: string;
  pages?: { debuggerFullscreenUrl?: string }[];
}

/** Embeddable live view URL, or null when the session ended or doesn't exist. */
export async function lumaLoginViewUrl(sessionId: string): Promise<string | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    console.error("BROWSERBASE_API_KEY is missing");
    return null;
  }
  try {
    const res = await fetch(`https://api.browserbase.com/v1/sessions/${encodeURIComponent(sessionId)}/debug`, {
      headers: { "X-BB-API-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const debug = (await res.json()) as SessionDebug;
    const raw = debug.pages?.[0]?.debuggerFullscreenUrl ?? debug.debuggerFullscreenUrl;
    if (!raw) return null;
    const url = new URL(raw);
    url.searchParams.delete("debug");
    url.searchParams.set("navbar", "false");
    return url.toString();
  } catch (err) {
    console.error("Browserbase live view lookup failed:", err);
    return null;
  }
}
