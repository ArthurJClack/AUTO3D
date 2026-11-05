// Pure helpers for importing vehicles from the NHTSA vPIC API (no I/O here).

/** Display name used in the app -> make name sent to NHTSA. */
export const IMPORT_MAKES = [
  "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Fiat",
  "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia", "Land Rover",
  "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "MINI", "Mitsubishi", "Nissan", "Pontiac", "Porsche",
  "Ram", "Saturn", "Scion", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo",
] as const;

/** Only passenger vehicles — skips motorcycles, ATVs, trailers, buses. */
export const VEHICLE_TYPES = ["car", "truck", "mpv"] as const;

export type Run = { start: number; end: number };

/** Collapse a set of years into inclusive runs of consecutive years. */
export function toRuns(years: Iterable<number>): Run[] {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const runs: Run[] = [];
  for (const y of sorted) {
    const last = runs[runs.length - 1];
    if (last && y === last.end + 1) last.end = y;
    else runs.push({ start: y, end: y });
  }
  return runs;
}

/** Lowercase letters/digits only, so "F-150", "f 150" and "F150" compare equal. */
export const normalizeModel = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A seeded model like "Golf / GTI" matches either name. */
export const modelAliases = (model: string) => model.split("/").map(normalizeModel).filter(Boolean);

export const runLabel = (r: Run) => (r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`);

/** NHTSA models come back in mixed styles; tidy whitespace and shouting-case ("CX-5" stays, "ACCORD" → "Accord"). */
export function cleanModelName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if (n !== n.toUpperCase() || n.length <= 3 || /[\d-]/.test(n)) return n;
  return n.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * NHTSA's truck data includes commercial chassis, bodies and wheelbase specs ("Motorhome Chassis",
 * `110" WB`, "Cab Over Engine HT") and combined trims ("750i, Alpina B7"). None are cars a hobbyist tags
 * a part to, so drop them.
 */
export function isConsumerModel(name: string): boolean {
  if (name.length < 2 || name.length > 40) return false;
  if (/["”“,]/.test(name) || name.startsWith("'")) return false;
  return !/\b(chassis|cab|cutaway|hearse|limo|motorhome|commercial|wb|gvwr|stripped)\b/i.test(name);
}
