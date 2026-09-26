import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";

/** Frame for /signup, /onboarding and /welcome: same header as the hero, narrow centered column. */
export function AuthShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-16 shrink-0 items-center">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm text-[17px] font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <LogoMark className="size-6 text-accent" />
          Meety
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 pb-24">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance">
            {title}
          </h1>
          {lead && <p className="leading-relaxed text-pretty text-muted">{lead}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
