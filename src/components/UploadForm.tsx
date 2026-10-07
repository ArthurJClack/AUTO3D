"use client";

import { uploadPart } from "@/app/actions";
import { CATEGORIES, MATERIALS } from "@/lib/constants";
import type { Vehicle } from "@/lib/parts";
import FitmentPicker from "./FitmentPicker";
import { useServerForm } from "./useServerForm";

export default function UploadForm({ vehicles }: { vehicles: Vehicle[] }) {
  const { state, pending, onSubmit } = useServerForm(uploadPart);
  return (
    <form onSubmit={onSubmit} className="stack card">
      <label>
        Title
        <input name="title" required minLength={3} maxLength={120} />
      </label>
      <label>
        Description
        <textarea name="description" maxLength={4000} placeholder="Print settings, supports, hardware needed…" />
      </label>
      <div className="row">
        <label>
          Category
          <select name="category" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Material
          <select name="material" defaultValue="">
            <option value="">Any</option>
            {MATERIALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        STL file (max 50 MB)
        <input type="file" name="file" accept=".stl" />
      </label>
      <label>
        Link to original listing
        <input type="url" name="source_url" placeholder="https://www.printables.com/model/…" />
        <span className="hint">Required if you don&apos;t upload a file. If you uploaded someone else&apos;s design, link them.</span>
      </label>
      <label>
        Original creator (if not you)
        <input name="creator_name" maxLength={80} />
      </label>

      <div>
        <strong>Which cars does it fit?</strong>
        <label className="check">
          <input type="checkbox" name="universal" /> Universal (fits any car)
        </label>
        <FitmentPicker vehicles={vehicles} />
      </div>

      {state?.error && <p className="error">{state.error}</p>}
      <button disabled={pending}>{pending ? "Uploading…" : "Publish part"}</button>
    </form>
  );
}
