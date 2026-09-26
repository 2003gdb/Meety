import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only routes that read the session. The landing page stays static.
  matcher: ["/signup", "/onboarding", "/welcome", "/auth/:path*"],
};
