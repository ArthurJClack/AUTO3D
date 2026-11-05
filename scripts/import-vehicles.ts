// Import makes/models/years from the free NHTSA vPIC API into the vehicles table.
//
//   npm run import:vehicles                 # all makes, 1990..next year
//   npm run import:vehicles -- Honda Toyota # only these makes
//   FROM_YEAR=2000 npm run import:vehicles
//
// NHTSA has no "generation" data, so consecutive model years become one row labelled by its
// year range (e.g. "2014–2019"). Hand-curated seed rows (e.g. "10th gen") are never changed; for
// a model that is in the seed, only the years the seed doesn't already cover are imported.
import { getDb } from "../src/lib/db.ts";
import {
  cleanModelName, IMPORT_MAKES, isConsumerModel, modelAliases, normalizeModel, runLabel, toRuns, VEHICLE_TYPES,
} from "../src/lib/nhtsa.ts";

const API = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear";
const fromYear = Number(process.env.FROM_YEAR ?? 1990);
const toYear = new Date().getFullYear() + 1;
const CONCURRENCY = 8;

const wanted = process.argv.slice(2).map((a) => a.toLowerCase());
const makes = IMPORT_MAKES.filter((m) => !wanted.length || wanted.includes(m.toLowerCase()));
if (!makes.length) {
  console.error(`No matching makes. Known: ${IMPORT_MAKES.join(", ")}`);
  process.exit(1);
}

async function fetchModels(make: string, year: number, type: string): Promise<string[]> {
  const url = `${API}/make/${encodeURIComponent(make)}/modelyear/${year}/vehicletype/${type}?format=json`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { Results: { Model_Name: string }[] };
      return data.Results.map((r) => r.Model_Name);
    } catch (e) {
      if (attempt >= 4) throw new Error(`${make} ${year} ${type}: ${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function pool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) await worker(items[i++]);
    }),
  );
}

const db = getDb();
// make -> normalized model alias -> { seeded model name, years the seed already covers }
const seeded = new Map<string, Map<string, { model: string; years: Set<number> }>>();
for (const r of db.prepare("SELECT make, model, year_start, year_end FROM vehicles WHERE source = 'seed'").all() as {
  make: string; model: string; year_start: number; year_end: number;
}[]) {
  const byAlias = seeded.get(r.make) ?? seeded.set(r.make, new Map()).get(r.make)!;
  for (const alias of modelAliases(r.model)) {
    const entry = byAlias.get(alias) ?? { model: r.model, years: new Set<number>() };
    for (let y = r.year_start; y <= r.year_end; y++) entry.years.add(y);
    byAlias.set(alias, entry);
  }
}

const insert = db.prepare(
  "INSERT OR IGNORE INTO vehicles (make, model, generation, year_start, year_end, source) VALUES (?,?,?,?,?, 'nhtsa')",
);
const update = db.prepare("UPDATE vehicles SET generation = ?, year_start = ?, year_end = ? WHERE id = ?");
const existingStmt = db.prepare(
  "SELECT id, year_start, year_end FROM vehicles WHERE make = ? AND model = ? AND source = 'nhtsa'",
);

let added = 0;
let extended = 0;
let skipped = 0;

for (const make of makes) {
  const tasks: { year: number; type: string }[] = [];
  for (let y = fromYear; y <= toYear; y++) for (const type of VEHICLE_TYPES) tasks.push({ year: y, type });

  // model display name -> set of years it was sold
  const yearsByModel = new Map<string, Set<number>>();
  await pool(tasks, async ({ year, type }) => {
    for (const raw of await fetchModels(make, year, type)) {
      const name = cleanModelName(raw);
      if (!isConsumerModel(name)) continue;
      (yearsByModel.get(name) ?? yearsByModel.set(name, new Set()).get(name)!).add(year);
    }
  });

  const seededModels = seeded.get(make);
  db.exec("BEGIN");
  for (const [importedName, allYears] of yearsByModel) {
    let model = importedName;
    let years = allYears;
    const match = seededModels?.get(normalizeModel(importedName));
    if (match) {
      model = match.model; // keep the seeded spelling so the dropdown shows one entry
      years = new Set([...allYears].filter((y) => !match.years.has(y)));
      if (years.size === 0) {
        skipped++;
        continue;
      }
    }
    const existing = existingStmt.all(make, model) as { id: number; year_start: number; year_end: number }[];
    for (const run of toRuns(years)) {
      // A rerun can extend a range we imported earlier; update it instead of adding an overlapping row.
      const overlap = existing.find((e) => e.year_start <= run.end + 1 && run.start <= e.year_end + 1);
      if (overlap) {
        const merged = { start: Math.min(run.start, overlap.year_start), end: Math.max(run.end, overlap.year_end) };
        if (merged.start !== overlap.year_start || merged.end !== overlap.year_end) {
          update.run(runLabel(merged), merged.start, merged.end, overlap.id);
          overlap.year_start = merged.start;
          overlap.year_end = merged.end;
          extended++;
        }
      } else if (Number(insert.run(make, model, runLabel(run), run.start, run.end).changes)) {
        added++;
      }
    }
  }
  db.exec("COMMIT");
  console.log(`${make}: ${yearsByModel.size} models seen`);
}

const { n } = db.prepare("SELECT COUNT(*) AS n FROM vehicles").get() as { n: number };
console.log(`\nDone. Added ${added}, extended ${extended}, ${skipped} seeded models were already fully covered. ${n} vehicle rows total.`);
