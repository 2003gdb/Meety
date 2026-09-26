import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: trade the code for a session, then route to the next step. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const failed = NextResponse.redirect(`${origin}/signup?error=link`);

  if (!code) {
    console.error("auth callback without code:", searchParams.get("error_description"));
    return failed;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("exchangeCodeForSession failed:", error?.message);
    return failed;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", data.user.id)
    .maybeSingle();

  const next = profile?.phone ? "/welcome" : "/onboarding";
  return NextResponse.redirect(`${origin}${next}`);
}
