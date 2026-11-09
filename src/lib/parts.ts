import { getDb } from "./db.ts";

// node:sqlite rows have a null prototype; React can't pass those to client components.
const plain = <T>(rows: unknown[]): T[] => rows.map((r) => ({ ...(r as object) }) as T);
const plainOne = <T>(row: unknown): T | undefined => (row ? ({ ...(row as object) } as T) : undefined);

export type Part = {
  id: number;
  user_id: number;
  image_path: string | null;
  title: string;
  description: string;
  category: string;
  material: string;
  universal: number;
  file_name: string | null;
  file_size: number | null;
  source_url: string | null;
  creator_name: string | null;
  created_at: string;
  username: string;
  /** "Fits my car" confirmations / "doesn't fit" reports (for the searched car when filtering, else overall). */
  up: number;
  down: number;
};

export type Vehicle = {
  id: number;
  make: string;
  model: string;
  generation: string;
  year_start: number;
  year_end: number;
};

export const SORTS = { best: "Best match", newest: "Newest", title: "A–Z" } as const;
export type Sort = keyof typeof SORTS;

export type SearchParams = {
  make?: string;
  model?: string;
  year?: number;
  q?: string;
  category?: string;
  material?: string;
  sort?: Sort;
  page?: number;
};

export type SearchResult = {
  /** Parts tagged for the chosen car (or every part when no car is chosen), one page of them. */
  main: Part[];
  total: number;
  page: number;
  pages: number;
  /** Same make+model but a different generation/year range than the chosen year. */
  mightFit: Part[];
  universal: Part[];
  filtered: boolean;
};

export const PAGE_SIZE = 12;
const SECONDARY_LIMIT = 24;

const PART_COLS = `p.id, p.user_id, p.image_path, p.title, p.description, p.category, p.material, p.universal,
  p.file_name, p.file_size, p.source_url, p.creator_name, p.created_at, u.username`;

/** Vote counts over a set of vehicles (`vehicleClause` is an extra `AND ...` on fv, or empty for all). */
const votes = (vehicleClause: string) =>
  `(SELECT COUNT(*) FROM fit_votes fv WHERE fv.part_id = p.id AND fv.works = 1${vehicleClause}) AS up,
   (SELECT COUNT(*) FROM fit_votes fv WHERE fv.part_id = p.id AND fv.works = 0${vehicleClause}) AS down`;
const PART_COLS_ALL = `${PART_COLS}, ${votes("")}`;

export function listMakes(): string[] {
  const rows = getDb().prepare("SELECT DISTINCT make FROM vehicles ORDER BY make").all();
  return rows.map((r) => r.make as string);
}

export function listModels(make: string): string[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT model FROM vehicles WHERE make = ? ORDER BY model")
    .all(make);
  return rows.map((r) => r.model as string);
}

export function listYears(make: string, model: string): number[] {
  const rows = getDb()
    .prepare("SELECT year_start, year_end FROM vehicles WHERE make = ? AND model = ?")
    .all(make, model) as { year_start: number; year_end: number }[];
  const years = new Set<number>();
  for (const r of rows) for (let y = r.year_start; y <= r.year_end; y++) years.add(y);
  return [...years].sort((a, b) => b - a);
}

export function listGenerations(): Vehicle[] {
  return plain<Vehicle>(
    getDb().prepare("SELECT * FROM vehicles ORDER BY make, model, year_start").all(),
  );
}

export function searchParts(s: SearchParams): SearchResult {
  const db = getDb();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (s.q) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    const like = `%${s.q.replace(/[\\%_]/g, "\\$&")}%`;
    args.push(like, like);
  }
  if (s.category) {
    where.push("p.category = ?");
    args.push(s.category);
  }
  if (s.material) {
    where.push("p.material = ?");
    args.push(s.material);
  }
  const extra = where.length ? ` AND ${where.join(" AND ")}` : "";

  const vf: string[] = [];
  const vArgs: (string | number)[] = [];
  if (s.make) {
    vf.push("v.make = ?");
    vArgs.push(s.make);
  }
  if (s.model) {
    vf.push("v.model = ?");
    vArgs.push(s.model);
  }
  if (s.year) {
    vf.push("? BETWEEN v.year_start AND v.year_end");
    vArgs.push(s.year);
  }
  const filtered = vf.length > 0;

  const onVehicles = (clauses: string[]) =>
    `p.id IN (SELECT f.part_id FROM fitments f JOIN vehicles v ON v.id = f.vehicle_id WHERE ${clauses.join(" AND ")})`;
  const mainWhere = `${filtered ? onVehicles(vf) : "1=1"}${extra}`;
  const mainArgs = [...(filtered ? vArgs : []), ...args];
  // Votes only count for the car being searched (a "fits my Civic" vote says nothing about a Camry).
  const voteClause = filtered ? ` AND fv.vehicle_id IN (SELECT v.id FROM vehicles v WHERE ${vf.join(" AND ")})` : "";
  const voteArgs = filtered ? vArgs : [];

  const sort: Sort = s.sort && s.sort in SORTS ? s.sort : "best";
  const order =
    sort === "title"
      ? "p.title COLLATE NOCASE ASC, p.id DESC"
      : sort === "newest"
        ? "p.id DESC"
        : "(up - down) DESC, p.id DESC";

  const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM parts p WHERE ${mainWhere}`).get(...mainArgs) as { n: number };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(s.page ?? 1) || 1), pages);
  const main = plain<Part>(
    db
      .prepare(
        `SELECT ${PART_COLS}, ${votes(voteClause)} FROM parts p JOIN users u ON u.id = p.user_id
         WHERE ${mainWhere} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(...voteArgs, ...voteArgs, ...mainArgs, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  );

  if (!filtered) return { main, total, page, pages, mightFit: [], universal: [], filtered };

  const secondary = (whereSql: string, whereArgs: (string | number)[], exclude: Set<number>) =>
    plain<Part>(
      db
        .prepare(
          `SELECT ${PART_COLS_ALL} FROM parts p JOIN users u ON u.id = p.user_id
           WHERE ${whereSql} ORDER BY (up - down) DESC, p.id DESC LIMIT 100`,
        )
        .all(...whereArgs),
    )
      .filter((p) => !exclude.has(p.id))
      .slice(0, SECONDARY_LIMIT);

  // The main list is paginated, so exclude by a query rather than by what's on this page.
  const allMainIds = new Set(
    (db.prepare(`SELECT p.id FROM parts p WHERE ${mainWhere}`).all(...mainArgs) as { id: number }[]).map((r) => r.id),
  );

  const mightFit =
    s.make && s.model && s.year
      ? secondary(`${onVehicles(["v.make = ?", "v.model = ?"])}${extra}`, [s.make, s.model, ...args], allMainIds)
      : [];
  const taken = new Set([...allMainIds, ...mightFit.map((p) => p.id)]);
  const universal = secondary(`p.universal = 1${extra}`, args, taken);
  return { main, total, page, pages, mightFit, universal, filtered };
}

export type FitVote = { vehicle_id: number; up: number; down: number; mine: number | null };

/** Per-vehicle confirmation counts for a part, plus the viewer's own vote (1 = fits, 0 = doesn't). */
export function getFitVotes(partId: number, userId?: number): Map<number, FitVote> {
  const rows = plain<FitVote>(
    getDb()
      .prepare(
        `SELECT vehicle_id, SUM(works = 1) AS up, SUM(works = 0) AS down,
           MAX(CASE WHEN user_id = ? THEN works END) AS mine
         FROM fit_votes WHERE part_id = ? GROUP BY vehicle_id`,
      )
      .all(userId ?? -1, partId),
  );
  return new Map(rows.map((r) => [r.vehicle_id, r]));
}

export function getPart(id: number): { part: Part; vehicles: (Vehicle & { note: string })[] } | null {
  const db = getDb();
  const part = plainOne<Part>(
    db
      .prepare(`SELECT ${PART_COLS_ALL} FROM parts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
      .get(id),
  );
  if (!part) return null;
  const vehicles = plain<Vehicle & { note: string }>(
    db
      .prepare(
        `SELECT v.*, f.note FROM fitments f JOIN vehicles v ON v.id = f.vehicle_id
         WHERE f.part_id = ? ORDER BY v.make, v.model, v.year_start`,
      )
      .all(id),
  );
  return { part, vehicles };
}

export type Report = { id: number; part_id: number; part_title: string | null; reporter: string; reason: string; created_at: string };

export function openReports(): Report[] {
  return plain<Report>(
    getDb()
      .prepare(
        `SELECT r.id, r.part_id, p.title AS part_title, u.username AS reporter, r.reason, r.created_at
         FROM reports r JOIN parts p ON p.id = r.part_id JOIN users u ON u.id = r.user_id
         WHERE r.resolved = 0 ORDER BY r.id DESC`,
      )
      .all(),
  );
}

export type AdminUser = { id: number; username: string; is_admin: number; created_at: string; part_count: number };

export function listUsers(): AdminUser[] {
  return plain<AdminUser>(
    getDb()
      .prepare(
        `SELECT u.id, u.username, u.is_admin, u.created_at,
           (SELECT COUNT(*) FROM parts p WHERE p.user_id = u.id) AS part_count
         FROM users u ORDER BY u.id`,
      )
      .all(),
  );
}

export function allParts(): Part[] {
  return plain<Part>(
    getDb()
      .prepare(`SELECT ${PART_COLS_ALL} FROM parts p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`)
      .all(),
  );
}

export function recentPartsByUser(userId: number): Part[] {
  return plain<Part>(
    getDb()
      .prepare(
        `SELECT ${PART_COLS_ALL} FROM parts p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ? ORDER BY p.id DESC`,
      )
      .all(userId),
  );
}
