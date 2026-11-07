// Spectrum family (plan task 9): validation of every preset, render + determinism + flash report per
// template, the 440 Hz column test, silence at the floor, and onset following on the demo beat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { runJob } from "../engine/node/job.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC = "test-media/beat-132.mp3";
const lib = loadLibrary();
const IDS = ["bars-linear", "bars-mirror", "spectrum-radial", "waveform-line", "spectrum-particles", "label-bars", "bass-circle"];
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-spectrum-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let runs = 0;

function wav(file, fn, seconds = 3.2) {
  const sr = 48000;
  const n = Math.floor(seconds * sr);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, fn(i / sr))) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(sr, 24);
  head.writeUInt32LE(sr * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([head, data]));
  return file;
}

function score(template, preset, extra = {}) {
  const s = { version: 1, template, ...(preset ? { preset } : {}), input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t", ...extra };
  const v = validateScore(s, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
}

async function frames(template, preset, extra, audioPath, keep, [w, h] = [640, 360]) {
  const features = await analyzeAudio(path.resolve(ROOT, audioPath), { fps: 30 });
  const kept = new Map();
  await renderScore(score(template, preset, extra), lib, { outDir: path.join(tmp, `${template}-${runs++}`), width: w, height: h, features, replay: false, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  return { kept, features };
}

const lit = (rgba, w, x, y, min = 380) => { const o = (y * w + x) * 4; return rgba[o] + rgba[o + 1] + rgba[o + 2] > min; };
const meanLuma = (rgba) => { let s = 0; for (let i = 0; i < rgba.length; i += 4) s += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 765; return s / (rgba.length / 4); };

/** Height in pixels of the hairline bar of each column of bars-linear (displayMode 2): the lit run up from the plot floor. */
function barHeights(rgba, w, h, n) {
  const base = Math.round(h - 0.21 * h) - 1;
  return Array.from({ length: n }, (_, i) => {
    const cx = Math.round(0.16 * w + ((0.78 * w) * (i + 0.5)) / n);
    return Math.max(...[-1, 0, 1].map((dx) => {
      let run = 0;
      while (base - run > 0 && lit(rgba, w, cx + dx, base - run, 200)) run += 1;
      return run;
    }));
  });
}
const BARE = { fieldAmount: 0, grain: 0, vignette: 0, kickZoom: 0, shake: 0, introMs: 0 };
const PLAIN = { ...BARE, displayMode: 2, gridAmount: 0, marks: false, areaFill: 0, scanCursor: false, glow: 0, bandCount: 40 };

test("every preset of every spectrum template validates", () => {
  for (const id of IDS) {
    const tpl = lib.get(id);
    assert.ok(tpl, `${id} is in the library`);
    assert.equal(tpl.family, "spectrum");
    assert.ok(Object.keys(tpl.fx.X_AGENTVFX.presets).length >= 3, `${id} has at least 3 presets`);
    assert.ok(["none", "possible", "strobe"].includes(tpl.fx.X_AGENTVFX.flash));
    for (const preset of Object.keys(tpl.fx.X_AGENTVFX.presets)) score(id, preset);
    const demos = readdirSync(tpl.dir).filter((f) => f.startsWith("demo-"));
    assert.ok(demos.length >= 1, `${id} has a demo score`);
    for (const d of demos) {
      const v = validateScore(JSON.parse(readFileSync(path.join(tpl.dir, d), "utf8")), lib);
      assert.equal(v.ok, true, `${d}: ${JSON.stringify(v.errors)}`);
    }
  }
});

for (const id of IDS) {
  test(`${id}: demo renders every frame with audio, passes determinism, reports flashes`, async () => {
    const tpl = lib.get(id);
    const demo = JSON.parse(readFileSync(path.join(tpl.dir, readdirSync(tpl.dir).filter((f) => f.startsWith("demo-")).sort()[0]), "utf8"));
    const s = validateScore({ ...demo, durationSec: 3, out: "t" }, lib).value;
    const dir = path.join(tmp, `job-${id}`);
    const gate = await runJob(s, lib, { outDir: dir, width: 320, height: 180, cwd: ROOT });
    assert.equal(gate.render.frames, 90);
    assert.equal(gate.determinism.pass, true, JSON.stringify(gate.determinism));
    assert.equal(typeof gate.flash.exceeds, "boolean");
    assert.equal(typeof gate.flash.flashesPerSecondMax, "number");
    assert.ok(existsSync(path.join(dir, "features.json")));
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path.join(dir, "film.mp4")], { encoding: "utf8" });
    assert.match(probe.stdout, /audio/u);
  });

  test(`${id}: silent input renders at its floor without black or white frames`, async () => {
    const silence = wav(path.join(tmp, "silence.wav"), () => 0);
    const { kept } = await frames(id, null, {}, silence, [0, 45, 89], [320, 180]);
    for (const [f, rgba] of kept) {
      const m = meanLuma(rgba);
      assert.ok(m > 0.0005 && m < 0.9, `${id} frame ${f} mean luma ${m}`);
    }
  });
}

test("bars-linear: a 440 Hz sine lights the 440 Hz column (+-1 bar); silence stays at the floor", async () => {
  const sine = wav(path.join(tmp, "sine.wav"), (t) => 0.3 * Math.sin(2 * Math.PI * 440 * t));
  const silence = wav(path.join(tmp, "silence2.wav"), () => 0);
  const [w, h, n] = [640, 360, 40];
  const loud = barHeights((await frames("bars-linear", "graph-black", { params: PLAIN }, sine, [60])).kept.get(60), w, h, n);
  const max = Math.max(...loud);
  assert.ok(max > 0.1 * h, `peak bar ${max}px`);
  const tops = loud.flatMap((v, i) => (v === max ? [i] : []));
  const expected = Math.floor(((440 - 20) / (1200 - 20)) ** (1 / 2.2) * n);
  const centre = tops.reduce((a, b) => a + b, 0) / tops.length;
  assert.ok(Math.abs(centre - expected) <= 1, `brightest bar ${centre} vs expected ${expected} (tops ${tops})`);
  const quiet = barHeights((await frames("bars-linear", "graph-black", { params: PLAIN }, silence, [60])).kept.get(60), w, h, n);
  assert.ok(Math.max(...quiet) <= 4, `floor ${Math.max(...quiet)}px`);
});

test("beat-132: bass onsets raise the low bars, and bars-mirror inverts on strong hits", async () => {
  const { kept, features } = await frames("bars-linear", "graph-black", { params: PLAIN }, MUSIC, Array.from({ length: 90 }, (_, i) => i));
  const onsets = features.meta.onsets.filter((o) => o >= 3 && o < 85 && features.frames[o].bass > 2);
  assert.ok(onsets.length >= 5, `bass onsets ${onsets.length}`);
  const low = (f) => barHeights(kept.get(f), 640, 360, 40).slice(0, 8).reduce((a, b) => a + b, 0);
  const rises = onsets.filter((o) => low(o + 2) > low(o - 2)).length;
  assert.ok(rises / onsets.length >= 0.6, `${rises} of ${onsets.length} bass onsets raised the low bars`);
  const strong = features.meta.onsets.find((o) => o >= 3 && o < 85 && features.frames[o].flux >= 0.9);
  assert.ok(strong !== undefined);
  const m = await frames("bars-mirror", "field-acid", { params: BARE }, MUSIC, [strong - 1, strong + 1], [320, 180]);
  assert.ok(Math.abs(meanLuma(m.kept.get(strong + 1)) - meanLuma(m.kept.get(strong - 1))) > 0.15, "field and ink swap on the hit");
});

test("spectrum-particles: nothing above the bars before the first hit, sparks after it", async () => {
  const { kept, features } = await frames("spectrum-particles", "cloud-black", { params: { ...BARE, gridAmount: 0, marks: false } }, MUSIC, Array.from({ length: 60 }, (_, i) => i), [640, 360]);
  const hit = features.meta.onsets.find((o) => o >= 2 && features.frames[o].flux >= 0.7);
  const topLit = (f) => { let c = 0; for (let y = 72; y < 216; y++) for (let x = 110; x < 580; x++) if (lit(kept.get(f), 640, x, y)) c += 1; return c; };
  assert.equal(topLit(Math.max(hit - 1, 0)), 0);
  const after = Math.max(...[8, 11, 14, 17, 20].map((d) => topLit(hit + d)));
  assert.ok(after > 20, `sparks in the top band after the hit: ${after}`);
});

test("bass-circle: the outlines grow on a strong kick; label-bars draws 63 bars by default", async () => {
  assert.equal(lib.get("label-bars").fx.INPUTS.find((i) => i.NAME === "bandCount").DEFAULT, 63);
  const { kept, features } = await frames("bass-circle", "bracket-black", { params: { ...BARE, marks: false, gridAmount: 0, coneAmount: 0 } }, MUSIC, Array.from({ length: 50 }, (_, i) => i), [640, 360]);
  const kick = features.meta.onsets.find((o) => o >= 12 && o < 45 && features.frames[o].bass > 5);
  assert.ok(kick !== undefined, "a strong kick exists in the first 1.5 s");
  const ink = (f) => { let c = 0; const a = kept.get(f); for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] > 380) c += 1; return c; };
  assert.ok(ink(kick + 3) > ink(kick - 6) * 1.15, `outline ink ${ink(kick - 6)} -> ${ink(kick + 3)} pixels`);
});
