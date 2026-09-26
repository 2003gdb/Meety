const OPENER = "Hey Meety";

/** Meety's Photon iMessage line in E.164, or undefined if unset or malformed. */
export function getPhotonNumber(): string | undefined {
  const value = process.env.NEXT_PUBLIC_PHOTON_NUMBER?.replace(/[\s().-]/g, "");
  return value && /^\+[1-9]\d{6,14}$/.test(value) ? value : undefined;
}

/**
 * Opens Messages with the opener prefilled so the user sends the first text
 * (inbound-first, per Photon's deliverability guide). `&body=` is the form
 * iOS 8+ and macOS Messages parse.
 */
export function smsLink(number: string, body: string = OPENER): string {
  return `sms:${number}&body=${encodeURIComponent(body)}`;
}

/** +14155550123 -> +1 (415) 555-0123. Non-US numbers are returned unchanged. */
export function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `+1 (${us[1]}) ${us[2]}-${us[3]}` : e164;
}
