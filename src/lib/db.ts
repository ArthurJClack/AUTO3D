import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { VEHICLE_SEED } from "./vehicleSeed";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/** Absolute path of an uploaded file; `name` must be a server-generated filename. */
export function uploadPath(name: string): string {
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, path.basename(name));
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
-- one row per make/model/generation; year range is inclusive
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  generation TEXT NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  UNIQUE (make, model, generation)
);
CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  material TEXT NOT NULL DEFAULT '',
  universal INTEGER NOT NULL DEFAULT 0,
  -- uploaded STL (null for link-only listings)
  file_name TEXT,
  file_path TEXT,
  file_size INTEGER,
  -- external listing / original source
  source_url TEXT,
  creator_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fitments (
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (part_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_fitments_vehicle ON fitments(vehicle_id);
`;

function open(): DatabaseSync {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new DatabaseSync(process.env.DATABASE_PATH ?? path.join(DATA_DIR, "auto3d.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM vehicles").get() as { n: number };
  if (n === 0) {
    const ins = db.prepare(
      "INSERT OR IGNORE INTO vehicles (make, model, generation, year_start, year_end) VALUES (?,?,?,?,?)",
    );
    db.exec("BEGIN");
    for (const v of VEHICLE_SEED) ins.run(...v);
    db.exec("COMMIT");
  }
  return db;
}

const g = globalThis as unknown as { __auto3dDb?: DatabaseSync };
export function getDb(): DatabaseSync {
  return (g.__auto3dDb ??= open());
}
