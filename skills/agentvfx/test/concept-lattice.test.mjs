// Concept B "lattice": validation, snappy-motion declarations, and a rendered responsiveness probe
// (the lattice deforms on the frame of a kick and is mostly back to order within four frames).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC = "test-media/beat-132.mp3";
const lib = loadLibrary();
const tpl = lib.get("lattice");
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-lattice-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let runs = 0;

const score = (preset, extra = {}) => {
  const v = validateScore({ version: 1, template: "lattice", preset, durationSec: 3, seed: 5, out: "t", ...extra }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
};
const releaseOf = (preset) => tpl.fx.X_AGENTVFX.presets[preset].release ?? tpl.fx.INPUTS.find((i) => i.NAME === "release").DEFAULT;

test("lattice validates: every preset and demo, 4 s demos with the shared music", () => {
  assert.ok(tpl, "lattice is in the library");
  const presets = Object.keys(tpl.fx.X_AGENTVFX.presets);
  assert.ok(presets.length >= 3);
  for (const p of presets) score(p);
  const demos = readdirSync(tpl.dir).filter((f) => f.startsWith("demo-"));
  assert.ok(demos.length >= 3);
  for (const d of demos) {
    const demo = JSON.parse(readFileSync(path.join(tpl.dir, d), "utf8"));
    const v = validateScore(demo, lib);
    assert.equal(v.ok, true, `${d}: ${JSON.stringify(v.errors)}`);
    assert.equal(demo.durationSec, 4);
    assert.equal(demo.input.audio, MUSIC);
    assert.ok(existsSync(path.join(ROOT, demo.input.video)));
  }
  assert.equal(tpl.fx.X_AGENTVFX.spdx, "LicenseRef-agentvfx");
  assert.ok(tpl.fx.X_AGENTVFX.safeSubstitute);
});

test("lattice knobs: colours, grid size and headline font/text are settable from a score", () => {
  const palettes = ["graphite-ice", "phosphor", "bone-ink"];
  for (const p of palettes) assert.ok(tpl.fx.X_AGENTVFX.presets[p]?.dotColor, `palette preset ${p}`);
  assert.equal(tpl.fx.X_AGENTVFX.presets.vermilion && Object.keys(tpl.fx.X_AGENTVFX.presets.vermilion).length, 0, "vermilion stays the default");
  const colours = { groundColor: [0.1, 0.1, 0.1, 1], dotColor: [0.2, 0.9, 0.3, 1], hotColor: [1, 1, 1, 1] };
  assert.deepEqual(score("vermilion", { params: colours }).params, colours);
  assert.equal(validateScore({ version: 1, template: "lattice", durationSec: 3, seed: 5, params: { dotColor: [2, 0, 0, 1] } }, lib).ok, false, "out-of-range colour rejected");
  for (const pitch of [8, 80]) score("vermilion", { params: { pitch } });
  assert.equal(validateScore({ version: 1, template: "lattice", durationSec: 3, seed: 5, params: { pitch: 81 } }, lib).ok, false);
  score("vermilion", { labels: { headline: "ZONE" }, textStyle: { headline: { font: "mono", size: 0.12, x: 0.1, y: 0.4 } } });
});

test("lattice grid size is resolution independent: the same pitch gives the same number of columns at 640x360 and 960x540", async () => {
  const quiet = { mediaAmount: 0, headline: 0, jitter: 0, sparkle: 0, tearShear: 0, ghost: 0, links: 0, dotBase: 0.3 };
  const columns = async (w, h) => {
    const kept = new Map();
    await renderScore(score("vermilion", { params: quiet, fps: 24 }), lib, { outDir: path.join(tmp, `r-${runs++}`), width: w, height: h, replay: false, onFrame: (f, a) => { if (f === 2) kept.set(f, Buffer.from(a.rgba)); } });
    const px = kept.get(2);
    const prof = Array.from({ length: w }, (_, x) => { let s = 0; for (let y = 0; y < h; y++) s += px[(y * w + x) * 4 + 0]; return s / h; });
    const mid = (Math.min(...prof) + Math.max(...prof)) / 2;
    let n = 0;
    for (let x = 1; x < w; x++) if (prof[x - 1] < mid && prof[x] >= mid) n++;
    return n;
  };
  const small = await columns(640, 360);
  const big = await columns(960, 540);
  const expected = 1920 / 22;
  assert.ok(Math.abs(small - expected) <= 3, `640x360 shows ${small} columns, expected about ${expected.toFixed(1)}`);
  assert.ok(Math.abs(big - expected) <= 3, `960x540 shows ${big} columns, expected about ${expected.toFixed(1)}`);
});

test("lattice declares snappy motion: release default <= 0.07 s, one preset at 0.12, no attack smoothing anywhere", () => {
  const rel = tpl.fx.INPUTS.find((i) => i.NAME === "release");
  assert.ok(rel.DEFAULT <= 0.07, `release default ${rel.DEFAULT}`);
  const rels = Object.keys(tpl.fx.X_AGENTVFX.presets).map(releaseOf);
  assert.ok(rels.includes(0.12), "a 0.12 s preset to compare");
  assert.ok(rels.every((r) => r <= 0.12 && r >= rel.MIN));
  for (const i of tpl.fx.INPUTS) assert.ok(!/attack|settle|lag|inertia|smooth|easing|glide/iu.test(i.NAME), `no smoothing-style param: ${i.NAME}`);
  const src = tpl.passes.map((f) => readFileSync(path.join(tpl.dir, f), "utf8").replace(/\/\/.*$/gmu, "")).join("\n");
  assert.ok(!/attack|settle|smoothstep\s*\(\s*0\.0\s*,\s*1\.0\s*,\s*AUDIO/iu.test(src), "no attack/settle in shader code");
  assert.ok(/max\(\s*clamp\(\(AUDIO_TREB/u.test(src), "running envelope is max(raw, decayed previous): instant attack");
});

/** Render frames 0..n of a score at 320x180 and return the RGBA of each wanted frame. */
async function frames(s, keep, features) {
  const kept = new Map();
  await renderScore(s, lib, { outDir: path.join(tmp, `r-${runs++}`), width: 320, height: 180, features, replay: false, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  return kept;
}
/** Peak disturbance: the largest mean |difference| over any 16x16 block (amplitude, not the area the wave has reached). */
const dev = (a, b) => {
  const B = 16;
  let best = 0;
  for (let by = 0; by < Math.floor(180 / B); by++) {
    for (let bx = 0; bx < Math.floor(320 / B); bx++) {
      let s = 0;
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const i = ((by * B + y) * 320 + bx * B + x) * 4; s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); }
      best = Math.max(best, s / (B * B));
    }
  }
  return best;
};

test("lattice: silence is a perfect static grid; a kick deforms it on the same frame and it is mostly back within 4 frames", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const fr = features.frames;
  const kickBass = tpl.fx.INPUTS.find((i) => i.NAME === "kickBass").DEFAULT;
  const f = fr.findIndex((x, i) => i >= 8 && x.bass >= kickBass && x.bass > 1.5 * fr[i - 1].bass
    && fr.slice(i - 6, i).every((y) => !y.onset) && fr.slice(i + 1, i + 6).every((y) => !y.onset));
  assert.ok(f > 0, "an isolated kick exists in the test music");
  const quiet = { mediaAmount: 0, headline: 0, jitter: 0, sparkle: 0, tearShear: 0 };
  const keep = [f - 1, f, f + 1, f + 2, f + 4];
  const rest = await frames(score("vermilion", { params: quiet }), keep, null);
  const floor = dev(rest.get(f - 1), rest.get(f + 4));
  assert.ok(floor < 2, `silent lattice only differs by the output dither: ${floor.toFixed(3)}`);
  const run = async (preset) => {
    const k = await frames(score(preset, { params: quiet, input: { audio: MUSIC } }), keep, features);
    const ref = preset === "vermilion" ? rest : await frames(score(preset, { params: quiet }), keep, null);
    return keep.map((n) => Math.max(dev(k.get(n), ref.get(n)) - floor, 0));
  };
  const [before, onset, , , after] = await run("vermilion");
  assert.ok(onset > 3 * before + 1,`deformed on the onset frame: ${onset.toFixed(2)} vs ${before.toFixed(2)} before`);
  assert.ok(after <= 0.5 * onset, `drops by half within 4 frames: ${after.toFixed(2)} vs ${onset.toFixed(2)}`);
  const slow = await run("violet-slow");
  assert.ok(slow[4] / slow[1] > after / onset, "release 0.12 lingers longer than release 0.06");
});
