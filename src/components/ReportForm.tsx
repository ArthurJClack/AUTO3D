"use client";

import { reportPart } from "@/app/actions";
import { useServerForm } from "./useServerForm";

export default function ReportForm({ partId }: { partId: number }) {
  const { state, pending, onSubmit } = useServerForm(reportPart);
  return (
    <details className="card">
      <summary>Report this part</summary>
      <form onSubmit={onSubmit} className="stack" style={{ marginTop: 12 }}>
        <input type="hidden" name="part_id" value={partId} />
        <label>
          What&apos;s wrong? (wrong fitment, copyright, spam…)
          <textarea name="reason" required minLength={5} maxLength={500} />
        </label>
        {state?.error && <p className="error">{state.error}</p>}
        {state?.ok && <p className="muted">{state.ok}</p>}
        <button disabled={pending}>Send report</button>
      </form>
    </details>
  );
}
