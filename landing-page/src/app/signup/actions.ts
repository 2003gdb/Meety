"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { SignupState } from "@/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) {
    return { error: "Enter a valid email address.", sentTo: null };
  }

  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) {
      console.error("signInWithOtp failed:", error.message);
      const message =
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "We couldn't send the link. Try again.";
      return { error: message, sentTo: null };
    }
  } catch (err) {
    console.error("sendMagicLink crashed:", err);
    return { error: "Something went wrong on our side. Try again.", sentTo: null };
  }

  return { error: null, sentTo: email };
}
