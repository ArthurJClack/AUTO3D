import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanModelName, isConsumerModel, modelAliases, normalizeModel, runLabel, toRuns } from "../src/lib/nhtsa.ts";

test("toRuns groups consecutive years", () => {
  assert.deepEqual(toRuns([2016, 2014, 2015, 2019, 2019, 2020, 2030]), [
    { start: 2014, end: 2016 },
    { start: 2019, end: 2020 },
    { start: 2030, end: 2030 },
  ]);
  assert.deepEqual(toRuns([]), []);
});

test("runLabel", () => {
  assert.equal(runLabel({ start: 2015, end: 2015 }), "2015");
  assert.equal(runLabel({ start: 2014, end: 2019 }), "2014–2019");
});

test("model name matching ignores punctuation and splits aliases", () => {
  assert.equal(normalizeModel("F-150"), normalizeModel("f 150"));
  assert.deepEqual(modelAliases("Golf / GTI"), ["golf", "gti"]);
});

test("cleanModelName", () => {
  assert.equal(cleanModelName("ACCORD"), "Accord");
  assert.equal(cleanModelName("GRAND CHEROKEE"), "Grand Cherokee");
  assert.equal(cleanModelName("CR-Z"), "CR-Z");
  assert.equal(cleanModelName("CX-5"), "CX-5");
  assert.equal(cleanModelName("  Civic   Type R "), "Civic Type R");
});

test("isConsumerModel drops commercial chassis and spec strings", () => {
  for (const bad of ['110" WB', "Motorhome Chassis", "Ram Chassis Cab", "750i, Alpina B7", "'34", "Cab Over Engine HT", "X"])
    assert.equal(isConsumerModel(bad), false, bad);
  for (const good of ["Civic", "F-150", "Prius Prime (PHEV)", "CR-V", "Grand Cherokee", "3 Series", "Model 3", "Mustang Mach-E"])
    assert.equal(isConsumerModel(good), true, good);
});
