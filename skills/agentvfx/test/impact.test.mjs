import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { runJob } from "../engine/node/job.mjs";
import { findFfmpeg } from "../engine/node/encode.mjs";
import { openFootage } from "../engine/node/footage.mjs";

const lib = loadLibrary();
const W = 320;
const H = 180;
const SR = 48000;
const IDS = ["impact-invert", "impact-1bit", "punch-shake", "rgb-hit", "speedline-burst", "strobe-burst"];
const FLASHING = { "impact-invert": "possible", "impact-1bit": "possible", "speedline-burst": "possible", "strobe-burst": "strobe" };
let tmp;
let clip;
let click;
let calm;
let baseFrames;

function wav(seconds, times) {
  const n = Math.floor(seconds * SR);
  const data = Buffer.alloc(n * 4);
  for (const c of times) {
    for (let k = 0; k < 96 && Math.floor(c * SR) + k < n; k++) {
      const v = Math.round(Math.sin((2 * Math.PI * 2000 * k) / SR) * Math.exp(-k / 24) * 0.9 * 32767);
      const o = (Math.floor(c * SR) + k) * 4;
      data.writeInt16LE(v, o);
      data.writeInt16LE(v, o + 2);
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const score = (hits, extra = {}) => {
  const v = validateScore({ version: 1, template: "sacred", params: { blend: 0 }, input: { video: clip }, durationSec: 3, seed: 5, hits, out: "t", credit: { overlay: false }, ...extra }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
};

async function frames(sc, keep, audio = null) {
  const footage = openFootage(clip, { fps: 30, durationSec: sc.durationSec, longEdge: W });
  const kept = new Map();
  const dir = mkdtempSync(path.join(tmp, "r-"));
  try {
    await renderScore(sc, lib, { outDir: dir, width: W, height: H, footage, replay: false, features: audio, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  } finally {
    footage.close();
  }
  return kept;
}

function diff(a, b, ch = [0, 1, 2]) {
  let s = 0;
  for (let i = 0; i < W * H; i++) for (const c of ch) s += Math.abs(a[i * 4 + c] - b[i * 4 + c]);
  return s / (W * H * ch.length);
}
const same = (a, b) => diff(a, b) === 0;

function lumaPerFrame(film) {
  const r = spawnSync(findFfmpeg(), ["-v", "error", "-i", film, "-vf", "scale=16:9:flags=area,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 });
  assert.equal(r.status, 0, r.stderr?.toString());
  const out = [];
  for (let f = 0; f * 144 < r.stdout.length; f++) out.push(r.stdout.subarray(f * 144, f * 144 + 144).reduce((s, v) => s + v, 0) / 144);
  return out;
}

before(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-impact-"));
  clip = path.join(tmp, "in.mp4");
  const r = spawnSync(findFfmpeg(), ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${W}x${H}:rate=30`, "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", clip], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  calm = path.join(tmp, "calm.mp4");
  const g = spawnSync(findFfmpeg(), ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x3a4048:size=${W}x${H}:rate=30`, "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", calm], { encoding: "utf8" });
  assert.equal(g.status, 0, g.stderr);
  click = path.join(tmp, "click-240.wav");
  writeFileSync(click, wav(4, Array.from({ length: 15 }, (_, k) => k * 0.25)));
  baseFrames = await frames(score([]), Array.from({ length: 90 }, (_, i) => i));
});
after(() => rmSync(tmp, { recursive: true, force: true }));

describe("impact family library contract", () => {
  for (const id of IDS) {
    it(`${id}: declared honestly, 3+ presets, safe substitute for flashing templates, demo validates`, () => {
      const t = lib.get(id);
      assert.ok(t, `${id} missing from the library`);
      assert.equal(t.family, "impact");
      assert.ok(Object.keys(t.fx.X_AGENTVFX.presets).length >= 3);
      assert.equal(t.fx.X_AGENTVFX.flash, FLASHING[id] ?? "none");
      if (FLASHING[id]) {
        const sub = t.fx.X_AGENTVFX.safeSubstitute;
        assert.ok(sub, `${id} needs safeSubstitute`);
        if (sub.template) assert.equal(lib.get(sub.template).fx.X_AGENTVFX.flash, "none");
        else assert.ok(sub.params && sub.params.pulses === 1 && sub.params.level <= 0.09, "params-only substitute must be a single low-level pulse");
      }
      for (const preset of Object.keys(t.fx.X_AGENTVFX.presets)) score([{ t: 1, template: id, preset, durationFrames: 6 }]);
    });
  }
});

describe("hit behaviour at frame level (hit at frame 30)", () => {
  const run = async (id, preset, durationFrames, params, keep) => frames(score([{ t: 1, template: id, preset, params, durationFrames }]), keep);

  it("impact-invert: hard negative, chunky (no blended pixels) while decaying, clean after", async () => {
    const k = await run("impact-invert", "invert-snap", 4, { hitFrames: 4, holdFrames: 1, decayCurve: 1 }, [29, 30, 31, 34]);
    assert.ok(same(k.get(29), baseFrames.get(29)));
    assert.ok(diff(k.get(30), baseFrames.get(30)) > 60, "frame 30 is a hard negative");
    const a = k.get(31);
    const b = baseFrames.get(31);
    let changed = 0;
    let acc = 0;
    for (let i = 0; i < W * H; i++) {
      const d = Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2]);
      if (d > 6) { changed += 1; acc += d; }
    }
    const frac = changed / (W * H);
    assert.ok(frac > 0.2 && frac < 0.95, `decay frame changes ${(frac * 100).toFixed(0)}% of pixels`);
    assert.ok(acc / changed / 3 > 40, "changed pixels are fully inverted, not a milky mix");
    assert.ok(same(k.get(34), baseFrames.get(34)), "clean frame after the hit");
  });

  it("impact-1bit: two flat colours only, clean after the hit", async () => {
    const k = await run("impact-1bit", "onebit-hard", 3, { hitFrames: 3, holdFrames: 2 }, [30, 33]);
    const f = k.get(30);
    let flat = 0;
    for (let i = 0; i < W * H; i++) if ([0, 1, 2].every((c) => f[i * 4 + c] <= 8) || [0, 1, 2].every((c) => f[i * 4 + c] >= 247)) flat += 1;
    assert.ok(flat / (W * H) > 0.99, `${((flat / (W * H)) * 100).toFixed(1)}% pure black or white`);
    assert.ok(same(k.get(33), baseFrames.get(33)));
  });

  it("punch-shake: scales and shakes the frame, decays, clean after hitFrames", async () => {
    const k = await run("punch-shake", "punch-hard", 6, {}, [29, 30, 32, 35, 36]);
    assert.ok(same(k.get(29), baseFrames.get(29)));
    const d0 = diff(k.get(30), baseFrames.get(30));
    assert.ok(d0 > 15, `punch frame differs by ${d0.toFixed(1)}`);
    assert.ok(diff(k.get(35), baseFrames.get(35)) < d0, "decays");
    assert.ok(same(k.get(36), baseFrames.get(36)));
  });

  it("rgb-hit: only red and blue move, green untouched, back to clean", async () => {
    const k = await run("rgb-hit", "rgb-slam", 6, { tearRows: 0, pop: 1, hitFrames: 6 }, [30, 36]);
    const a = k.get(30);
    const b = baseFrames.get(30);
    assert.ok(diff(a, b, [1]) <= 1, "green channel unchanged");
    assert.ok(diff(a, b, [0]) > 4 && diff(a, b, [2]) > 4, "red and blue are displaced");
    assert.ok(same(k.get(36), baseFrames.get(36)));
  });

  it("speedline-burst: hard white core at the centre, lines reach the edge, clean after", async () => {
    const k = await run("speedline-burst", "speed-white", 5, {}, [30, 35]);
    const f = k.get(30);
    const o = ((H >> 1) * W + (W >> 1)) * 4;
    assert.deepEqual([f[o], f[o + 1], f[o + 2]], [255, 255, 255]);
    assert.ok(diff(f, baseFrames.get(30)) > 20);
    assert.ok(same(k.get(35), baseFrames.get(35)));
  });
});

describe("strobe-burst: 240 BPM grid, stage and safe variant", () => {
  const P = { tempo: 240, division: 16, pulses: 8, duty: 0.5, offDim: 0.35 };
  const period = (60 / 240 * 4) / 16 * 30;
  const litAt = (n) => {
    const p = Math.floor(n / period + 1e-4);
    return p < P.pulses && n - p * period < Math.max(1, Math.floor(period * P.duty + 0.5)) - 1e-4;
  };
  const sc = () => score([], { input: { video: clip, audio: click }, durationSec: 4 });

  it("stage mode renders every scheduled flash on the detected beats, writes SAFETY.txt", async () => {
    const dir = mkdtempSync(path.join(tmp, "job-"));
    const probe = await runJob({ ...sc(), hits: [] }, lib, { outDir: dir, width: 160, height: 90, replay: false });
    const beats = JSON.parse(readFileSync(path.join(dir, "features.json"), "utf8")).meta.beats;
    assert.ok(beats.length >= 4, `only ${beats.length} beats detected`);
    for (const b of beats) assert.ok(Array.from({ length: 16 }, (_, k) => Math.round(k * 7.5)).some((c) => Math.abs(c - b) <= 1), `beat ${b} is not on the 240 BPM clicks`);
    assert.equal(probe.ok, true);
    const hitLen = 8;
    const run = await runJob(score(beats.map((b) => ({ beat: beats.indexOf(b), template: "strobe-burst", params: P, durationFrames: hitLen })), { input: { video: clip, audio: click }, durationSec: 4 }), lib, { outDir: dir, width: W, height: H, replay: false });
    const lum = lumaPerFrame(run.render.film);
    for (const b of beats) {
      if (b + hitLen > lum.length) continue;
      assert.ok(lum[b] > 240, `hit at beat ${b} is not a full white frame (${lum[b].toFixed(0)})`);
      for (let n = 0; n < hitLen; n++) {
        if (litAt(n)) assert.ok(lum[b + n] > 240, `scheduled flash at beat ${b}+${n} missing (${lum[b + n].toFixed(0)})`);
        else assert.ok(lum[b + n] < 240, `frame ${b + n} should be between flashes`);
      }
    }
    assert.ok(existsSync(path.join(dir, "SAFETY.txt")), "SAFETY.txt written in stage mode");
    assert.equal(run.flash.exceeds, true);
  });

  it("safeVariant: film.safe.mp4 stays within the flash limits", async () => {
    const hits = Array.from({ length: 16 }, (_, k) => ({ t: k * 0.25, template: "strobe-burst", params: { tempo: 240, division: 16 }, durationFrames: 2 }));
    const dir = mkdtempSync(path.join(tmp, "job-"));
    const run = await runJob(score(hits, { input: { video: calm, audio: click }, durationSec: 4, safety: { mode: "stage", safeVariant: true } }), lib, { outDir: dir, width: W, height: H, replay: false });
    assert.equal(run.flash.exceeds, true, "the stage master flashes too much by design");
    assert.ok(run.safeVariant, "safe variant rendered");
    assert.equal(run.safeVariant.flash.exceeds, false, JSON.stringify(run.safeVariant.flash));
    assert.ok(existsSync(path.join(dir, "film.safe.mp4")));
    assert.ok(run.safeVariant.substitutions.length > 0, "over-rate hits were substituted");
  });
});

describe("every impact template renders, replays deterministically, reports flashes", () => {
  for (const id of IDS) {
    it(id, async () => {
      const dir = mkdtempSync(path.join(tmp, "job-"));
      const preset = Object.keys(lib.get(id).fx.X_AGENTVFX.presets)[0];
      const run = await runJob(score([{ t: 1, template: id, preset, durationFrames: 6 }]), lib, { outDir: dir, width: W, height: H, replay: true });
      assert.equal(run.render.frames, 90);
      assert.equal(run.determinism.pass, true);
      assert.ok(run.flash && typeof run.flash.exceeds === "boolean", "flash report present");
    });
  }
});
