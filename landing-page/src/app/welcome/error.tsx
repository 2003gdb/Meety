"use client";

import { useEffect } from "react";
import { AuthShell } from "@/components/AuthShell";

export default function WelcomeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AuthShell
      title="We couldn't load your account."
      lead="This is usually temporary. Try again in a moment."
    >
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-12 items-center justify-center rounded-full border border-border px-6 text-[15px] font-semibold text-fg transition-[transform,background-color] duration-150 ease-out hover:bg-surface active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Try again
      </button>
    </AuthShell>
  );
}
