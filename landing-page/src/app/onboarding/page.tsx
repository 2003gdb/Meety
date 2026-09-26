import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export const metadata: Metadata = { title: "Your details · Meety" };

// saveProfile's background Tavily research can take ~90s when the LLM is slow.
export const maxDuration = 120;

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  if (profile?.phone) redirect("/welcome");

  return (
    <AuthShell
      title="Where should Meety text you?"
      lead="Your number is how Meety recognizes you on iMessage. LinkedIn and X help it find the right people for you."
    >
      <OnboardingForm defaultName={profile?.full_name ?? ""} />
    </AuthShell>
  );
}
