// Collage experimental type (role typefx): layout data and packing for the new role and the sheet channel, the three presets
// glyph-flood / slit-scan / echo-stack and the G / B text sheets they read, and measured behaviour on rendered frames:
// every effect attacks on the music event frame and relaxes within a few frames (snappy), while the cells hold their place.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { checkLayout, layoutCells, layoutToParams, packSrc } from "../templates/brutal/collage/layout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC = "test-media/beat-132.mp3";
const lib = loadLibrary();
const tpl = lib.get("collage");
const LAYOUTS = JSON.parse(readFileSync(path.join(tpl.dir, "layouts.json"), "utf8"));
const EXPERIMENTAL = ["glyph-flood", "glyph-flood-ko", "glyph-flood-solid", "slit-scan", "slit-scan-ko", "slit-scan-bone", "echo-stack", "echo-stack-ko", "echo-ripple", "type-eq", "type-eq-ko"];
const WORD_VARIANT = { "glyph-flood": 2, "glyph-flood-ko": 2, "glyph-flood-solid": 2, "slit-scan": 3, "slit-scan-ko": 3, "slit-scan-bone": 3, "echo-stack": 4, "echo-stack-ko": 4, "echo-ripple": 5, "type-eq": 6, "type-eq-ko": 6 };
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-collage-typefx-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const W = 640;
const H = 360;
let runs = 0;

const cell = (x, y, w, h, role, more = {}) => ({ x, y, w, h, role, ...more });

test("typefx role and src.sheet: packing puts the sheet in the millions digit, bad sheets and out-of-range values are rejected", () => {
  const c = cell(0, 0, 32, 18, "typefx", { frame: "none", variant: 3, src: { x: -2, y: -0.5, scale: 1.2, sheet: "b" } });
  assert.deepEqual(checkLayout([c]), []);
  assert.equal(packSrc(c), 2000000 + 12 * 10000 + 16 * 100 + 19);
  assert.equal(packSrc(cell(0, 0, 4, 4, "type", { src: { x: 1, y: 1, scale: 1, sheet: "g" } })), 1000000 + 10 * 10000 + 22 * 100 + 22, "type cells take a sheet too");
  assert.equal(packSrc(cell(0, 0, 4, 4, "type", { src: { x: 1, y: 1, scale: 1 } })), 10 * 10000 + 22 * 100 + 22, "default sheet is r (digit 0)");
  assert.equal(packSrc(cell(0, 0, 4, 4, "typefx")), 10 * 10000 + 20 * 100 + 20, "a typefx cell without src still reads the sheet origin");
  assert.match(checkLayout([cell(0, 0, 4, 4, "typefx", { src: { x: 0, y: 0, scale: 1, sheet: "x" } })]).map((e) => e.message).join("|"), /one of r, g, b/u);
  assert.equal(checkLayout([cell(0, 0, 4, 4, "typefx", { variant: 6 })]).length, 0, "variants up to 9 are valid for typefx");
  const p = layoutToParams([c, cell(0, 0, 32, 18, "typefx", { frame: "none", variant: 1 })]);
  const input = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i]));
  for (const [k, v] of Object.entries(p)) assert.ok(v >= input[k].MIN && v <= input[k].MAX, `${k} ${v} inside its input range`);
  assert.equal(p.cell1, 1300003218, "typefx is role 13");
});

test("experimental presets: valid layouts that equal their preset, vermilion family, full-bleed, typefx cells, G / B sheet windows", () => {
  const defaults = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i.DEFAULT]));
  for (const n of EXPERIMENTAL) {
    const e = LAYOUTS[n];
    assert.deepEqual(checkLayout(e), [], n);
    assert.deepEqual({ ...defaults, ...tpl.fx.X_AGENTVFX.presets[n] }, { ...defaults, ...e.params, ...layoutToParams(e) }, `${n} preset equals its layout`);
    const cells = layoutCells(e);
    assert.ok(cells.every((c) => c.frame === "none"), `${n}: no boxed tiles`);
    assert.ok(cells.filter((c) => c.role === "typefx").length >= 2, `${n} has typefx cells`);
    assert.equal(e.params.margin, 0, `${n} runs to the frame edge`);
    assert.ok(typeof e.description === "string" && e.description.length > 80, `${n} describes itself`);
    const vermilion = ([r, g, b]) => r > 0.8 && g > 0.15 && g < 0.3 && b < 0.15;
    assert.ok(vermilion(e.params.accentColor) || vermilion(e.params.groundColor), `${n} uses vermilion as accent or ground`);
    for (const c of cells.filter((q) => q.role === "typefx")) assert.ok(["g", "b"].includes(c.src?.sheet), `${n}: every typefx cell reads the G or B sheet`);
    assert.ok(cells.some((c) => c.role === "typefx" && c.variant === WORD_VARIANT[n]), `${n} has its word cell (typefx variant ${WORD_VARIANT[n]})`);
    assert.ok(cells.some((c) => c.role === "typefx" && c.variant === 1), `${n} has a micro-type field`);
  }
  const layoutOf = (n) => JSON.stringify(layoutCells(LAYOUTS[n]));
  assert.equal(new Set(EXPERIMENTAL.map(layoutOf)).size, EXPERIMENTAL.length, "every preset is its own composition");
  const warp = (n) => ({ ...defaults, ...tpl.fx.X_AGENTVFX.presets[n] }).typeWarp;
  assert.ok(warp("slit-scan-ko") < 0.6 && warp("slit-scan-bone") < 0.6 && warp("slit-scan") === 1, "the calmer slit-scan variants lower typeWarp");
  const word = (n) => layoutCells(LAYOUTS[n]).find((c) => c.role === "typefx" && c.variant === WORD_VARIANT[n]);
  assert.deepEqual(["glyph-flood", "slit-scan", "echo-stack"].map((n) => word(n).src.sheet), ["g", "b", "g"]);
  assert.equal(word("glyph-flood-solid").tone, "accent", "the solid glyph variant fills with the accent");
});

test("text sheet: the experimental words are on G and B, in Monument Extended / Pretendard, the micro-type lines in MesloLGS NF / Pretendard, the editorial sheet stays on R", () => {
  const text = tpl.fx.X_AGENTVFX.text.filter((t) => t.set === undefined);
  const by =Object.fromEntries(text.map((t) => [t.key, t]));
  const channels = { mega: "g", mega2: "g", megaK: "g", echo: "g", echoK: "g", microK: "g", slit: "b", slitK: "b", eq: "b", eqK: "b", microM: "b" };
  for (const [k, ch] of Object.entries(channels)) assert.equal(by[k].channel, ch, `${k} channel`);
  assert.ok(text.filter((t) => !(t.key in channels)).every((t) => t.channel === undefined || t.channel === "r"), "the editorial sheet stays on R");
  for (const k of ["mega", "mega2", "echo", "eq"]) assert.equal(by[k].family, "Monument Extended", `${k} is Monument Extended`);
  for (const k of ["megaK", "echoK", "microK", "slit", "slitK", "eqK"]) assert.equal(by[k].family, "Pretendard", `${k} is Pretendard`);
  assert.equal(by.microM.family, "MesloLGS NF");
  for (const k of ["capA", "capB", "body", "fields", "atlas"]) assert.equal(by[k].family, "MesloLGS NF", `${k} caption/counter text is MesloLGS NF`);
  for (const k of ["megaK", "echoK", "slitK", "eqK"]) assert.match(by[k].default, /[가-힣]/u, `${k} is Hangul`);
  for (const t of Object.values(by)) assert.ok(t.default.length >= 1 && t.size <= 1, `${t.key} has text`);
  const v = validateScore({ version: 1, template: "collage", preset: "glyph-flood", input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t", labels: { mega: "R", mega2: "Q", echo: "NODE", slit: "HALL", eqK: "빛" }, textStyle: { mega: { family: "Pretendard", weight: 700 } } }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
});

async function frames(preset, keep, params = {}) {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const v = validateScore({ version: 1, template: "collage", preset, input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t", params: { grain: 0, ...params } }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const kept = new Map();
  await renderScore(v.value, lib, { outDir: path.join(tmp, `t-${runs++}`), width: W, height: H, features, replay: false, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  return { kept, features };
}

/** Events (onsets or beats) with no other event in the 4 frames before and the 5 after, so the pulse attacks clean and has fully fallen by e + 5. */
const clean = (events, lo, hi) => events.filter((e) => e >= lo && e < hi && !events.some((p) => p !== e && p > e - 5 && p < e + 6));
const px = (rgba, x, y) => { const i = (y * W + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
const count = (rgba, test, x0 = 0, y0 = 0, x1 = W, y1 = H) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(px(rgba, x, y))) n += 1; return n; };
const isVermilion = ([r, g, b]) => r > 170 && g < 110 && b < 80;

test("echo-stack: the stack is at its fullest on the beat frame (more vermilion copies) and has fallen back by 5 frames later", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beats = clean(features.meta.beats, 8, 85).slice(0, 3);
  assert.ok(beats.length >= 2, `clean beats exist: ${beats}`);
  const { kept } = await frames("echo-stack", beats.flatMap((b) => [b - 1, b, b + 5]));
  for (const b of beats) {
    const [before, at, after] = [b - 1, b, b + 5].map((f) => count(kept.get(f), isVermilion));
    assert.ok(at >= before * 0.98 && at > 18000, `beat ${b}: vermilion ${before} -> ${at}`);
    assert.ok(after < at * 0.6, `beat ${b}: vermilion ${at} -> ${after} after 5 frames`);
  }
});

test("typeWarp scales the warp: declared 0..1.5 with default 1, and 0 holds the echo stack still across a beat", async () => {
  const input = tpl.fx.INPUTS.find((i) => i.NAME === "typeWarp");
  assert.deepEqual([input.MIN, input.MAX, input.DEFAULT], [0, 1.5, 1]);
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const b = clean(features.meta.beats, 8, 85)[0];
  const { kept } = await frames("echo-stack", [b, b + 5], { typeWarp: 0 });
  const [at, after] = [b, b + 5].map((f) => count(kept.get(f), isVermilion));
  assert.ok(Math.abs(at - after) < at * 0.03, `beat ${b}: vermilion ${at} vs ${after} with the warp off`);
  assert.ok(at < 12000, `only the front pair of copies is drawn: ${at}`);
});

test("glyph-flood: the hot extrusion jumps out on the onset frame and is back within 5 frames; the cut-out letter keeps its place", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const onsets = clean(features.meta.onsets, 8, 85).slice(0, 3);
  const { kept } = await frames("glyph-flood", onsets.flatMap((o) => [o - 1, o, o + 5]));
  for (const o of onsets) {
    const [before, at, after] = [o - 1, o, o + 5].map((f) => count(kept.get(f), isVermilion, 48, 0, W, H));
    assert.ok(at > before * 1.1 + 1500, `onset ${o}: vermilion ${before} -> ${at}`);
    assert.ok(after < at * 0.9, `onset ${o}: vermilion ${at} -> ${after} after 5 frames`);
    const a = kept.get(o - 1);
    const b = kept.get(o + 5);
    let same = 0;
    for (let y = 120; y < 240; y++) same += Math.abs(px(a, 320, y)[0] - px(b, 320, y)[0]) < 40 ? 1 : 0;
    assert.ok(same > 100, `the glyph interior column holds its place between onsets (${same} of 120 rows unchanged)`);
  }
});

test("slit-scan: a beat smears the word into a pale streak on its frame and the streak is gone 5 frames later", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beats = clean(features.meta.beats, 8, 85).slice(0, 3);
  assert.ok(beats.length >= 2, `clean beats exist: ${beats}`);
  const { kept } = await frames("slit-scan", beats.flatMap((b) => [b - 1, b, b + 5]));
  const pale = ([r, g, b]) => r > 200 && g > 110 && g < 236 && b > 90 && r - g > 8;
  for (const b of beats) {
    const [before, at, after] = [b - 1, b, b + 5].map((f) => count(kept.get(f), pale, 0, 24, 320, H));
    assert.ok(at > before && at > 15000, `beat ${b}: pale smear ${before} -> ${at}`);
    assert.ok(after < 500, `beat ${b}: pale smear ${at} -> ${after} after 5 frames`);
  }
});
