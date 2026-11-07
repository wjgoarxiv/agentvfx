import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { buildSchedule } from "../engine/core/schedule.mjs";
import { renderScore } from "../engine/node/render.mjs";

const lib = loadLibrary({ includeTest: true });
const W = 256;
const H = 144;
const score = (extra) => {
  const r = validateScore({ version: 1, durationSec: 3, seed: 5, out: "t", ...extra }, lib);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.value;
};
const centre = (rgba) => {
  const o = ((H >> 1) * W + (W >> 1)) * 4;
  return [rgba[o], rgba[o + 1], rgba[o + 2]];
};

async function renderCentres(s, { replay = false, probe = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-test-"));
  const px = [];
  const shas = [];
  try {
    const report = await renderScore(s, lib, { outDir: dir, width: W, height: H, replay, probeNondeterminism: probe, onFrame: (f, a) => { px[f] = centre(a.rgba); shas[f] = a.rgbaSha256; } });
    assert.ok(existsSync(path.join(dir, "film.mp4")));
    return { report, px, shas };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("persistent buffer: feedback-counter shows frame 30 as 31/255 (+-1)", async () => {
  const { px, report } = await renderCentres(score({ template: "test-feedback-counter", preset: "one" }), { replay: true });
  assert.ok(Math.abs(px[30][0] - 31) <= 1, `frame 30 = ${px[30]}`);
  assert.ok(Math.abs(px[0][0] - 1) <= 1, `frame 0 = ${px[0]}`);
  assert.equal(report.determinism.pass, true);
});

test("determinism replay fails on a page with an unseeded random input", async () => {
  const { report } = await renderCentres(score({ template: "test-gradient", params: { speed: 1 } }), { replay: true, probe: true });
  assert.equal(report.determinism.pass, false);
  assert.ok(report.determinism.firstDifference, "names the first differing block");
});

test("a stack gradient -> identity renders byte-identical twice", async () => {
  const s = score({ template: "test-gradient", stack: ["test-identity"] });
  const a = await renderCentres(s);
  const b = await renderCentres(s);
  assert.deepEqual(a.shas, b.shas);
  assert.notDeepEqual(a.px[10], [0, 0, 0], "identity passes the gradient through");
});

test("a hit at t=1.0 is active on frames 30..30+d-1 exactly", async () => {
  const s = score({ template: "test-gradient", params: { tint: [0.1, 0.1, 0.9, 1] }, hits: [{ t: 1, template: "test-strobe", preset: "hold", durationFrames: 4 }] });
  const sched = buildSchedule(s, lib);
  const hitFrames = sched.frames.map((fr, f) => (fr.layers.some((l) => l.key === "h0") ? f : -1)).filter((f) => f >= 0);
  assert.deepEqual(hitFrames, [30, 31, 32, 33]);
  const { px } = await renderCentres(s);
  for (const f of [30, 31, 32, 33]) assert.deepEqual(px[f].map((v) => v > 250), [true, true, true], `frame ${f} white: ${px[f]}`);
  for (const f of [29, 34]) assert.ok(px[f][0] < 200, `frame ${f} not white: ${px[f]}`);
});

test("a cut at t=2.0 switches layers exactly on frame 60", async () => {
  const s = score({ template: "test-gradient", params: { tint: [0.1, 0.1, 0.9, 1] }, cuts: [{ t: 2, layers: [{ template: "test-strobe", preset: "hold", params: { red: true } }] }] });
  const { px } = await renderCentres(s);
  assert.ok(px[60][0] > 250 && px[60][1] < 5 && px[60][2] < 5, `frame 60 red: ${px[60]}`);
  assert.ok(!(px[59][0] > 250 && px[59][1] < 5), `frame 59 not red: ${px[59]}`);
});
