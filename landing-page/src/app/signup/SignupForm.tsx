"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton, TextField } from "@/components/form/fields";
import type { SignupState } from "@/types";
import { sendMagicLink } from "./actions";

const initialState: SignupState = { error: null, sentTo: null };

/** Remounts the form (clearing action state) when the user wants to change email. */
export default function SignupFlow({ initialError }: { initialError: string | null }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <SignupForm
      key={attempt}
      initialError={attempt === 0 ? initialError : null}
      onReset={() => setAttempt((n) => n + 1)}
    />
  );
}

function SignupForm({
  initialError,
  onReset,
}: {
  initialError: string | null;
  onReset: () => void;
}) {
  const [state, action, pending] = useActionState(sendMagicLink, initialState);

  if (state.sentTo) {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <p className="text-fg">
          We sent a sign-in link to{" "}
          <span className="font-medium">{state.sentTo}</span>. Open it in this
          browser to continue.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="self-start text-sm text-muted underline underline-offset-4 hover:text-fg"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@company.com"
        required
        disabled={pending}
      />
      <FormError message={state.error ?? initialError} />
      <SubmitButton pending={pending} pendingLabel="Sending link…">
        Email me a sign-in link
      </SubmitButton>
      <p className="text-sm text-muted">
        Meety looks up your public profiles and texts you on iMessage.
      </p>
    </form>
  );
}
