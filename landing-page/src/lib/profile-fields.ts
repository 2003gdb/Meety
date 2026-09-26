/**
 * Normalizers for onboarding input. Each returns the stored value,
 * or null when the input is invalid.
 */

/** "(415) 555-0123" -> "+14155550123". Numbers without "+" are read as US. */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** "linkedin.com/in/jane" -> "https://www.linkedin.com/in/jane". */
export function toLinkedInUrl(input: string): string | null {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withScheme);
    const isLinkedIn = /(^|\.)linkedin\.com$/i.test(url.hostname);
    const slug = /^\/in\/([^/]+)/.exec(url.pathname)?.[1];
    return isLinkedIn && slug ? `https://www.linkedin.com/in/${slug}` : null;
  } catch {
    return null;
  }
}

/** "@jane", "x.com/jane" or "jane" -> "jane". */
export function toXHandle(input: string): string | null {
  const handle = input
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null;
}
