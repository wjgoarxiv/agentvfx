// Task 13: glitch/retro family (rgb-split, block-glitch, vhs, pixel-sort). Render tests run at 320x180.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { runJob } from "../engine/node/job.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { openFootage } from "../engine/node/footage.mjs";

const lib = loadLibrary();
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const IDS = ["rgb-split", "block-glitch", "vhs", "pixel-sort"];
const W = 320;
const H = 180;
const STILL = `testsrc2=size=${W}x${H}:rate=30,trim=end_frame=1,loop=loop=-1:size=1`;

function makeClip(dir, lavfi) {
  const clip = path.join(dir, "in.mp4");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", lavfi, "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "8", clip], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return clip;
}
const score = (template, clip, params = {}, extra = {}) => {
  const v = validateScore({ version: 1, template, input: { video: clip }, params, durationSec: 3, seed: 7, out: "t", credit: { overlay: false }, ...extra }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
};

/** Render a score at 320x180 and keep the frames asked for. Returns { report, kept, shas, input }. */
async function render(sc, { frames = [0], features = null, replay = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-"));
  const first = openFootage(sc.input.video, { fps: sc.fps, durationSec: sc.durationSec, longEdge: W });
  const input = Buffer.from(await first.frame(0).finally(() => first.close()));
  const footage = openFootage(sc.input.video, { fps: sc.fps, durationSec: sc.durationSec, longEdge: W });
  const kept = new Map();
  const shas = [];
  try {
    const report = await renderScore(sc, lib, { outDir: dir, width: W, height: H, footage, features, replay, onFrame: (f, a) => { shas[f] = a.rgbaSha256; if (frames === "all" || frames.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
    return { report, kept, shas, input };
  } finally {
    footage.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
/** 48 kHz mono 16-bit WAV with a short decaying 2 kHz click at each time (seconds). */
function clickWav(times, seconds) {
  const sr = 48000;
  const data = Buffer.alloc(Math.floor(seconds * sr) * 2);
  for (const t of times) {
    for (let k = 0; k < 96; k++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 2000 * k) / sr) * Math.exp(-k / 24) * 0.9 * 32767), (Math.floor(t * sr) + k) * 2);
  }
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
  return Buffer.concat([head, data]);
}
const px = (buf, x, y, c = 0) => buf[(y * W + x) * 4 + c];
const lumaByte = (buf, x, y) => (px(buf, x, y, 0) + px(buf, x, y, 1) + px(buf, x, y, 2)) / 3;

test("the family ships four validated templates with presets, honest flash flags and a demo each", () => {
  for (const id of IDS) {
    const t = lib.get(id);
    assert.ok(t, `${id} is in the library`);
    assert.equal(t.family, "glitch");
    assert.deepEqual(validateTemplate(t.fx, id).errors, []);
    assert.ok(Object.keys(t.fx.X_AGENTVFX.presets).length >= 3);
    assert.ok(["none", "possible", "strobe"].includes(t.fx.X_AGENTVFX.flash));
    if (t.fx.X_AGENTVFX.flash === "strobe") assert.ok(t.fx.X_AGENTVFX.safeSubstitute, `${id} strobes, so it needs a safeSubstitute`);
    const demos = readdirSync(t.dir).filter((f) => /^demo-.*\.json$/u.test(f));
    assert.ok(demos.length >= 1, `${id} has a demo`);
    for (const d of demos) {
      const s = JSON.parse(readFileSync(path.join(t.dir, d), "utf8"));
      const v = validateScore(s, lib);
      assert.equal(v.ok, true, `${id}/${d}: ${JSON.stringify(v.errors)}`);
      assert.ok(existsSync(path.join(ROOT, s.input.video)), `${id}/${d}: footage exists`);
      assert.equal(s.durationSec, 4);
    }
  }
});

for (const id of IDS) {
  test(`${id}: renders every frame, passes the determinism replay and carries a flash report`, async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
    try {
      const clip = makeClip(tmp, `testsrc2=size=${W}x${H}:rate=30`);
      const out = path.join(tmp, "out");
      const gate = await runJob(score(id, clip), lib, { outDir: out, width: W, height: H, replay: true });
      assert.equal(gate.render.frames, 90);
      assert.equal(gate.determinism.pass, true);
      assert.equal(typeof gate.flash.flashesPerSecondMax, "number");
      assert.equal(typeof gate.flash.exceeds, "boolean");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}

test("pixel-sort: spans of a luma-threshold window come out monotonic; short spans are exactly sorted", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
  try {
    // Noise 60..200 with bright walls (255): 30-wide spans left of x=150, one long span 150..299.
    const clip = makeClip(tmp, "color=c=gray:size=320x180:rate=30,format=yuv420p,geq=lum='if(gte(X,300),255,if(lt(X,150),if(lt(mod(X,36),30),60+140*random(1),255),60+140*random(1)))':cb=128:cr=128,trim=end_frame=1,loop=loop=-1:size=1");
    const sc = score("pixel-sort", clip, { cellSize: 1, threshLo: 0.15, threshHi: 0.9, rowVar: 0, rowsFrac: 1, sweep: 0, cutJitter: 0, softness: 0, saturation: 1, punch: 1, stutterHz: 1 });
    const { kept, input } = await render(sc, { frames: [0, 40] });
    const lo = 0.15 * 255;
    const hi = 0.9 * 255;
    let rows = 0;
    let moved = 0;
    let total = 0;
    for (const f of [0, 40]) {
      const out = kept.get(f);
      for (let y = 0; y < H; y++) {
        const lum = Array.from({ length: W }, (_, x) => lumaByte(input, x, y));
        if (lum.some((v) => Math.abs(v - lo) <= 4 || Math.abs(v - hi) <= 4)) continue;
        rows += 1;
        const mask = lum.map((v) => v >= lo && v <= hi);
        for (let x = 0; x < W; ) {
          if (!mask[x]) {
            assert.ok(Math.abs(px(out, x, y) - lum[x]) <= 4, `walls are untouched at ${x},${y}`);
            x += 1;
            continue;
          }
          let e = x;
          while (e + 1 < W && mask[e + 1] && (e + 1) % 256 !== 0) e += 1;
          const span = lum.slice(x, e + 1);
          const got = span.map((_, k) => px(out, x + k, y));
          for (let k = 1; k < got.length; k++) assert.ok(got[k] >= got[k - 1] - 3, `monotonic in span ${x}..${e} row ${y}: ${got[k - 1]} then ${got[k]}`);
          if (span.length <= 32) {
            const sorted = [...span].sort((a, b) => a - b);
            sorted.forEach((v, k) => assert.ok(Math.abs(v - got[k]) <= 4, `short span ${x}..${e} row ${y} is the exact sorted multiset`));
          }
          span.forEach((v, k) => { total += 1; if (Math.abs(v - got[k]) > 8) moved += 1; });
          x = e + 1;
        }
      }
    }
    assert.ok(rows >= 200, `tested ${rows} rows`);
    assert.ok(moved / total > 0.5, `sorting moved ${(100 * moved / total).toFixed(0)}% of span pixels`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pixel-sort: vertical axis with descend sorts columns brightest first", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
  try {
    const clip = makeClip(tmp, "color=c=gray:size=320x180:rate=30,format=yuv420p,geq=lum='60+140*random(1)':cb=128:cr=128,trim=end_frame=1,loop=loop=-1:size=1");
    const sc = score("pixel-sort", clip, { sortAxis: 1, descend: true, cellSize: 1, threshLo: 0.1, threshHi: 0.95, rowVar: 0, rowsFrac: 1, sweep: 0, cutJitter: 0, softness: 0, saturation: 1, punch: 1 });
    const { kept } = await render(sc);
    const out = kept.get(0);
    for (let x = 0; x < W; x += 7) for (let y = 1; y < H; y++) assert.ok(px(out, x, y) <= px(out, x, y - 1) + 3, `column ${x} descends at row ${y}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("block-glitch: same seed renders byte-identical frames twice; each burst gets its own pattern", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
  try {
    const clip = makeClip(tmp, STILL);
    const sc = score("block-glitch", clip, { burstProb: 1, burstRate: 2.5, burstFrames: 8, holdFrames: 2, grain: 0 });
    const a = await render(sc, { frames: "all" });
    const b = await render(sc, { frames: "all" });
    assert.deepEqual(a.shas, b.shas, "two renders with one seed are byte-identical");
    const other = await render(score("block-glitch", clip, { burstProb: 1, burstRate: 2.5, burstFrames: 8, holdFrames: 2, grain: 0 }, { seed: 8 }), { frames: [1, 2] });
    // The output dither differs per frame index, so "same pattern" means a tiny mean difference, not equal bytes.
    const diff = (x, y) => x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0) / x.length;
    assert.ok(diff(other.kept.get(1), a.kept.get(1)) > 6, "another seed gives another pattern");
    // burst period 12 frames: bursts start at 0, 12, 24, 36 ...; the first frame of each burst differs
    const firsts = [0, 12, 24, 36, 48].map((f) => a.kept.get(f));
    for (let i = 0; i < firsts.length; i++) for (let j = i + 1; j < firsts.length; j++) assert.ok(diff(firsts[i], firsts[j]) > 6, `burst ${i} and ${j} differ (the seed advances per burst)`);
    assert.ok(diff(a.kept.get(0), a.kept.get(2)) > 6, "the pattern re-seeds inside a burst (holdFrames)");
    assert.ok(diff(a.kept.get(0), a.kept.get(1)) < 2, "and is held between re-seeds");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("block-glitch: lockMode onset starts a burst on every detected onset and stays clean between them", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
  try {
    const clip = makeClip(tmp, STILL);
    const music = path.join(tmp, "clicks.wav");
    writeFileSync(music, clickWav([0.4, 1.3, 2.2], 3.2));
    const features = await analyzeAudio(music, { fps: 30 });
    const onsets = features.meta.onsets.filter((f) => f < 85);
    assert.ok(onsets.length >= 2 && onsets.length <= 4, `three clicks give about three onsets (${onsets.length})`);
    const sc = score("block-glitch", clip, { lockMode: 1, burstProb: 1, burstFrames: 7, density: 0.5, idleDensity: 0, grain: 0, fringe: 0, saturation: 1, punch: 1, joltAmt: 0 }, { input: { video: clip, audio: music } });
    const { kept, input } = await render(sc, { frames: "all", features });
    const changed = (f) => {
      let n = 0;
      for (let i = 0; i < W * H; i += 5) if (Math.abs(kept.get(f)[i * 4 + 1] - input[i * 4 + 1]) > 20) n += 1;
      return n / (W * H / 5);
    };
    for (const o of onsets) assert.ok(changed(o + 1) > 0.05, `burst at onset ${o}: ${changed(o + 1).toFixed(3)}`);
    const quiet = [...Array(85).keys()].filter((f) => f < onsets[0] || onsets.every((o) => f > o + 8 || f < o));
    assert.ok(quiet.length > 5);
    for (const f of quiet) assert.ok(changed(f) < 0.01, `frame ${f} between bursts stays clean: ${changed(f).toFixed(3)}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

const BAR = `color=c=black:size=${W}x${H}:rate=30,format=yuv420p,drawbox=x=158:y=0:w=4:h=${H}:color=white:t=fill,drawbox=x=58:y=0:w=4:h=${H}:color=white:t=fill,drawbox=x=258:y=0:w=4:h=${H}:color=white:t=fill`;
const centroid = (buf, y, c, x0, x1) => {
  let s = 0;
  let m = 0;
  for (let x = x0; x < x1; x++) {
    s += x * px(buf, x, y, c);
    m += px(buf, x, y, c);
  }
  return s / Math.max(m, 1);
};
const calm = { burstProb: 0, jitter: 0, tear: 0, scanlines: 0, grain: 0, punch: 1, saturation: 1, splitAmount: 120, splitTaps: 3 };

test("rgb-split: red and blue copies of a white bar sit splitAmount apart; radial mode splits outward", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
  try {
    const clip = makeClip(tmp, BAR);
    const axis = (await render(score("rgb-split", clip, calm))).kept.get(0);
    const sep = centroid(axis, 90, 0, 120, 200) - centroid(axis, 90, 2, 120, 200);
    assert.ok(Math.abs(Math.abs(sep) - 40) < 6, `axis split ${sep.toFixed(1)} px (expected 40)`);
    const rad = (await render(score("rgb-split", clip, { ...calm, splitMode: 1 }))).kept.get(0);
    const left = centroid(rad, 90, 0, 20, 100) - centroid(rad, 90, 2, 20, 100);
    const right = centroid(rad, 90, 0, 220, 300) - centroid(rad, 90, 2, 220, 300);
    assert.ok(left * right < 0 && Math.abs(left) > 8 && Math.abs(right) > 8, `radial split flips sign across the centre (${left.toFixed(1)} / ${right.toFixed(1)})`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("vhs: chroma bleeds past a red box edge, bottom rows skew (head switching), scanlines modulate brightness", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-glitch-src-"));
  try {
    const clip = makeClip(tmp, `color=c=0x808080:size=${W}x${H}:rate=30,format=yuv420p,drawbox=x=100:y=20:w=60:h=100:color=red:t=fill,drawbox=x=200:y=0:w=6:h=${H}:color=white:t=fill`);
    const base = { trackAmount: 0, wobble: 0, dropouts: 0, tapeNoise: 0, flicker: 0, chromaNoise: 0, lumaBlur: 0.05, ringing: 0, scanlines: 0, headSwitch: 0, saturation: 1 };
    const redness = (buf, x, y) => px(buf, x, y, 0) - px(buf, x, y, 2);
    const sharp = (await render(score("vhs", clip, { ...base, chromaBleed: 0 }))).kept.get(0);
    const bleed = (await render(score("vhs", clip, { ...base, chromaBleed: 80 }))).kept.get(0);
    assert.ok(redness(bleed, 164, 70) > redness(sharp, 164, 70) + 25, `chroma smears right of the box: ${redness(sharp, 164, 70)} -> ${redness(bleed, 164, 70)}`);
    const skew = (await render(score("vhs", clip, { ...base, chromaBleed: 0, headSwitch: 1, headHeight: 0.1 }))).kept.get(0);
    const rowsDiff = (a, b, y0, y1) => {
      let s = 0;
      for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) s += Math.abs(lumaByte(a, x, y) - lumaByte(b, x, y));
      return s / ((y1 - y0) * W);
    };
    assert.ok(rowsDiff(skew, sharp, H - 8, H) > 20, "the bottom rows are skewed and noisy");
    assert.ok(rowsDiff(skew, sharp, 20, 120) < 3, "and the rest of the frame is untouched");
    const lined = (await render(score("vhs", clip, { ...base, chromaBleed: 0, scanlines: 1 }))).kept.get(0);
    let dark = 0;
    for (let y = 20; y < 120; y++) dark = Math.max(dark, Math.abs(lumaByte(lined, 20, y) - lumaByte(sharp, 20, y)));
    assert.ok(dark > 25, `scanlines darken rows by up to ${dark.toFixed(0)}/255`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
