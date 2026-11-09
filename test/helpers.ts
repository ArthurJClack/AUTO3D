import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Point the app at a throwaway in-memory database. Must run before src/lib/db.ts is first imported. */
export async function freshDb() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "auto3d-test-"));
  process.env.DATABASE_PATH = ":memory:";
  const { getDb } = await import("../src/lib/db.ts");
  return getDb();
}
