"use server";

import { redirect } from "next/navigation";
import { toE164, toLinkedInUrl, toXHandle } from "@/lib/profile-fields";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/types";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function saveProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fullName = field(formData, "full_name");
  const phone = toE164(field(formData, "phone"));
  const linkedInRaw = field(formData, "linkedin_url");
  const xRaw = field(formData, "x_handle");
  const linkedInUrl = linkedInRaw ? toLinkedInUrl(linkedInRaw) : null;
  const xHandle = xRaw ? toXHandle(xRaw) : null;

  if (!fullName) return { error: "Add your name." };
  if (!phone) return { error: "Enter a phone number, e.g. (415) 555-0123 or +44 20 7946 0958." };
  if (linkedInRaw && !linkedInUrl) return { error: "That LinkedIn link should look like linkedin.com/in/your-name." };
  if (xRaw && !xHandle) return { error: "That X handle doesn't look right." };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Sign in again." };

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      phone,
      linkedin_url: linkedInUrl,
      x_handle: xHandle,
      onboarded_at: new Date().toISOString(),
    });

    if (error) {
      console.error("profiles upsert failed:", error.code, error.message);
      if (error.code === "23505") {
        return { error: "That number is already linked to another account." };
      }
      return { error: "We couldn't save your details. Try again." };
    }
  } catch (err) {
    console.error("saveProfile crashed:", err);
    return { error: "Something went wrong on our side. Try again." };
  }

  redirect("/welcome");
}
