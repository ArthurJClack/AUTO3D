"use client";

import { useState } from "react";
import { vehicleLabel } from "@/lib/format";
import type { Vehicle } from "@/lib/parts";

export default function FitmentPicker({
  vehicles,
  selected = [],
}: {
  vehicles: Vehicle[];
  selected?: number[];
}) {
  const [filter, setFilter] = useState("");
  const f = filter.toLowerCase();
  const chosen = new Set(selected);
  // Filtering only hides rows, so checked boxes keep their state and still submit.
  return (
    <div>
      <input type="search" placeholder="Filter vehicles…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="picker">
        {vehicles.map((v) => {
          const label = vehicleLabel(v);
          return (
            <label
              key={v.id}
              className="check"
              hidden={!!f && !label.toLowerCase().includes(f)}
            >
              <input type="checkbox" name="vehicle" value={v.id} defaultChecked={chosen.has(v.id)} />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
