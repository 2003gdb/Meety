import type { InputHTMLAttributes, ReactNode } from "react";

/** Same primary button as the hero's "Try Meety". */
export const primaryButtonClass =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-semibold text-accent-fg transition-[transform,filter,opacity] duration-150 ease-out hover:brightness-110 active:scale-[0.97] disabled:cursor-progress disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
};

export function TextField({ label, name, hint, ...input }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg">
        {label}
        {hint && <span className="font-normal text-muted"> {hint}</span>}
      </span>
      <input
        name={name}
        className="h-12 rounded-full border border-border bg-surface px-5 text-fg placeholder:text-muted outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-60"
        {...input}
      />
    </label>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={primaryButtonClass}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}
