// Collage layouts (editorial model): layout data validation and packing, the three editorial presets, the text sheet,
// the layout file shipped for the layout editor, and measured behaviour on rendered frames (type holds its place
// while it reacts, instruments move, the old tile layouts still render outlines that hold).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { MAX_CELLS, ROLES, checkLayout, layoutCells, layoutToParams, packCell, packSrc, packStyle } from "../templates/brutal/collage/layout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC = "test-media/beat-132.mp3";
const lib = loadLibrary();
const tpl = lib.get("collage");
const LAYOUTS = JSON.parse(readFileSync(path.join(tpl.dir, "layouts.json"), "utf8"));
const EDITORIAL = ["poster", "spread", "index"];
const EXPERIMENTAL = ["glyph-flood", "glyph-flood-ko", "glyph-flood-solid", "slit-scan", "slit-scan-ko", "slit-scan-bone", "echo-stack", "echo-stack-ko", "echo-ripple", "type-eq", "type-eq-ko"];
const SCENES = ["specimen", "wiring", "field-cut", "pattern-sheet", "anatomy", "deck", "bootlog", "tunnel", "runner", "ascii", "cube-wall", "vortex-count", "sticker-slap", "ribbon-rays", "slab-shear", "frame-loop-dial", "tilt-tiles", "marquee-stack", "lens-wrap", "liquid-type", "panel-grid", "mirror-track"];
const TILES = ["wide-hero", "split", "mosaic"];
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-collage-layout-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let runs = 0;
const W = 640;
const H = 360;

const cell = (x, y, w, h, role, more = {}) => ({ x, y, w, h, role, ...more });
const defaults = () => Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i.DEFAULT]));

test("thirty-six layouts: editorial (poster, spread, index), eleven experimental type layouts and twenty-two scenes listed first, three old tile layouts kept; each matches its preset", () => {
  assert.deepEqual(Object.keys(LAYOUTS), [...EDITORIAL, ...EXPERIMENTAL, ...SCENES, ...TILES]);
  assert.deepEqual(Object.keys(tpl.fx.X_AGENTVFX.presets).slice(0, EDITORIAL.length + EXPERIMENTAL.length + SCENES.length), [...EDITORIAL, ...EXPERIMENTAL, ...SCENES]);
  for (const n of [...EDITORIAL, ...EXPERIMENTAL, ...SCENES, ...TILES]) {
    assert.deepEqual(checkLayout(LAYOUTS[n]), [], n);
    const expected = { ...defaults(), ...(LAYOUTS[n].params ?? {}), ...layoutToParams(LAYOUTS[n]) };
    assert.deepEqual({ ...defaults(), ...tpl.fx.X_AGENTVFX.presets[n] }, expected, `${n} preset equals its layout`);
    assert.equal(validateScore({ version: 1, template: "collage", preset: n, input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t" }, lib).ok, true, n);
  }
  assert.equal(defaults().layoutMode, 0, "fixed is the default mode");
});

test("editorial layouts are not tiled partitions: no boxed tiles, overlap and edge bleed, type and live elements, vermilion accent", () => {
  const key = (c) => `${c.x},${c.y},${c.w},${c.h},${c.role}`;
  for (const n of EDITORIAL) {
    const cells = layoutCells(LAYOUTS[n]);
    assert.ok(cells.every((c) => c.frame !== undefined && c.frame !== "tile"), `${n}: every cell sets a frame other than tile`);
    assert.ok(cells.some((c) => c.role === "footage"), `${n} has footage`);
    assert.ok(cells.filter((c) => c.role === "type").length >= 2, `${n} has type cells`);
    assert.ok(cells.some((c) => ["spectrum", "scope", "meter", "crosshair", "rule", "readout"].includes(c.role)), `${n} has an instrument`);
    const area = cells.reduce((s, c) => s + c.w * c.h, 0);
    const mirrored = new Set(cells.map((c) => key({ ...c, x: 32 - c.x - c.w })));
    assert.ok(cells.some((c) => !mirrored.has(key(c))), `${n} is not mirror-symmetric`);
    const overlaps = cells.some((a, i) => cells.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
    assert.ok(overlaps, `${n} layers cells over each other (${area} cell units of 576)`);
    const [r, g, b] = LAYOUTS[n].params.accentColor;
    assert.ok(r > 0.8 && g > 0.15 && g < 0.3 && b < 0.15, `${n} accent is vermilion`);
    assert.equal(LAYOUTS[n].params.margin, 0, `${n} runs to the frame edge`);
  }
  assert.ok(layoutCells(LAYOUTS.poster).some((c) => c.role === "footage" && c.w === 32 && c.h === 18), "poster footage is full bleed");
  const idx = layoutCells(LAYOUTS.index);
  assert.ok(idx.find((c) => c.role === "footage").w < 32, "index footage is a small plate");
});

test("checkLayout: tile cells may not overlap, editorial cells may; bad frame, fill, tone, variant, rot, src, bounds and count are rejected", () => {
  const msgs = (l) => checkLayout(l).map((e) => `${e.path} ${e.message}`).join("|");
  assert.deepEqual(checkLayout([cell(0, 0, 16, 18, "footage"), cell(16, 0, 16, 18, "scope")]), []);
  assert.match(msgs([cell(0, 0, 17, 18, "footage"), cell(16, 0, 16, 18, "scope")]), /overlaps/u);
  assert.deepEqual(checkLayout([cell(0, 0, 32, 18, "footage", { frame: "none" }), cell(4, 4, 20, 6, "spectrum", { frame: "none", variant: 1 })]), []);
  assert.deepEqual(checkLayout([cell(0, 0, 32, 18, "footage", { frame: "none" }), cell(4, 4, 20, 6, "scope")]), [], "a tile panel may sit on an editorial cell");
  assert.match(msgs([cell(30, 0, 3, 4, "footage")]), /out of bounds: x \+ w = 33/u);
  assert.match(msgs([cell(0, 17, 4, 2, "footage")]), /out of bounds: y \+ h = 19/u);
  assert.match(msgs([cell(0, 0, 4, 2, "banner")]), /role must be one of footage, spectrum/u);
  assert.match(msgs([cell(0.5, 0, 4, 2, "footage")]), /\[0\]\.x must be an integer/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { frame: "dotted" })]), /frame/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { fill: "red" })]), /fill/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { tone: "red" })]), /tone/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { variant: 10 })]), /variant/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { rot: 3 })]), /rot/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { src: { x: 0.3, y: 0, scale: 1 } })]), /src\.x/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { src: { x: 0, y: 0, scale: 1.55 } })]), /src\.scale/u);
  assert.match(msgs([cell(0, 0, 4, 2, "type", { src: { x: 0, y: 0, zoom: 2 } })]), /unknown key/u);
  assert.match(msgs([{ ...cell(0, 0, 4, 2, "footage"), z: 1 }]), /unknown key/u);
  assert.match(msgs([]), /1 to 16 cells/u);
  assert.match(msgs(Array.from({ length: MAX_CELLS + 1 }, (_, i) => cell(i, 0, 1, 1, "hatch", { frame: "none" }))), /1 to 16 cells/u);
  assert.throws(() => layoutToParams([cell(0, 0, 40, 2, "footage")]), /invalid collage layout/u);
  assert.equal(Object.keys(ROLES).length, 14);
  assert.equal(ROLES.typefx, 13);
  assert.equal(ROLES.scene, 14);
});

test("packing: cellN is RRXXYYWWHH, styleN is variant tone fill frame rot, srcN is scale x y; unused slots are 0", () => {
  const c = cell(3, 8, 29, 10, "type", { frame: "none", variant: 4, tone: "ground", fill: "ink", rot: 1, src: { x: 19, y: -1.5, scale: 1.6 } });
  assert.equal(packCell(c), 1103082910);
  assert.equal(packStyle(c), 41210 + 1);
  assert.equal(packSrc(c), 16 * 10000 + 58 * 100 + 17);
  assert.equal(packStyle(cell(0, 0, 1, 1, "footage")), 0, "old cells keep style 0 = tile");
  assert.equal(packSrc(cell(0, 0, 1, 1, "footage")), 0);
  const p = layoutToParams([c]);
  assert.equal(Object.keys(p).length, 48);
  assert.equal(p.cell1, 0);
  assert.equal(p.style15, 0);
  assert.equal(p.src0, packSrc(c));
  const input = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i]));
  for (const [k, v] of Object.entries(p)) assert.ok(v >= input[k].MIN && v <= input[k].MAX, `${k} ${v} inside its input range`);
});

test("text sheet: declared slots, fonts from the engine list, atlas row matches the shader constants, every src window lands on the sheet", () => {
  const text = tpl.fx.X_AGENTVFX.text;
  const keys = text.map((t) => t.key);
  for (const k of ["word", "numeral", "headline", "body", "fields", "spine", "capA", "capB", "atlas"]) assert.ok(keys.includes(k), `slot ${k}`);
  const atlas = text.find((t) => t.key === "atlas");
  const frag = readFileSync(path.join(tpl.dir, "main.frag"), "utf8");
  const konst = (n) => Number(new RegExp(`const float ${n} = ([0-9.]+);`, "u").exec(frag)?.[1]);
  assert.ok(Math.abs(konst("ATLAS_X") - atlas.x) < 1e-4 && Math.abs(konst("ATLAS_Y") - atlas.y) < 1e-4 && konst("ATLAS_PX") === atlas.size, "ATLAS_X/Y/PX equal the atlas text item");
  assert.match(atlas.default, /^0123456789:A.*Z$/u);
  for (const n of EDITORIAL) for (const c of layoutCells(LAYOUTS[n]).filter((q) => q.role === "type")) {
    const s = { x: 0, y: 0, scale: 1, ...c.src };
    assert.ok(s.x >= 0 && s.x < 32 && s.y > -10 && s.y < 18, `${n} type window starts on the sheet`);
  }
});

test("the shipped r7 layout file lists every layout with its packed params and the text sheet", () => {
  const file = path.join(ROOT, "test/fixtures/r7-collage-LAYOUTS.json");
  assert.ok(existsSync(file), "r7-collage-LAYOUTS.json exists");
  const shipped = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(shipped.format, "collage layout v3");
  assert.equal(shipped.maxCells, 16);
  assert.deepEqual(Object.keys(shipped.layouts), Object.keys(LAYOUTS));
  for (const [n, e] of Object.entries(LAYOUTS)) {
    assert.deepEqual(shipped.layouts[n].cells, layoutCells(e), `${n} cells`);
    assert.deepEqual(shipped.layouts[n].params, { ...(e.params ?? {}), ...layoutToParams(e) }, `${n} params`);
  }
  assert.deepEqual(Object.keys(shipped.textSheet), tpl.fx.X_AGENTVFX.text.map((t) => t.key));
});

async function frames(params, keep, preset) {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const v = validateScore({ version: 1, template: "collage", ...(preset ? { preset } : {}), input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t", params: { construction: false, grain: 0, gridDots: 0, ...params } }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const kept = new Map();
  await renderScore(v.value, lib, { outDir: path.join(tmp, `l-${runs++}`), width: W, height: H, features, replay: false, onFrame: (f, a) => { if (keep === "all" || keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  return { kept, features };
}

const px = (rgba, x, y) => { const i = (y * W + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
const isRed = ([r, g, b]) => r > 150 && g < 110 && b < 90;
const isInk = ([r, g, b]) => r + g + b < 200;

/** Numeral window of the index layout in pixels (grid cell 1,2,9,13 on a 20 px unit), clear of the level hairline rows at the ends. */
function numeralStats(rgba) {
  let red = 0;
  const glyph = new Set();
  for (let y = 50; y < 290; y++) for (let x = 24; x < 196; x++) {
    const p = px(rgba, x, y);
    if (isRed(p)) red += 1;
    if (isRed(p) || isInk(p)) glyph.add(y * W + x);
  }
  return { red, glyph };
}

test("index: the numeral keeps its shape across all frames while its vermilion fill follows the rms (type reacts, never moves)", async () => {
  const { kept } = await frames({ footageSat: 1 }, "all", "index");
  const stats = [...kept.keys()].filter((f) => f >= 3).map((f) => numeralStats(kept.get(f)));
  const reds = stats.map((s) => s.red);
  const area = Math.max(...stats.map((s) => s.glyph.size));
  assert.ok(area > 3000, `numeral covers pixels: ${area}`);
  assert.ok(Math.max(...reds) > 3 * Math.min(...reds) + 400, `fill range across frames: ${Math.min(...reds)}..${Math.max(...reds)}`);
  const base = stats[0].glyph;
  for (const s of stats) {
    let both = 0;
    for (const k of s.glyph) if (base.has(k)) both += 1;
    assert.ok(both / Math.max(s.glyph.size, base.size) > 0.8, `glyph shape overlap ${(both / Math.max(s.glyph.size, base.size)).toFixed(2)}`);
  }
});

test("index numeral fill on the bass attacks on the onset frame and falls by half within 4 frames", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const onsets = features.meta.onsets.filter((o) => o >= 4 && o < 85 && features.frames[o].bass > 3 && features.frames[o - 1].bass < 1.3 && features.frames[o + 4].bass < 1);
  assert.ok(onsets.length >= 1, "a clean strong onset exists");
  const keep = onsets.flatMap((o) => [o - 1, o, o + 4]);
  const { kept } = await frames({ style0: 10010 }, keep, "index");
  for (const o of onsets) {
    const [a, b, c] = [o - 1, o, o + 4].map((f) => numeralStats(kept.get(f)).red);
    assert.ok(b > a * 1.3 + 50, `onset ${o}: fill ${a} -> ${b}`);
    assert.ok(c <= b * 0.5 + 50, `onset ${o}: fill ${b} -> ${c} after 4 frames`);
  }
});

test("spread: the scope line crossing both pages changes every frame while the page edge stays", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beat = features.meta.beats.find((b) => b >= 6 && b < 80);
  const { kept } = await frames({}, [beat - 1, beat], "spread");
  const a = kept.get(beat - 1);
  const b = kept.get(beat);
  let diff = 0;
  let n = 0;
  for (let y = 300; y < 358; y++) for (let x = 0; x < W; x++) { n += 1; diff += Math.abs(px(a, x, y)[0] - px(b, x, y)[0]) > 40 ? 1 : 0; }
  assert.ok(diff / n > 0.004, `scope strip changed across a beat: ${(diff / n).toFixed(4)}`);
  for (const y of [4, 8, 12]) assert.ok(px(a, 318, y)[0] < 80 && px(a, 330, y)[0] > 190 && px(b, 318, y)[0] < 80 && px(b, 330, y)[0] > 190, `page edge at x=320 holds (y ${y})`);
});

const brightAt = (rgba, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : (rgba[(y * W + x) * 4] + rgba[(y * W + x) * 4 + 1] + rgba[(y * W + x) * 4 + 2]) / 3);

/** Pixel rectangle of a tile cell inside the frame line (gutter and margin as the shader sets them). */
function box(c) {
  const U = H / 1080;
  const m = 24 * U;
  const g = 10 * U * 0.5;
  const un = [(W - 2 * m) / 32, (H - 2 * m) / 18];
  return { x0: m + c.x * un[0] + g, y0: m + c.y * un[1] + g, x1: m + (c.x + c.w) * un[0] - g, y1: m + (c.y + c.h) * un[1] - g };
}

function outlineInk(rgba, c) {
  const b = box(c);
  let on = 0;
  let n = 0;
  const hit = (x, y) => Math.max(brightAt(rgba, x, y), brightAt(rgba, x, y - 1), brightAt(rgba, x - 1, y)) > 90;
  for (let x = Math.ceil(b.x0) + 6; x < b.x1 - 6; x++) for (const y of [b.y0, b.y1]) { n += 1; on += hit(x, Math.round(y)) ? 1 : 0; }
  for (let y = Math.ceil(b.y0) + 6; y < b.y1 - 6; y++) for (const x of [b.x0, b.x1]) { n += 1; on += hit(Math.round(x), y) ? 1 : 0; }
  return on / n;
}

test("old tile layouts still render: every panel outline holds across a beat (fixed), and reshuffle moves them (control)", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beat = features.meta.beats.find((b) => b >= 4 && b < 85);
  const cells = layoutCells(LAYOUTS["wide-hero"]);
  const fixed = (await frames({ cutMode: 2 }, [beat - 1, beat], "wide-hero")).kept;
  for (const f of [beat - 1, beat]) assert.ok(Math.min(...cells.map((c) => outlineInk(fixed.get(f), c))) > 0.9, `wide-hero outlines hold at frame ${f}`);
  const shuffled = (await frames({ layoutMode: 1, cutMode: 2 }, [beat - 1, beat])).kept;
  const worst = Math.min(...[beat - 1, beat].flatMap((f) => cells.map((c) => outlineInk(shuffled.get(f), c))));
  assert.ok(worst < 0.6, `some outline of the wide-hero grid is missing after a reshuffle: ${worst.toFixed(2)}`);
});
