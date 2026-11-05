"use client";

import { savePart } from "@/app/actions";
import { CATEGORIES, MATERIALS } from "@/lib/constants";
import { formatSize } from "@/lib/format";
import type { Part, Vehicle } from "@/lib/parts";
import FitmentPicker from "./FitmentPicker";
import { useServerForm } from "./useServerForm";

type Props = { vehicles: Vehicle[]; part?: Part; selected?: number[] };

export default function PartForm({ vehicles, part, selected }: Props) {
  const { state, pending, onSubmit } = useServerForm(savePart);
  const editing = !!part;
  return (
    <form onSubmit={onSubmit} className="stack card">
      {part && <input type="hidden" name="id" value={part.id} />}
      <label>
        Title
        <input name="title" required minLength={3} maxLength={120} defaultValue={part?.title} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          maxLength={4000}
          placeholder="Print settings, supports, hardware needed…"
          defaultValue={part?.description}
        />
      </label>
      <div className="row">
        <label>
          Category
          <select name="category" required defaultValue={part?.category ?? ""}>
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
          <select name="material" defaultValue={part?.material ?? ""}>
            <option value="">Any</option>
            {MATERIALS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        {editing && part.file_name ? `Replace STL (current: ${part.file_name}, ${formatSize(part.file_size ?? 0)})` : "STL file (max 50 MB)"}
        <input type="file" name="file" accept=".stl" />
      </label>
      <label>
        Photo (JPG, PNG or WebP, max 5 MB)
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" />
        {part?.image_path && (
          <span className="check">
            <input type="checkbox" name="remove_image" /> Remove current photo
          </span>
        )}
      </label>
      <label>
        Link to original listing
        <input type="url" name="source_url" placeholder="https://www.printables.com/model/…" defaultValue={part?.source_url ?? ""} />
        <span className="hint">
          Required if you don&apos;t upload a file. If you uploaded someone else&apos;s design, link them.
        </span>
      </label>
      <label>
        Original creator (if not you)
        <input name="creator_name" maxLength={80} defaultValue={part?.creator_name ?? ""} />
      </label>

      <div>
        <strong>Which cars does it fit?</strong>
        <label className="check">
          <input type="checkbox" name="universal" defaultChecked={!!part?.universal} /> Universal (fits any car)
        </label>
        <FitmentPicker vehicles={vehicles} selected={selected} />
      </div>

      {state?.error && <p className="error">{state.error}</p>}
      <button disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Publish part"}</button>
    </form>
  );
}
