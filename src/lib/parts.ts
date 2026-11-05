import { getDb } from "./db";

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
};

export type Vehicle = {
  id: number;
  make: string;
  model: string;
  generation: string;
  year_start: number;
  year_end: number;
};

export type SearchParams = {
  make?: string;
  model?: string;
  year?: number;
  q?: string;
  category?: string;
};

const PART_COLS = `p.id, p.user_id, p.image_path, p.title, p.description, p.category, p.material, p.universal,
  p.file_name, p.file_size, p.source_url, p.creator_name, p.created_at, u.username`;

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

export function searchParts(s: SearchParams): { fits: Part[]; universal: Part[]; filtered: boolean } {
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
  const extra = where.length ? ` AND ${where.join(" AND ")}` : "";

  const vehicleFilter: string[] = [];
  const vArgs: (string | number)[] = [];
  if (s.make) {
    vehicleFilter.push("v.make = ?");
    vArgs.push(s.make);
  }
  if (s.model) {
    vehicleFilter.push("v.model = ?");
    vArgs.push(s.model);
  }
  if (s.year) {
    vehicleFilter.push("? BETWEEN v.year_start AND v.year_end");
    vArgs.push(s.year);
  }

  // No vehicle chosen: plain browse of everything, newest first.
  if (!vehicleFilter.length) {
    const all = plain<Part>(
      db
        .prepare(
          `SELECT ${PART_COLS} FROM parts p JOIN users u ON u.id = p.user_id
           WHERE 1=1${extra} ORDER BY p.id DESC LIMIT 100`,
        )
        .all(...args),
    );
    return { fits: all, universal: [], filtered: false };
  }

  const fits = plain<Part>(
    db
      .prepare(
        `SELECT DISTINCT ${PART_COLS} FROM parts p
         JOIN users u ON u.id = p.user_id
         JOIN fitments f ON f.part_id = p.id
         JOIN vehicles v ON v.id = f.vehicle_id
         WHERE ${vehicleFilter.join(" AND ")}${extra} ORDER BY p.id DESC LIMIT 100`,
      )
      .all(...vArgs, ...args),
  );
  const fitIds = new Set(fits.map((p) => p.id));
  const universal = plain<Part>(
    db
      .prepare(
        `SELECT ${PART_COLS} FROM parts p JOIN users u ON u.id = p.user_id
         WHERE p.universal = 1${extra} ORDER BY p.id DESC LIMIT 100`,
      )
      .all(...args),
  ).filter((p) => !fitIds.has(p.id));
  return { fits, universal, filtered: true };
}

export function getPart(id: number): { part: Part; vehicles: (Vehicle & { note: string })[] } | null {
  const db = getDb();
  const part = plainOne<Part>(
    db
      .prepare(`SELECT ${PART_COLS} FROM parts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
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
      .prepare(`SELECT ${PART_COLS} FROM parts p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`)
      .all(),
  );
}

export function recentPartsByUser(userId: number): Part[] {
  return plain<Part>(
    getDb()
      .prepare(
        `SELECT ${PART_COLS} FROM parts p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ? ORDER BY p.id DESC`,
      )
      .all(userId),
  );
}
