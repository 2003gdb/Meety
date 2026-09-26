import Link from "next/link";
import { IMessageDemo } from "./IMessageDemo";

export function Hero() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-16 shrink-0 items-center">
        <span className="text-[17px] font-semibold tracking-tight">Meety</span>
      </header>

      <section className="grid flex-1 items-center gap-12 pt-6 pb-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 lg:pt-0 lg:pb-10">
        <div className="max-w-xl">
          <h1 className="text-[40px] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[64px]">
            Know who to find before you walk in.
          </h1>
          <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-pretty text-muted">
            The day before your Luma event, Meety asks what you want out of it and texts you who to
            meet.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-6 text-[15px] font-semibold text-accent-fg transition-[transform,filter] duration-150 ease-out hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97]"
          >
            Try Meety
          </Link>
        </div>

        <IMessageDemo />
      </section>
    </main>
  );
}
