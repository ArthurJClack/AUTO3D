export type VehicleLike = { make: string; model: string; generation: string; year_start: number; year_end: number };

export const yearRange = (v: Pick<VehicleLike, "year_start" | "year_end">) =>
  v.year_start === v.year_end ? `${v.year_start}` : `${v.year_start}–${v.year_end}`;

/** "Honda Civic — 10th gen (2016–2021)"; imported rows whose generation is just the years show "Honda Civic (2014–2019)". */
export function vehicleLabel(v: VehicleLike): string {
  const range = yearRange(v);
  return v.generation === range ? `${v.make} ${v.model} (${range})` : `${v.make} ${v.model} — ${v.generation} (${range})`;
}

export const formatSize = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
