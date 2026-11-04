"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn btn-primary", pendingText, confirm, name, value, formAction }: {
  children: React.ReactNode; className?: string; pendingText?: string; confirm?: string; name?: string; value?: string; formAction?: (fd: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      name={name}
      value={value}
      formAction={formAction}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {pending ? <><span className="spinner" aria-hidden="true" />{pendingText ?? "Saving…"}</> : children}
    </button>
  );
}
