import assert from "node:assert/strict";
import { test } from "node:test";
import { freshDb } from "./helpers.ts";

await freshDb();
const { consume, count, isLimited, record } = await import("../src/lib/rateLimit.ts");

test("consume allows up to the limit then refuses", () => {
  const t = 1_000_000;
  assert.equal(consume("k1", 3, 60, t), true);
  assert.equal(consume("k1", 3, 60, t + 1), true);
  assert.equal(consume("k1", 3, 60, t + 2), true);
  assert.equal(consume("k1", 3, 60, t + 3), false);
});

test("window slides: old events stop counting", () => {
  const t = 5_000_000;
  for (let i = 0; i < 3; i++) record("k2", t);
  assert.equal(isLimited("k2", 3, 60, t + 1000), true);
  assert.equal(isLimited("k2", 3, 60, t + 61_000), false);
  assert.equal(count("k2", 60, t + 61_000), 0);
});

test("keys are independent and isLimited does not record", () => {
  const t = 9_000_000;
  for (let i = 0; i < 5; i++) assert.equal(isLimited("k3", 1, 60, t), false);
  assert.equal(count("k3", 60, t), 0);
  record("k3", t);
  assert.equal(isLimited("k3", 1, 60, t), true);
  assert.equal(isLimited("other", 1, 60, t), false);
});
