"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { FormState } from "@/app/actions";

/**
 * Submits a form to a server action without React's automatic form reset,
 * so inputs (including the chosen file) survive a validation error.
 */
export function useServerForm(action: (s: FormState, fd: FormData) => Promise<FormState>) {
  const [state, setState] = useState<FormState>();
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setState(await action(undefined, fd)));
  };
  return { state, pending, onSubmit };
}
