"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="card space-y-5 p-7">
      {state?.error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">{state.error}</p>}
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" defaultValue={state?.email} key={state?.email ?? "e"} />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <SubmitButton className="btn btn-primary w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
