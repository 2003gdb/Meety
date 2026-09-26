import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import SignupFlow from "./SignupForm";

export const metadata: Metadata = { title: "Sign up · Meety" };

// Codes set by /auth/callback. Never render raw query text.
const ERRORS: Record<string, string> = {
  link: "That link expired or was opened in a different browser. Request a new one.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/onboarding");

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Sign up for Meety"
      lead="Enter your email and we'll send you a link. No password."
    >
      <SignupFlow initialError={(error && ERRORS[error]) || null} />
    </AuthShell>
  );
}
