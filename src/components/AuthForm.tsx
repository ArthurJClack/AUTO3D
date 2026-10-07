"use client";

import { useServerForm } from "./useServerForm";
import type { FormState } from "@/app/actions";

export default function AuthForm({
  action,
  submitLabel,
  newPassword,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  newPassword?: boolean;
}) {
  const { state, pending, onSubmit } = useServerForm(action);
  return (
    <form onSubmit={onSubmit} className="stack card narrow">
      <label>
        Username
        <input name="username" required autoComplete="username" />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={newPassword ? 8 : undefined}
          autoComplete={newPassword ? "new-password" : "current-password"}
        />
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      <button disabled={pending}>{pending ? "Working…" : submitLabel}</button>
    </form>
  );
}
