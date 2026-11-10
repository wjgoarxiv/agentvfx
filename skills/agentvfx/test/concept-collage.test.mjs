// Concept C "collage": validation, snappy-motion declarations, measured responsiveness on rendered
// frames, and layout regeneration on beats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
const tpl = lib.get("collage");
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-collage-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let runs = 0;

function score(preset, params = {}) {
  const v = validateScore({ version: 1, template: "collage", ...(preset ? { preset } : {}), input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t", params }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
}

async function frames(preset, params, keep) {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const kept = new Map();
  await renderScore(score(preset, params), lib, { outDir: path.join(tmp, `c-${runs++}`), width: 320, height: 180, features, replay: false, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  return { kept, features };
}

/** Bright pixels in the top channel row (bass) of the solo level meter, rows 12..40 of 180. */
const lit = (rgba) => { let c = 0; for (let y = 12; y < 40; y++) for (let x = 0; x < 320; x++) { const i = (y * 320 + x) * 4; if (rgba[i] + rgba[i + 1] + rgba[i + 2] > 380) c += 1; } return c; };
const diff = (a, b) => { let c = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i + 1] - b[i + 1]) > 40) c += 1; return c / (a.length / 4); };

test("collage validates, ships 4 presets incl. release 0.06 and 0.12, and a demo score each", () => {
  assert.ok(tpl, "collage is in the library");
  const presets = tpl.fx.X_AGENTVFX.presets;
  assert.ok(Object.keys(presets).length >= 3);
  for (const p of Object.keys(presets)) score(p);
  const rel = (p) => ({ ...Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i.DEFAULT])), ...presets[p] }).release;
  const values = Object.keys(presets).map(rel);
  assert.ok(values.includes(0.06) && values.includes(0.12), `release values ${values}`);
  assert.equal(tpl.fx.X_AGENTVFX.spdx, "Apache-2.0");
  assert.ok(tpl.fx.X_AGENTVFX.safeSubstitute);
  for (const d of readdirSync(tpl.dir).filter((f) => f.startsWith("demo-"))) assert.equal(validateScore(JSON.parse(readFileSync(path.join(tpl.dir, d), "utf8")), lib).ok, true);
});

test("snappy declarations: release default <= 0.07 s, no attack or settle style parameter", () => {
  const names = tpl.fx.INPUTS.map((i) => i.NAME);
  assert.ok(tpl.fx.INPUTS.find((i) => i.NAME === "release").DEFAULT <= 0.07);
  assert.deepEqual(names.filter((n) => /attack|settle|smooth|easing|lag/iu.test(n)), []);
});

test("level meter: lights within 1 frame of a strong bass onset and drops by half within 4 frames", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const onsets = features.meta.onsets.filter((o) => o >= 4 && o < 85 && features.frames[o].bass > 3 && features.frames[o - 1].bass < 1.3 && features.frames[o + 4].bass < 1);
  assert.ok(onsets.length >= 1, "a clean strong onset exists");
  const keep = onsets.flatMap((o) => [o - 1, o, o + 4]);
  const { kept } = await frames("bone-lime", { cutMode: 3, soloPanel: 4, grain: 0, gridDots: 0, construction: false }, keep);
  for (const o of onsets) {
    const before = lit(kept.get(o - 1));
    const at = lit(kept.get(o));
    const after = lit(kept.get(o + 4));
    assert.ok(at > before * 1.3, `onset ${o}: lit ${before} -> ${at}`);
    assert.ok(after <= at * 0.5, `onset ${o}: lit ${at} -> ${after} after 4 frames`);
  }
});

test("layoutMode reshuffle (opt-in): the layout is rebuilt on a beat and holds between cuts", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beat = features.meta.beats.find((b) => b >= 4 && b < 85);
  const keep = [beat - 1, beat, beat + 1, beat + 2];
  const live = (await frames("bone-lime", { layoutMode: 1, construction: false, grain: 0 }, keep)).kept;
  const frozen = (await frames("bone-lime", { layoutMode: 1, construction: false, grain: 0, cutMode: 3 }, keep)).kept;
  const cut = diff(live.get(beat - 1), live.get(beat));
  const still = diff(frozen.get(beat - 1), frozen.get(beat));
  assert.ok(cut > 0.2, `pixels changed on the beat: ${cut}`);
  assert.ok(cut > still * 2, `cut ${cut} vs frozen layout ${still}`);
  assert.ok(diff(live.get(beat), live.get(beat + 1)) < cut, "layout holds after the cut");
});
