// Task 10 (scope family): xy-phosphor, goniometer, scope-triggered, spectrogram-scroll, scope-polar.
// Synthetic WAVs are generated in os.tmpdir() and removed afterwards; renders are small (480x270 / 320x180).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { runJob } from "../engine/node/job.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const lib = loadLibrary();
const IDS = ["scope-triggered", "xy-phosphor", "goniometer", "spectrogram-scroll", "scope-polar"];
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-scope-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

function wav(name, fn, seconds = 4, sr = 48000) {
  const n = seconds * sr;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const [l, r] = fn(i / sr);
    data.writeInt16LE(Math.round(l * 32767), i * 4);
    data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  const file = path.join(tmp, name);
  writeFileSync(file, Buffer.concat([h, data]));
  return file;
}
const sine = (hz, a = 0.5) => (t) => { const v = a * Math.sin(2 * Math.PI * hz * t); return [v, v]; };

/** Render a score at W x H and keep the RGBA of the listed frames. */
async function render(score, { audio = null, W = 480, H = 270, frames = [] } = {}) {
  const v = validateScore({ version: 1, durationSec: 3, seed: 5, out: "t", credit: { overlay: false }, ...score }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const features = audio ? await analyzeAudio(audio, { fps: v.value.fps, durationSec: 3 }) : null;
  const kept = new Map();
  const dir = mkdtempSync(path.join(tmp, "r-"));
  const report = await renderScore(v.value, lib, { outDir: dir, width: W, height: H, features, replay: false, onFrame: (f, a) => { if (frames.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  rmSync(dir, { recursive: true, force: true });
  return { report, kept, W, H };
}

const px = (img, W, x, y) => { const o = (y * W + x) * 4; return [img[o], img[o + 1], img[o + 2]]; };
const peak = (c) => Math.max(c[0], c[1], c[2]);
const BARE = { hud: 0, bloom: 0, persistence: 0.5 };
const BARE_TRACE = { hud: 0, bloom: 0, persist: 0 };
const PRESETS = ["hud-black", "field-lime", "field-ultramarine", "boot-green", "glow-phosphor"];

function bbox(img, W, H, thr = 128) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (peak(px(img, W, x, y)) >= thr) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, n, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Number of background pixels inside the figure that the outside cannot reach (4-connected, mask dilated by 1 px). */
function enclosedArea(img, W, H, thr = 90) {
  const on = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (peak(px(img, W, x, y)) >= thr) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) on[yy * W + xx] = 1; }
  const seen = new Uint8Array(W * H);
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || on[ny * W + nx]) continue;
      seen[ny * W + nx] = 1;
      stack.push(ny * W + nx);
    }
  }
  let enclosed = 0;
  for (let i = 0; i < W * H; i++) if (!on[i] && !seen[i]) enclosed++;
  return enclosed;
}

test("all five templates are valid, licensed, 60 fps, 3+ presets, honest flash and safeSubstitute; every demo score validates", () => {
  for (const id of IDS) {
    const t = lib.get(id);
    assert.ok(t, `${id} missing from the library`);
    const v = validateTemplate(t.fx, t.rel);
    assert.equal(v.ok, true, `${id}: ${JSON.stringify(v.errors)}`);
    const x = t.fx.X_AGENTVFX;
    assert.equal(x.family, "scope");
    assert.equal(x.fps, 60);
    assert.equal(x.spdx, "LicenseRef-agentvfx");
    assert.ok(Object.keys(x.presets).length >= 3, `${id} presets`);
    for (const p of PRESETS) assert.ok(x.presets[p], `${id} lacks the ${p} preset`);
    assert.ok(Array.isArray(x.text) && x.text.length >= 20, `${id} should label its panels with engine text`);
    assert.ok(t.fx.INPUTS.some((i) => i.NAME === "fieldMode"), `${id} lacks fieldMode`);
    assert.equal(t.fx.INPUTS.find((i) => i.NAME === "hud").DEFAULT, 1, `${id}: the HUD look must be the default`);
    assert.ok(t.fx.INPUTS.find((i) => i.NAME === "bloom").DEFAULT <= 0.4, `${id}: default bloom must be subtle`);
    if (x.flash !== "none") assert.ok(x.safeSubstitute, `${id} flashes but has no safeSubstitute`);
    const demos = readdirSync(t.dir).filter((f) => /^demo-.*\.json$/u.test(f));
    assert.ok(demos.length >= 1, `${id} has no demo`);
    for (const d of demos) {
      const score = JSON.parse(readFileSync(path.join(t.dir, d), "utf8"));
      const r = validateScore(score, lib);
      assert.equal(r.ok, true, `${id}/${d}: ${JSON.stringify(r.errors)}`);
      assert.equal(score.durationSec, 4);
    }
  }
});

test("xy-phosphor: a 3:2 Lissajous test signal draws a closed figure centred within 2% of the frame", async () => {
  const { kept, W, H } = await render({ template: "xy-phosphor", preset: "hud-black", params: BARE }, { frames: [40, 100, 170] });
  for (const f of [40, 100, 170]) {
    const b = bbox(kept.get(f), W, H);
    assert.ok(b.n > 200, `frame ${f}: figure missing (${b.n} bright px)`);
    assert.ok(Math.abs(b.cx - W / 2) <= 0.02 * W, `frame ${f}: x centre ${b.cx} vs ${W / 2}`);
    assert.ok(Math.abs(b.cy - H / 2) <= 0.02 * H, `frame ${f}: y centre ${b.cy} vs ${H / 2}`);
    assert.ok(b.h > 0.6 * H && b.w > 0.6 * H, `frame ${f}: figure too small ${b.w}x${b.h}`);
    assert.ok(enclosedArea(kept.get(f), W, H) > 100, `frame ${f}: the figure is not closed (no enclosed region)`);
  }
});

function crossings(img, W, H) {
  const c = [];
  for (let x = 0; x < W; x++) {
    let sw = 0, sy = 0;
    for (let y = 0; y < H; y++) { const g = px(img, W, x, y)[1]; if (g > 60) { sw += g; sy += g * (H - 1 - y + 0.5); } }
    c.push(sw > 0 ? sy / sw : null);
  }
  const out = [];
  for (let x = 0; x + 1 < W; x++) {
    if (c[x] === null || c[x + 1] === null) continue;
    const a = c[x] - H / 2, b = c[x + 1] - H / 2;
    if (a < 0 && b >= 0) out.push({ x: x + 0.5 + -a / (b - a), dir: 1 });
    if (a >= 0 && b < 0) out.push({ x: x + 0.5 + a / (a - b), dir: -1 });
  }
  return out;
}

test("scope-triggered: with sync the zero crossing of a 100 Hz sine sits at the same x in frames 10 and 50 (+-2 px); free run does not", async () => {
  const audio = wav("sine100.wav", sine(100));
  const common = { template: "scope-triggered", params: { ...BARE_TRACE, window: 400, stereoSeparation: 0, bloom: 0, speedDim: 0, pinch: 0, thickness: 3, audioKick: 0 } };
  const locked = await render({ ...common, params: { ...common.params, syncMode: 1 } }, { audio, frames: [10, 50] });
  const falling = (r, f) => crossings(r.kept.get(f), r.W, r.H).find((c) => c.dir === -1);
  const a = falling(locked, 10);
  const b = falling(locked, 50);
  assert.ok(a && b, "no falling zero crossing found");
  assert.ok(Math.abs(a.x - b.x) <= 2, `synced crossing moved: ${a.x.toFixed(2)} vs ${b.x.toFixed(2)}`);
  const free = await render({ ...common, params: { ...common.params, syncMode: 0 } }, { audio, frames: [10, 50] });
  const first = (r, f) => crossings(r.kept.get(f), r.W, r.H).find((c) => c.x > 0.215 * r.W + 3);
  const fa = first(free, 10);
  const fb = first(free, 50);
  assert.ok(Math.abs(fa.x - fb.x) > 2, `free run should jitter, crossings ${fa.x.toFixed(2)} vs ${fb.x.toFixed(2)}`);
});

test("scope-triggered: interpolate raw steps differ from band-limited, and stereoSeparation draws two traces", async () => {
  const audio = wav("sine1k.wav", sine(1000));
  const base = { template: "scope-triggered", params: { ...BARE_TRACE, window: 64, syncMode: 1, speedDim: 0, bloom: 0 } };
  const raw = await render({ ...base, params: { ...base.params, interpolate: 0, stereoSeparation: 0 } }, { audio, frames: [60] });
  const smooth = await render({ ...base, params: { ...base.params, interpolate: 2, stereoSeparation: 0 } }, { audio, frames: [60] });
  let diff = 0;
  for (let i = 0; i < raw.kept.get(60).length; i++) diff += Math.abs(raw.kept.get(60)[i] - smooth.kept.get(60)[i]);
  assert.ok(diff > 20000, `raw and band-limited look the same (sum diff ${diff})`);
  const two = await render({ ...base, params: { ...base.params, interpolate: 2, stereoSeparation: 0.3 } }, { audio, frames: [60] });
  const rows = new Set();
  const img = two.kept.get(60);
  for (let y = 0; y < two.H; y++) for (let x = 0; x < two.W; x++) if (peak(px(img, two.W, x, y)) > 120) rows.add(Math.round((y / two.H) * 20));
  const band = [...rows].filter((r) => r < 8).length > 0 && [...rows].filter((r) => r > 12).length > 0;
  assert.ok(band, "expected a trace above and one below the centre");
});

test("goniometer: a mono input draws a vertical line, not a blank frame; a 3:2 test signal fills the diamond", async () => {
  const audio = wav("mono220.wav", sine(220));
  const m = await render({ template: "goniometer", params: BARE }, { audio, frames: [60, 120] });
  for (const f of [60, 120]) {
    const b = bbox(m.kept.get(f), m.W, m.H);
    assert.ok(b.n > 50, `frame ${f} is blank`);
    assert.ok(b.w <= 0.04 * m.W, `frame ${f}: mono should be a line, width ${b.w}`);
    assert.ok(b.h >= 0.3 * m.H, `frame ${f}: line too short ${b.h}`);
    assert.ok(Math.abs(b.cx - m.W / 2) <= 0.02 * m.W);
  }
  const s = await render({ template: "goniometer", params: { ...BARE, srcMode: 1 } }, { frames: [100] });
  const b = bbox(s.kept.get(100), s.W, s.H);
  assert.ok(b.w > 0.4 * s.H && b.h > 0.4 * s.H, `test signal figure too small ${b.w}x${b.h}`);
});

test("spectrogram-scroll: the buffer scrolls by whole texels and a 440 Hz tone sits on the log axis", async () => {
  const audio = wav("sine440.wav", sine(440));
  const params = { hud: 0, grid: 0, playhead: 0, onsetTicks: 0, smoothing: 0, cell: 1, scrollPx: 8, dbMin: -70, dbMax: -30, tilt: 0 };
  const { kept, W, H } = await render({ template: "spectrogram-scroll", params }, { audio, frames: [100, 101] });
  const shift = Math.round((8 * W) / 1920);
  const mx = Math.floor(0.21 * W);
  const my = Math.floor(0.12 * H);
  let total = 0, same = 0;
  for (let y = my; y < H - my; y++) for (let x = mx + 2; x < W - mx - shift - 2; x++) {
    const a = px(kept.get(101), W, x, y);
    const b = px(kept.get(100), W, x + shift, y);
    total++;
    if (Math.abs(a[0] - b[0]) <= 3 && Math.abs(a[1] - b[1]) <= 3 && Math.abs(a[2] - b[2]) <= 3) same++;
  }
  assert.ok(same / total > 0.99, `only ${(same / total * 100).toFixed(1)}% of pixels moved by ${shift} px`);
  let best = -1, bestRow = 0;
  for (let y = my; y < H - my; y++) {
    let s = 0;
    for (let x = W - mx - 6; x < W - mx - 1; x++) s += px(kept.get(100), W, x, y).reduce((p, q) => p + q, 0);
    if (s > best) { best = s; bestRow = y; }
  }
  const areaH = H - 2 * my;
  const expected = 0.12 * H + (Math.log(440 / 50) / Math.log(16000 / 50)) * areaH;
  assert.ok(Math.abs((H - 1 - bestRow) - expected) <= 0.05 * areaH, `tone at row ${H - 1 - bestRow}, log axis expects ${expected.toFixed(1)}`);
});

function radiusAt(img, W, H, deg) {
  const a = (deg * Math.PI) / 180;
  let best = -1, r = 0;
  for (let k = 0.1 * H; k < 0.49 * H; k += 0.5) {
    const x = Math.floor(W / 2 + k * Math.cos(a)), y = Math.floor(H / 2 - k * Math.sin(a));
    const v = peak(px(img, W, x, y));
    if (v > best) { best = v; r = k; }
  }
  return r;
}

test("scope-polar: silence draws a circle of ringRadius; a period-locked raw wrap is seamless, a mismatched window is not", async () => {
  const flat = await render({ template: "scope-polar", params: { ...BARE_TRACE, stereoSeparation: 0, spin: 0 } }, { frames: [30] });
  const img = flat.kept.get(30);
  const radii = [];
  for (let y = 0; y < flat.H; y++) for (let x = 0; x < flat.W; x++) if (peak(px(img, flat.W, x, y)) >= 128) radii.push(Math.hypot(x + 0.5 - flat.W / 2, flat.H / 2 - y - 0.5));
  assert.ok(radii.length > 200, "no ring");
  const mean = radii.reduce((p, q) => p + q, 0) / radii.length;
  const ringRadius = lib.get("scope-polar").fx.INPUTS.find((i) => i.NAME === "ringRadius").DEFAULT;
  assert.ok(Math.abs(mean - ringRadius * flat.H) <= 0.02 * flat.H, `ring radius ${mean.toFixed(1)} vs ${ringRadius * flat.H}`);
  const audio = wav("sine100b.wav", sine(100));
  const p = { ...BARE_TRACE, stereoSeparation: 0, spin: 0, loops: 1, wrap: 1, pinch: 0, interpolate: 2, amplitude: 2.4 };
  const seam = async (extra) => {
    const r = await render({ template: "scope-polar", params: { ...p, ...extra } }, { audio, frames: [40] });
    const i = r.kept.get(40);
    return Math.abs(radiusAt(i, r.W, r.H, 1.5) - radiusAt(i, r.W, r.H, -1.5)) / r.H;
  };
  const locked = await seam({ syncMode: 3, syncHz: 100, syncCycles: 1 });
  const broken = await seam({ syncMode: 1, window: 400 });
  assert.ok(locked <= 0.015, `period-locked seam jump ${(locked * 100).toFixed(2)}% of H`);
  assert.ok(broken > 0.03, `mismatched window should show a seam, jump ${(broken * 100).toFixed(2)}% of H`);
});

for (const [id, demo] of [["scope-triggered", "hud-black"], ["xy-phosphor", "hud-black"], ["goniometer", "boot-green"], ["spectrogram-scroll", "hud-black"], ["scope-polar", "hud-black"]]) {
  test(`${id}/${demo}: renders 240 frames at 60 fps, passes determinism, records a flash audit`, async () => {
    const t = lib.get(id);
    const v = validateScore({ ...JSON.parse(readFileSync(path.join(t.dir, `demo-${demo}.json`), "utf8")), credit: { overlay: false } }, lib);
    assert.equal(v.ok, true, JSON.stringify(v.errors));
    const gate = await runJob(v.value, lib, { outDir: mkdtempSync(path.join(tmp, "j-")), width: 320, height: 180, replay: true, cwd: ROOT });
    assert.equal(gate.render.frames, 240);
    assert.equal(gate.render.fps, 60);
    assert.equal(gate.determinism.pass, true, JSON.stringify(gate.determinism));
    assert.equal(typeof gate.flash.flashesPerSecondMax, "number");
    assert.equal(typeof gate.flash.exceeds, "boolean");
  });
}

test("fieldMode paints one full field colour per shot (lime, ultramarine, orange, near-black) in every template", async () => {
  const want = { 0: [11, 11, 12], 1: [200, 255, 0], 2: [20, 20, 255], 4: [255, 60, 0] };
  for (const id of IDS) {
    for (const [mode, rgb] of Object.entries(want)) {
      const r = await render({ template: id, params: { fieldMode: Number(mode), hud: 0 } }, { W: 320, H: 180, frames: [2] });
      const c = px(r.kept.get(2), 320, 3, 3);
      c.forEach((v, i) => assert.ok(Math.abs(v - rgb[i]) <= 8, `${id} fieldMode ${mode}: corner ${c} vs ${rgb}`));
    }
  }
});

test("the HUD chrome and the engine text layer draw: panel frame, title text, tick rulers and readout digits", async () => {
  const { kept, W, H } = await render({ template: "xy-phosphor", preset: "hud-black" }, { frames: [20] });
  const img = kept.get(20);
  const ink = (x0, y0, x1, y1, thr = 140) => { let n = 0; for (let y = Math.floor(y0 * H); y < y1 * H; y++) for (let x = Math.floor(x0 * W); x < x1 * W; x++) if (peak(px(img, W, x, y)) >= thr) n++; return n; };
  assert.ok(ink(0.88, 0.02, 0.98, 0.14) > 25, "title text missing top right");
  assert.ok(ink(0.02, 0.03, 0.17, 0.16) > 40, "tab label text missing top left");
  assert.ok(ink(0.284, 0.4, 0.2885, 0.6) > 30, "central panel frame missing");
  assert.ok(ink(0.857, 0.55, 0.975, 0.8) > 30, "readout digits and labels missing");
  assert.ok(ink(0.05, 0.4, 0.15, 0.7) > 3, "cloud panel has no dots");
});

test("spectrogram-scroll pre-rolls the buffer: frame 0 already shows data in the panel, and preroll 0 shows none", async () => {
  const fill = async (preroll) => {
    const { kept, W, H } = await render({ template: "spectrogram-scroll", params: { hud: 0, preroll } }, { W: 640, H: 360, frames: [0] });
    let n = 0, total = 0;
    for (let y = Math.floor(0.14 * H); y < 0.86 * H; y++) for (let x = Math.floor(0.22 * W); x < 0.5 * W; x++) { total++; if (peak(px(kept.get(0), W, x, y)) > 60) n++; }
    return n / total;
  };
  const on = await fill(1);
  const off = await fill(0);
  assert.ok(on > 0.03, `pre-roll left the left half of the panel nearly empty (${(on * 100).toFixed(1)}%)`);
  assert.ok(off < 0.005, `preroll 0 should start empty (${(off * 100).toFixed(1)}%)`);
});

for (const [id, demoName] of [["scope-polar", "field-lime"], ["scope-triggered", "field-ultramarine"]]) {
  test(`${id}: the declared safeSubstitute keeps the ${demoName} demo within the flash limits`, async () => {
    const t = lib.get(id);
    const demo = JSON.parse(readFileSync(path.join(t.dir, `demo-${demoName}.json`), "utf8"));
    const v = validateScore({ ...demo, params: t.fx.X_AGENTVFX.safeSubstitute.params, credit: { overlay: false } }, lib);
    assert.equal(v.ok, true, JSON.stringify(v.errors));
    const gate = await runJob(v.value, lib, { outDir: mkdtempSync(path.join(tmp, "s-")), width: 320, height: 180, replay: false, cwd: ROOT });
    assert.equal(gate.flash.exceeds, false, JSON.stringify(gate.flash.worstWindow));
    assert.equal(gate.flash.redFlashes, 0);
  });
}
