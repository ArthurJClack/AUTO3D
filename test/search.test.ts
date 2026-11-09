import assert from "node:assert/strict";
import { before, test } from "node:test";
import { freshDb } from "./helpers.ts";

const db = await freshDb();
const { searchParts, getFitVotes, PAGE_SIZE } = await import("../src/lib/parts.ts");

const vid = (make: string, model: string, gen: string) =>
  (db.prepare("SELECT id FROM vehicles WHERE make=? AND model=? AND generation=?").get(make, model, gen) as { id: number }).id;
const civic10 = vid("Honda", "Civic", "10th gen"); // 2016–2021
const civic9 = vid("Honda", "Civic", "9th gen"); // 2012–2015
const camry = vid("Toyota", "Camry", "XV70");
const tesla3 = vid("Tesla", "Model 3", "Model 3");

let owner: number;
let voter1: number;
let voter2: number;
function user(name: string) {
  return Number(db.prepare("INSERT INTO users (username, password_hash) VALUES (?, 'x')").run(name).lastInsertRowid);
}
function part(title: string, vehicles: number[], opts: { universal?: boolean; material?: string; category?: string } = {}) {
  const id = Number(
    db
      .prepare("INSERT INTO parts (user_id, title, category, material, universal, source_url) VALUES (?,?,?,?,?, 'https://example.com')")
      .run(owner, title, opts.category ?? "Interior", opts.material ?? "", opts.universal ? 1 : 0).lastInsertRowid,
  );
  for (const v of vehicles) db.prepare("INSERT INTO fitments (part_id, vehicle_id) VALUES (?,?)").run(id, v);
  return id;
}
const vote = (partId: number, vehicleId: number, userId: number, works: 0 | 1) =>
  db.prepare("INSERT INTO fit_votes (part_id, vehicle_id, user_id, works) VALUES (?,?,?,?)").run(partId, vehicleId, userId, works);
const titles = (parts: { title: string }[]) => parts.map((p) => p.title);

let ventOld: number, dashNew: number, both: number;
before(() => {
  owner = user("owner");
  voter1 = user("v1");
  voter2 = user("v2");
  ventOld = part("Civic vent mount", [civic10]); // older id
  dashNew = part("Civic dash clip", [civic10]);
  part("Civic old trim", [civic9]);
  both = part("Civic dual-gen bracket", [civic9, civic10]);
  part("Universal hook", [], { universal: true });
  part("Camry mount", [camry]);
  part("100% grippy", [camry]);
  for (let i = 1; i <= 15; i++) part(`Tesla thing ${String(i).padStart(2, "0")}`, [tesla3], { material: i % 2 ? "PETG" : "PLA" });
});

test("year picks the generation; other generations of the model show as 'might fit'; universal is separate", () => {
  const r = searchParts({ make: "Honda", model: "Civic", year: 2018 });
  assert.deepEqual(new Set(titles(r.main)), new Set(["Civic vent mount", "Civic dash clip", "Civic dual-gen bracket"]));
  assert.deepEqual(titles(r.mightFit), ["Civic old trim"]);
  assert.deepEqual(titles(r.universal), ["Universal hook"]);
  assert.equal(r.filtered, true);
});

test("a part tagged for both generations is never also listed under 'might fit'", () => {
  const r = searchParts({ make: "Honda", model: "Civic", year: 2018 });
  assert.ok(!titles(r.mightFit).includes("Civic dual-gen bracket"));
});

test("without a year there is no 'might fit' tier — every generation counts as a fit", () => {
  const r = searchParts({ make: "Honda", model: "Civic" });
  assert.equal(r.total, 4);
  assert.equal(r.mightFit.length, 0);
});

test("a different car doesn't match", () => {
  const r = searchParts({ make: "Toyota", model: "Camry", year: 2020 });
  assert.ok(!titles(r.main).some((t) => t.startsWith("Civic")));
});

test("no car chosen browses everything, newest first, with no tiers", () => {
  const r = searchParts({ sort: "newest" });
  assert.equal(r.filtered, false);
  assert.equal(r.total, 4 + 1 + 2 + 15);
  assert.equal(r.universal.length, 0);
  assert.equal(r.main[0].title, "Tesla thing 15");
});

test("confirmations rank results, and only votes for the searched car count", () => {
  // before any votes: newest first
  assert.equal(searchParts({ make: "Honda", model: "Civic", year: 2018 }).main[0].title, "Civic dual-gen bracket");
  vote(ventOld, civic10, voter1, 1);
  vote(ventOld, civic10, voter2, 1);
  vote(both, civic9, voter1, 1); // vote for the OTHER generation
  vote(both, civic9, voter2, 1);
  vote(dashNew, civic10, voter1, 0);
  const r = searchParts({ make: "Honda", model: "Civic", year: 2018 });
  assert.equal(r.main[0].title, "Civic vent mount");
  assert.equal(r.main[0].up, 2);
  const bracket = r.main.find((p) => p.title === "Civic dual-gen bracket")!;
  assert.equal(bracket.up, 0, "civic9 votes must not count when searching a 2018 (10th gen) Civic");
  assert.equal(r.main.at(-1)!.title, "Civic dash clip", "net-negative part sorts last");
  assert.equal(r.main.at(-1)!.down, 1);
  // sort=newest ignores votes
  assert.equal(searchParts({ make: "Honda", model: "Civic", year: 2018, sort: "newest" }).main[0].title, "Civic dual-gen bracket");
});

test("getFitVotes aggregates per vehicle and reports the viewer's own vote", () => {
  const votes = getFitVotes(ventOld, voter1);
  assert.deepEqual({ ...votes.get(civic10) }, { vehicle_id: civic10, up: 2, down: 0, mine: 1 });
  assert.equal(getFitVotes(ventOld).get(civic10)!.mine, null);
  assert.equal(getFitVotes(dashNew, voter1).get(civic10)!.mine, 0);
});

test("a user has one vote per part+vehicle", () => {
  assert.throws(() => vote(ventOld, civic10, voter1, 0));
});

test("pagination", () => {
  const p1 = searchParts({ make: "Tesla", model: "Model 3", sort: "title" });
  assert.equal(p1.total, 15);
  assert.equal(p1.pages, 2);
  assert.equal(p1.main.length, PAGE_SIZE);
  assert.equal(p1.main[0].title, "Tesla thing 01");
  const p2 = searchParts({ make: "Tesla", model: "Model 3", sort: "title", page: 2 });
  assert.deepEqual(titles(p2.main), ["Tesla thing 13", "Tesla thing 14", "Tesla thing 15"]);
  assert.equal(searchParts({ make: "Tesla", model: "Model 3", page: 99 }).page, 2, "page is clamped");
  assert.equal(searchParts({ make: "Tesla", model: "Model 3", page: -3 }).page, 1);
  assert.equal(searchParts({ make: "Tesla", model: "Model 3", page: NaN }).page, 1);
});

test("material and category filters", () => {
  assert.equal(searchParts({ make: "Tesla", model: "Model 3", material: "PETG" }).total, 8);
  assert.equal(searchParts({ make: "Tesla", model: "Model 3", material: "PLA" }).total, 7);
  assert.equal(searchParts({ category: "Exterior" }).total, 0);
});

test("keyword search treats % and _ literally", () => {
  assert.deepEqual(titles(searchParts({ q: "%" }).main), ["100% grippy"]);
  assert.equal(searchParts({ q: "_" }).total, 0);
  assert.equal(searchParts({ q: "TESLA THING 0" }).total, 9, "case-insensitive substring");
});

test("sort by title is case-insensitive A–Z", () => {
  const r = searchParts({ sort: "title" });
  assert.equal(r.main[0].title, "100% grippy");
});
