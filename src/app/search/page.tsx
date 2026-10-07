import PartCard from "@/components/PartCard";
import VehicleSelector from "@/components/VehicleSelector";
import { CATEGORIES } from "@/lib/constants";
import { searchParts } from "@/lib/parts";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function Search({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const make = one(sp.make);
  const model = one(sp.model);
  const yearRaw = one(sp.year);
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;
  const q = one(sp.q);
  const category = one(sp.category);
  const { fits, universal, filtered } = searchParts({ make, model, year, q, category });
  const label = [year, make, model].filter(Boolean).join(" ");

  return (
    <>
      <h1>{filtered ? `Parts for ${label}` : "Browse all parts"}</h1>
      <form className="finder">
        <VehicleSelector initial={{ make, model, year: yearRaw }} />
        <input type="search" name="q" placeholder="Search keywords" defaultValue={q} />
        <select name="category" defaultValue={category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button>Search</button>
      </form>

      <h2>{filtered ? `Fits your car (${fits.length})` : `Parts (${fits.length})`}</h2>
      {fits.length === 0 ? (
        <p className="muted">{filtered ? "No parts tagged for this vehicle yet." : "No parts found."}</p>
      ) : (
        <div className="grid">
          {fits.map((p) => (
            <PartCard key={p.id} part={p} />
          ))}
        </div>
      )}

      {filtered && universal.length > 0 && (
        <>
          <h2>Universal parts ({universal.length})</h2>
          <div className="grid">
            {universal.map((p) => (
              <PartCard key={p.id} part={p} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
