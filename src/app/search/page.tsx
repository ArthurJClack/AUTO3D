import Link from "next/link";
import PartCard from "@/components/PartCard";
import VehicleSelector from "@/components/VehicleSelector";
import { CATEGORIES, MATERIALS } from "@/lib/constants";
import { type Part, searchParts, SORTS, type Sort } from "@/lib/parts";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const inList = <T extends string>(list: readonly T[], v: string | undefined) => list.find((x) => x === v);

function Grid({ parts }: { parts: Part[] }) {
  return (
    <div className="grid">
      {parts.map((p) => (
        <PartCard key={p.id} part={p} />
      ))}
    </div>
  );
}

export default async function Search({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const make = one(sp.make);
  const model = one(sp.model);
  const yearRaw = one(sp.year);
  const year = yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : undefined;
  const q = one(sp.q);
  const category = inList(CATEGORIES, one(sp.category));
  const material = inList(MATERIALS, one(sp.material));
  const sort = (Object.keys(SORTS) as Sort[]).find((k) => k === one(sp.sort));
  const pageRaw = Number(one(sp.page));

  const res = searchParts({ make, model, year, q, category, material, sort, page: pageRaw });
  const label = [year, make, model].filter(Boolean).join(" ");

  const pageHref = (page: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ make, model, year: yearRaw, q, category, material, sort })) if (v) u.set(k, v);
    u.set("page", String(page));
    return `/search?${u}`;
  };

  return (
    <>
      <h1>{res.filtered ? `Parts for ${label}` : "Browse all parts"}</h1>
      <form className="finder">
        <VehicleSelector initial={{ make, model, year: yearRaw }} />
        <input type="search" name="q" placeholder="Search keywords" defaultValue={q} />
        <select name="category" defaultValue={category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="material" defaultValue={material ?? ""} aria-label="Material">
          <option value="">Any material</option>
          {MATERIALS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort ?? "best"} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button>Search</button>
      </form>

      <h2>{res.filtered ? `Fits your car (${res.total})` : `Parts (${res.total})`}</h2>
      {res.main.length === 0 ? (
        <p className="muted">{res.filtered ? "No parts tagged for this vehicle yet." : "No parts found."}</p>
      ) : (
        <Grid parts={res.main} />
      )}
      {res.pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {res.page > 1 ? <Link href={pageHref(res.page - 1)}>← Previous</Link> : <span className="off">← Previous</span>}
          <span className="muted">
            Page {res.page} of {res.pages}
          </span>
          {res.page < res.pages ? <Link href={pageHref(res.page + 1)}>Next →</Link> : <span className="off">Next →</span>}
        </nav>
      )}

      {res.mightFit.length > 0 && (
        <>
          <h2>Might fit — other years of the {model} ({res.mightFit.length})</h2>
          <p className="muted">Made for a different generation. Check the part page before you print.</p>
          <Grid parts={res.mightFit} />
        </>
      )}
      {res.universal.length > 0 && (
        <>
          <h2>Universal parts ({res.universal.length})</h2>
          <Grid parts={res.universal} />
        </>
      )}
    </>
  );
}
