import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { loadLibrary } from "../engine/core/templates.mjs";

const VFX = fileURLToPath(new URL("../scripts/vfx.mjs", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const run = (args) => spawnSync(process.execPath, [VFX, ...args], { encoding: "utf8" });
const lib = loadLibrary({ includeTest: true });

const okScore = () => ({ version: 1, template: "test-gradient", durationSec: 4, seed: 7, out: "x" });
const paths = (r) => r.errors.map((e) => e.path);

const goodTemplate = () => ({
  DESCRIPTION: "fixture", CATEGORIES: ["test"], ISFVSN: "2",
  INPUTS: [{ NAME: "speed", TYPE: "float", MIN: 0, MAX: 4, DEFAULT: 1 }],
  X_AGENTVFX: {
    id: "fixture", family: "test", input: "generative", spdx: "MIT", flash: "none",
    presets: { a: { speed: 1 }, b: { speed: 2 }, c: { speed: 3 } },
  },
});

test("a valid score is accepted", () => {
  const r = validateScore(okScore(), lib);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("durationSec 8 is rejected naming durationSec", () => {
  const r = validateScore({ ...okScore(), durationSec: 8 }, lib);
  assert.equal(r.ok, false);
  assert.ok(paths(r).includes("durationSec"), JSON.stringify(r.errors));
});

test("an unknown template is rejected naming template", () => {
  const r = validateScore({ ...okScore(), template: "nope-not-here" }, lib);
  assert.ok(paths(r).includes("template"), JSON.stringify(r.errors));
});

test("an unknown safety.mode is rejected naming safety.mode", () => {
  const r = validateScore({ ...okScore(), safety: { mode: "gentle" } }, lib);
  assert.ok(paths(r).includes("safety.mode"), JSON.stringify(r.errors));
});

test("a score without safety resolves to stage mode", () => {
  const r = validateScore(okScore(), lib);
  assert.equal(r.value.safety.mode, "stage");
  assert.equal(r.value.safety.safeVariant, false);
});

test("unknown params, bad ranges, bindings and hits are named by path", () => {
  const r = validateScore({
    ...okScore(), params: { nope: 1, speed: 99 },
    bindings: [{ param: "speed", feature: "loudness", gain: 1, offset: 0 }],
    hits: [{ t: 1, onset: 2, template: "test-gradient", durationFrames: 3 }],
    unknownKey: true,
  }, lib);
  const p = paths(r);
  for (const want of ["params.nope", "params.speed", "bindings[0].feature", "hits[0]", "unknownKey"]) assert.ok(p.includes(want), `${want} missing in ${JSON.stringify(p)}`);
});

test("a template with spdx GPL-3.0 is rejected", () => {
  const t = goodTemplate();
  t.X_AGENTVFX.spdx = "GPL-3.0";
  const r = validateTemplate(t, "fixture");
  assert.ok(r.errors.some((e) => e.path === "X_AGENTVFX.spdx"), JSON.stringify(r.errors));
});

test("a template with fewer than 3 presets is rejected", () => {
  const t = goodTemplate();
  t.X_AGENTVFX.presets = { a: { speed: 1 }, b: { speed: 2 } };
  const r = validateTemplate(t, "fixture");
  assert.ok(r.errors.some((e) => e.path === "X_AGENTVFX.presets"), JSON.stringify(r.errors));
});

test("a good template passes and preset values are range-checked", () => {
  assert.deepEqual(validateTemplate(goodTemplate(), "fixture").errors, []);
  const t = goodTemplate();
  t.X_AGENTVFX.presets.c.speed = 10;
  assert.ok(validateTemplate(t, "fixture").errors.some((e) => e.path === "X_AGENTVFX.presets.c.speed"));
});

test("every library template validates", () => {
  for (const [id, tpl] of lib) assert.deepEqual(validateTemplate(tpl.fx, id).errors, [], id);
});

test("cli: validate accepts score-ok and rejects score-bad-duration naming durationSec", () => {
  const ok = run(["validate", `${FIX}score-ok.json`]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const bad = run(["validate", `${FIX}score-bad-duration.json`]);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stdout + bad.stderr, /durationSec/u);
});

test("cli: list hides test templates", () => {
  const r = run(["list", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.ok(Array.isArray(rows));
  assert.ok(!rows.some((t) => t.family === "_test" || t.id.startsWith("test-")));
});
