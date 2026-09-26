"use client";

import { useActionState } from "react";
import { FormError, SubmitButton, TextField } from "@/components/form/fields";
import type { ActionState } from "@/types";
import { saveProfile } from "./actions";

const initialState: ActionState = { error: null };

export default function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(saveProfile, initialState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <TextField
        label="Name"
        name="full_name"
        autoComplete="name"
        defaultValue={defaultName}
        required
        disabled={pending}
      />
      <TextField
        label="Phone"
        hint="· the one you use for iMessage"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="(415) 555-0123"
        required
        disabled={pending}
      />
      <TextField
        label="LinkedIn"
        hint="· optional"
        name="linkedin_url"
        autoComplete="url"
        placeholder="linkedin.com/in/your-name"
        disabled={pending}
      />
      <TextField
        label="X"
        hint="· optional"
        name="x_handle"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="@handle"
        disabled={pending}
      />
      <FormError message={state.error} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Continue
      </SubmitButton>
    </form>
  );
}
