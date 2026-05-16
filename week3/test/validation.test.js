import test from "node:test";
import assert from "node:assert/strict";

import { InputError } from "../server/lib/errors.js";
import { booleanArg, integerArg, stringArg } from "../server/lib/validation.js";

test("stringArg trims and rejects empty values", () => {
  assert.equal(stringArg({ keyword: "  孙燕姿  " }, "keyword"), "孙燕姿");
  assert.throws(() => stringArg({ keyword: " " }, "keyword"), InputError);
});

test("integerArg accepts aliases, clamps max, and rejects invalid values", () => {
  assert.equal(integerArg({ songId: 5257138 }, ["song_id", "songId"], undefined, { min: 1 }), 5257138);
  assert.equal(integerArg({ limit: 999 }, "limit", 5, { min: 1, max: 20 }), 20);
  assert.throws(() => integerArg({ limit: 0 }, "limit", 5, { min: 1 }), InputError);
});

test("booleanArg handles booleans and common string values", () => {
  assert.equal(booleanArg({ enabled: true }, "enabled"), true);
  assert.equal(booleanArg({ enabled: "false" }, "enabled", true), false);
  assert.equal(booleanArg({}, "enabled", true), true);
});
