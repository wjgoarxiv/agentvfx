// signal-cut concept (design A): validation of every preset and demo, snappy-response declarations
// (release default <= 0.07 s, one preset at 0.12, no attack smoothing parameter) and a render probe on the
// real clip and music: the field cut lands on the beat frame and is gone within four frames.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { openFootage } from "../engine/node/footage.mjs";
import { auditFlash, LINEAR_LUT } from "../engine/core/flash.mjs";
import { FLASH } from "../engine/core/flash-constants.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIP = "test-media/clip-01.mp4";
const MUSIC = "test-media/beat-132.mp3";
const lib = loadLibrary();
const tpl = lib.get("signal-cut");
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-signal-cut-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const W = 320;
const H = 180;

const score = (preset, extra = {}) => {
  const v = validateScore({ version: 1, template: "signal-cut", preset, input: { video: CLIP, audio: MUSIC }, durationSec: 3, seed: 7, out: "t", ...extra }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
};

async function frames(s, keep) {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30, durationSec: s.durationSec });
  const footage = openFootage(path.resolve(ROOT, CLIP), { fps: 30, durationSec: s.durationSec, longEdge: W });
  const kept = new Map();
  try {
    await renderScore(s, lib, { outDir: mkdtempSync(path.join(tmp, "r-")), width: W, height: H, footage, features, replay: false, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  } finally {
    footage.close();
  }
  return { kept, features };
}
/** Share of pixels that are the acid field colour (200, 255, 0). */
const fieldShare = (rgba) => {
  let n = 0;
  for (let i = 0; i < W * H; i++) if (rgba[i * 4] > 150 && rgba[i * 4 + 1] > 200 && rgba[i * 4 + 2] < 60) n += 1;
  return n / (W * H);
};

test("signal-cut is declared: family, 3+ presets, strobe class with a safe substitute, demos validate", () => {
  assert.ok(tpl, "signal-cut is in the library");
  const x = tpl.fx.X_AGENTVFX;
  assert.equal(x.input, "footage");
  assert.equal(x.spdx, "Apache-2.0");
  assert.ok(Object.keys(x.presets).length >= 3);
  assert.equal(x.flash, "strobe");
  assert.equal(x.safeSubstitute.params.fieldCut, 0);
  for (const preset of Object.keys(x.presets)) score(preset);
  const demos = readdirSync(tpl.dir).filter((f) => f.startsWith("demo-"));
  assert.ok(demos.length >= 3);
  for (const d of demos) {
    const demo = JSON.parse(readFileSync(path.join(tpl.dir, d), "utf8"));
    assert.equal(validateScore(demo, lib).ok, true, d);
    assert.equal(demo.durationSec, 4);
    assert.ok(existsSync(path.join(ROOT, demo.input.video)));
    assert.equal(demo.input.audio, MUSIC);
  }
});

test("signal-cut is snappy by declaration: release default <= 0.07 s, a 0.12 s preset, no attack smoothing parameter", () => {
  const inputs = tpl.fx.INPUTS;
  const release = inputs.find((i) => i.NAME === "release");
  assert.ok(release.DEFAULT <= 0.07, `release default ${release.DEFAULT}`);
  const x = tpl.fx.X_AGENTVFX;
  const resolved = (p) => score(p).params?.release ?? release.DEFAULT;
  assert.ok(Object.keys(x.presets).some((p) => (x.presets[p].release ?? release.DEFAULT) === 0.12), "one preset releases at 0.12 s");
  assert.ok(resolved("lime") <= 0.07);
  assert.equal(inputs.some((i) => /attack|smooth|settle|lag|damp|inertia/iu.test(i.NAME)), false, "no attack or smoothing parameter");
  const pass0 = readFileSync(path.join(tpl.dir, "pass0.frag"), "utf8");
  assert.ok(/max\(target, held\)/u.test(pass0), "follower is max(target, held): instant attack");
});

test("signal-cut: the field cut lands on the beat frame and is gone within four frames", async () => {
  const { kept, features } = await frames(score("lime"), Array.from({ length: 70 }, (_, i) => i));
  const beat = features.meta.beats.find((b) => b >= 10 && b < 60);
  assert.ok(beat !== undefined, "a beat inside the window");
  const before = fieldShare(kept.get(beat - 1));
  const on = fieldShare(kept.get(beat));
  const later = fieldShare(kept.get(beat + 4));
  assert.ok(on > 0.25, `field colour covers the frame on the beat frame: ${on}`);
  assert.ok(before < on * 0.5, `no field colour the frame before: ${before}`);
  assert.ok(later < on * 0.5, `field cut dropped by half within four frames: ${on} -> ${later}`);
});

test("signal-cut: fieldCut 0 (the safe substitute) removes the cut but the slabs still move", async () => {
  const { kept, features } = await frames(score("lime", { params: { fieldCut: 0, stampFrames: 0 } }), Array.from({ length: 70 }, (_, i) => i));
  const beat = features.meta.beats.find((b) => b >= 10 && b < 60);
  assert.ok(fieldShare(kept.get(beat)) < 0.3, `no solid field without the cut: ${fieldShare(kept.get(beat)).toFixed(3)} at beat ${beat}`);
  let d = 0;
  for (let i = 0; i < W * H * 4; i++) d += Math.abs(kept.get(beat)[i] - kept.get(beat - 1)[i]);
  assert.ok(d / (W * H * 4) > 3, "frame still changes on the beat");
});

// slabContrast crushes green and blue on warm footage, so a hard scene cut in warm footage used to read as a
// saturated-red transition with the safe values on (the plate behind the live preview does exactly this).
test("signal-cut: hard cuts between warm and neutral footage never make a saturated-red transition", async () => {
  const clip = path.join(tmp, "warm-cuts.mp4");
  const lavfi = `color=c=0x8c453f:size=${W}x${H}:rate=30:d=1,format=yuv420p[a];color=c=0x303030:size=${W}x${H}:rate=30:d=1,format=yuv420p[b];[a][b]concat=n=2:v=1,loop=loop=3:size=60`;
  const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-filter_complex", lavfi, "-t", "4", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", clip], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  const v = validateScore({ version: 1, template: "signal-cut", preset: "lime", params: tpl.fx.X_AGENTVFX.safeSubstitute.params, input: { video: CLIP }, durationSec: 4, seed: 7, out: "t" }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const footage = openFootage(clip, { fps: 30, durationSec: 4, longEdge: W });
  const seq = [];
  try {
    await renderScore(v.value, lib, { outDir: mkdtempSync(path.join(tmp, "r-")), width: W, height: H, footage, replay: false, onFrame: (f, a) => { seq[f] = { width: W, height: H, data: Buffer.from(a.rgba) }; } });
  } finally {
    footage.close();
  }
  assert.equal(auditFlash(seq, { fps: 30 }).redFlashes, 0);
});

// The declared safe substitute is what the engine renders as film.safe.mp4. Before it also held the stamp, the
// idle/live dimming and the beat shifts, every preset still flashed 8+ times a second (orange also in red) and the
// engine withheld the safe film.
test("signal-cut: every preset passes the flash audit with the safe substitute (real clip and music)", async () => {
  const features = await analyzeAudio(path.join(ROOT, MUSIC), { fps: 30, durationSec: 5 });
  for (const preset of Object.keys(tpl.fx.X_AGENTVFX.presets)) {
    const v = validateScore({ version: 1, template: "signal-cut", preset, params: tpl.fx.X_AGENTVFX.safeSubstitute.params, input: { video: CLIP, audio: MUSIC }, durationSec: 5, seed: 7, out: "t" }, lib);
    assert.equal(v.ok, true, JSON.stringify(v.errors));
    const footage = openFootage(path.join(ROOT, CLIP), { fps: 30, durationSec: 5, longEdge: W });
    const seq = [];
    try {
      await renderScore(v.value, lib, { outDir: mkdtempSync(path.join(tmp, "s-")), width: W, height: H, footage, features, replay: false, onFrame: (f, a) => { seq[f] = { width: W, height: H, data: Buffer.from(a.rgba) }; } });
    } finally {
      footage.close();
    }
    const r = auditFlash(seq, { fps: 30 });
    assert.equal(r.exceeds, false, `${preset}: ${JSON.stringify(r.worstWindow)}`);
    assert.equal(r.redFlashes, 0, preset);
  }
});

// The field colour fills the frame on every beat in the stage film, so a saturated-red field colour makes every cut a red
// flash (orange at (1, 0.235, 0) gave 20 in 5 s). Each preset's field colour must sit below the auditor's red rule.
test("signal-cut: every preset's field colour is below the red-flash rule in linear light", () => {
  const def = tpl.fx.INPUTS.find((i) => i.NAME === "fieldColor").DEFAULT;
  for (const [preset, p] of Object.entries(tpl.fx.X_AGENTVFX.presets)) {
    const [r, g, b] = (p.fieldColor ?? def).slice(0, 3).map((c) => LINEAR_LUT[Math.round(c * 255)]);
    assert.ok(r / (r + g + b) < FLASH.redRatio, `${preset}: red share ${(r / (r + g + b)).toFixed(3)}`);
  }
});

// The stage film may strobe, but never in saturated red: the cut shows the raw footage for a frame or two between field
// states, and deep-red footage (a lit red dress in the test clip) then read as red flashes in the orange demo.
test("signal-cut: the orange stage demo on the real clip has no red flashes", async () => {
  const demo = JSON.parse(readFileSync(path.join(tpl.dir, "demo-orange.json"), "utf8"));
  const v = validateScore({ ...demo, durationSec: 4 }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const features = await analyzeAudio(path.join(ROOT, MUSIC), { fps: 30, durationSec: 4 });
  const footage = openFootage(path.join(ROOT, CLIP), { fps: 30, durationSec: 4, longEdge: W });
  const seq = [];
  try {
    await renderScore(v.value, lib, { outDir: mkdtempSync(path.join(tmp, "o-")), width: W, height: H, footage, features, replay: false, onFrame: (f, a) => { seq[f] = { width: W, height: H, data: Buffer.from(a.rgba) }; } });
  } finally {
    footage.close();
  }
  assert.equal(auditFlash(seq, { fps: 30 }).redFlashes, 0);
});
