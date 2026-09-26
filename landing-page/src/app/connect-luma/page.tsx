import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { LogoMark } from "@/components/brand/Logo";
import { lumaLoginViewUrl } from "@/lib/browserbase";

export const metadata: Metadata = {
  title: "Log into Luma · Meety",
  robots: { index: false },
};

// Browserbase session ids are UUIDs; anything else never reaches the API.
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opened from Meety's iMessage link: the user signs into Luma in a browser Meety can reuse. */
export default async function ConnectLumaPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const viewUrl = s && SESSION_ID.test(s) ? await lumaLoginViewUrl(s) : null;

  if (!viewUrl) {
    return (
      <AuthShell
        title="This link expired"
        lead="Luma sign-in links last 30 minutes. Text Meety anything and it will send you a new one."
      >
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          Back to Meety
        </Link>
      </AuthShell>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex shrink-0 flex-col gap-1 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
          <LogoMark className="size-6 text-accent" />
          Meety
        </Link>
        <p className="text-sm text-pretty text-muted">
          Sign into Luma with the code it emails you. When you see your Luma home, go back to
          iMessage and text Meety &quot;done&quot;.
        </p>
      </header>
      <iframe
        src={viewUrl}
        title="Luma sign-in"
        className="w-full flex-1 border-0"
        sandbox="allow-same-origin allow-scripts"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
