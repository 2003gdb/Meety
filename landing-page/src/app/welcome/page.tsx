import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { primaryButtonClass } from "@/components/form/fields";
import { createClient } from "@/lib/supabase/server";
import { formatPhone, getPhotonNumber, smsLink } from "@/lib/photon";
import { registerWithPhoton } from "@/lib/photon-users";
import type { Profile } from "@/types";

export const metadata: Metadata = { title: "Welcome to Meety" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data, error } = await supabase
    .from("profiles")
    .select("phone, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load profile: ${error.message}`);

  const profile: Pick<Profile, "phone" | "full_name"> | null = data;
  if (!profile?.phone) redirect("/onboarding");

  const firstName = profile.full_name?.trim().split(/\s+/)[0];
  // Photon only delivers texts from registered phones, each on its own pooled line.
  const assignedLine = await registerWithPhoton({
    phone: profile.phone,
    fullName: profile.full_name,
    email: user.email ?? null,
  });
  const meetyNumber = assignedLine ?? getPhotonNumber();
  if (!meetyNumber) console.error("NEXT_PUBLIC_PHOTON_NUMBER is missing or not E.164");

  return (
    <AuthShell
      title={firstName ? `You're in, ${firstName}.` : "You're in."}
      lead="Meety works over iMessage. Send the first text and it will start looking for people worth meeting at your next event."
    >
      {meetyNumber ? (
        <div className="flex flex-col gap-4">
          <a href={smsLink(meetyNumber)} className={primaryButtonClass}>
            Text Meety
          </a>
          <p className="text-sm text-muted">
            Or text{" "}
            <span className="font-medium text-fg select-all">
              {formatPhone(meetyNumber)}
            </span>
            . Send it from {formatPhone(profile.phone)} so Meety knows it&apos;s
            you.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Meety&apos;s number isn&apos;t available right now. Check back in a
          few minutes.
        </p>
      )}
    </AuthShell>
  );
}
