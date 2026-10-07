"use client";

import { useState } from "react";
import type { Vehicle } from "@/lib/parts";

export default function FitmentPicker({ vehicles }: { vehicles: Vehicle[] }) {
  const [filter, setFilter] = useState("");
  const f = filter.toLowerCase();
  const shown = vehicles.filter((v) => `${v.make} ${v.model} ${v.generation}`.toLowerCase().includes(f));
  return (
    <div>
      <input
        type="search"
        placeholder="Filter vehicles…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="picker">
        {shown.map((v) => (
          <label key={v.id} className="check">
            <input type="checkbox" name="vehicle" value={v.id} />
            {v.make} {v.model} — {v.generation} ({v.year_start}–{v.year_end})
          </label>
        ))}
        {shown.length === 0 && <p className="muted">No match.</p>}
      </div>
    </div>
  );
}
