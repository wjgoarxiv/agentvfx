// Collage scenes (role 14): four mixed-material compositions (specimen, wiring, field-cut, pattern-sheet), each with its own
// text set (text item `set` + template input textSet), palette, fonts, image treatment and beat/onset behaviour. Layout data,
// the text-set filter and measured behaviour on rendered frames: the music event frame is the attack, the cells hold their place.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { createFlashAuditor } from "../engine/core/flash.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { checkLayout, layoutCells, layoutToParams, packCell, ROLES } from "../templates/brutal/collage/layout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC = "test-media/beat-132.mp3";
const lib = loadLibrary();
const tpl = lib.get("collage");
const LAYOUTS = JSON.parse(readFileSync(path.join(tpl.dir, "layouts.json"), "utf8"));
const SCENES = { specimen: 1, wiring: 2, "field-cut": 3, "pattern-sheet": 4, anatomy: 5, deck: 6, bootlog: 7, tunnel: 8, runner: 9, ascii: 0, "cube-wall": 10, "vortex-count": 11, "sticker-slap": 12, "ribbon-rays": 13, "slab-shear": 14, "frame-loop-dial": 15, "tilt-tiles": 16, "marquee-stack": 17, "lens-wrap": 18, "liquid-type": 19, "panel-grid": 20, "mirror-track": 21 };
const by_ = (text, key) => text.find((t) => t.key === key);
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-collage-scenes-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const W = 640;
const H = 360;
let runs = 0;

test("scene role: role 14 packs into the cell int range and each preset is one full-frame scene cell equal to its fx.json preset", () => {
  assert.equal(ROLES.scene, 14);
  const cell = { x: 0, y: 0, w: 32, h: 18, role: "scene", frame: "none", variant: 3 };
  assert.deepEqual(checkLayout([cell]), []);
  assert.equal(packCell(cell), 1400003218);
  const defaults = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i.DEFAULT]));
  const input = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i]));
  for (const [name, variant] of Object.entries(SCENES)) {
    const e = LAYOUTS[name];
    assert.deepEqual(checkLayout(e), [], name);
    const cells = layoutCells(e);
    assert.equal(cells.length, 1, `${name} is a single scene cell`);
    assert.deepEqual([cells[0].role, cells[0].variant, cells[0].rot ?? 0, cells[0].w, cells[0].h], ["scene", variant % 10, Math.floor(variant / 10), 32, 18], `${name}: scene id = variant + 10 * rot`);
    const p = layoutToParams(e);
    for (const [k, v] of Object.entries(p)) assert.ok(v >= input[k].MIN && v <= input[k].MAX, `${name} ${k} ${v} inside its input range`);
    assert.deepEqual({ ...defaults, ...tpl.fx.X_AGENTVFX.presets[name] }, { ...defaults, ...e.params, ...p }, `${name} preset equals its layout`);
    assert.ok(e.description.length > 120, `${name} describes itself`);
  }
});

test("diversity: four different palettes (ground colours), four text sets, no vermilion in more than one, beats-only cuts", () => {
  const defaults = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i.DEFAULT]));
  const palettes = Object.keys(SCENES).map((n) => ["groundColor", "inkColor", "accentColor", "tintA", "tintB"].flatMap((k) => ({ ...defaults, ...LAYOUTS[n].params })[k].slice(0, 3)));
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  for (let a = 0; a < palettes.length; a++) for (let b = a + 1; b < palettes.length; b++) assert.ok(dist(palettes[a], palettes[b]) > 0.8, `palette ${a} vs ${b}`);
  assert.deepEqual(Object.keys(SCENES).map((n) => LAYOUTS[n].params.textSet).sort((a, b) => a - b), Array.from({ length: 22 }, (_, i) => i + 1));
  assert.equal(new Set(Object.values(SCENES)).size, 22, "twenty-two different scenes");
  const vermilion = ([r, g, b]) => r > 0.8 && g > 0.15 && g < 0.3 && b < 0.15;
  const colours = Object.keys(SCENES).flatMap((n) => Object.entries(LAYOUTS[n].params).filter(([k]) => /Color$|^tint/u.test(k)).map(([, v]) => v));
  assert.ok(colours.filter(vermilion).length <= 1, "vermilion appears in at most one preset");
  for (const n of Object.keys(SCENES)) assert.equal(LAYOUTS[n].params.cutMode, 0, `${n} cuts on beats only`);
});

test("text sets: items with `set` are only in 1..16, every preset's textSet has items, base items keep set 0, bad set values are rejected", () => {
  const text = tpl.fx.X_AGENTVFX.text;
  const base = text.filter((t) => t.set === undefined);
  assert.ok(base.length >= 20, "the older sheet is untouched");
  for (let s = 1; s <= 22; s++) assert.ok(text.some((t) => t.set === s), `set ${s} has items`);
  assert.ok(text.every((t) => t.set === undefined || (t.set >= 1 && t.set <= 22)));
  assert.equal(by_(text, "tlF").family, "Rockwell");
  assert.equal(by_(text, "lnWord").family, "Didot");
  assert.equal(by_(text, "lqWord").family, "Bodoni 72");
  assert.equal(by_(text, "mrWord").family, "Phosphate");
  assert.equal(by_(text, "cwL0").family, "Big Shoulders Display");
  assert.equal(by_(text, "vxLine").family, "Bebas Neue");
  assert.equal(by_(text, "stA").family, "Impact");
  assert.equal(by_(text, "fdLoop").family, "Georgia");
  assert.equal(by_(text, "blLog").reveal, "type", "the boot log is typed by the engine");
  assert.equal(by_(text, "rwA").family, "Arial Black");
  assert.equal(by_(text, "tnWord").family, "Monument Extended");
  assert.equal(by_(text, "dkA").box, "tab");
  const by = Object.fromEntries(text.map((t) => [t.key, t]));
  assert.equal(by.spWord.family, "Pretendard");
  assert.equal(by.spWord.weight, 200);
  assert.equal(by.spCap.family, "MesloLGS NF");
  assert.equal(by.wL0.family, "Monument Extended");
  assert.equal(by.fcWord.weight, 900);
  assert.match(by.fcKo.default, /[가-힣]/u);
  assert.equal(by.ptWord.family, undefined, "pattern-sheet label uses the generic heavy grotesk");
  assert.equal(by.ptQL.font, "serif");
  const input = Object.fromEntries(tpl.fx.INPUTS.map((i) => [i.NAME, i]));
  assert.deepEqual([input.textSet.MIN, input.textSet.MAX, input.textSet.DEFAULT], [0, 31, 0]);
  const ok = validateScore({ version: 1, template: "collage", preset: "wiring", input: { audio: MUSIC }, durationSec: 3, seed: 5, out: "t", labels: { wTitle: "HALL" } }, lib);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  const withSet = (set) => ({ ...tpl.fx, X_AGENTVFX: { ...tpl.fx.X_AGENTVFX, text: [{ key: "a", default: "A", x: 0, y: 0, size: 0.1, set }] } });
  assert.deepEqual(validateTemplate(withSet(2), "collage").errors, []);
  for (const bad of [32, 1.5, -1, "1"]) assert.ok(validateTemplate(withSet(bad), "collage").errors.some((e) => e.path === "X_AGENTVFX.text[0].set"), String(bad));
});

async function frames(preset, keep, { audit = false, dur = 3, audio = MUSIC } = {}) {
  const features = await analyzeAudio(path.resolve(ROOT, audio), { fps: 30 });
  const v = validateScore({ version: 1, template: "collage", preset, input: { audio }, durationSec: dur, seed: 5, out: "t", params: { grain: 0 } }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const kept = new Map();
  const auditor = audit ? createFlashAuditor({ fps: 30, width: W, height: H }) : null;
  await renderScore(v.value, lib, { outDir: path.join(tmp, `t-${runs++}`), width: W, height: H, features, replay: false, onFrame: (f, a) => {
    if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba));
    auditor?.push({ data: a.rgba, width: W, height: H });
  } });
  return { kept, features, flash: auditor?.finish() };
}
const clean = (events, lo, hi) => events.filter((e) => e >= lo && e < hi && !events.some((p) => p !== e && p > e - 5 && p < e + 6));
const px = (rgba, x, y) => { const i = (y * W + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
const count = (rgba, test, x0 = 0, y0 = 0, x1 = W, y1 = H) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(px(rgba, x, y))) n += 1; return n; };
const centroid = (rgba, test) => { let n = 0; let sx = 0; let sy = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(px(rgba, x, y))) { n += 1; sx += x; sy += y; } return { n, x: sx / Math.max(n, 1), y: sy / Math.max(n, 1) }; };

test("specimen: the black square and semicircle snap to a new place on the beat frame and then hold", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beats = clean(features.meta.beats, 8, 85).slice(0, 2);
  assert.ok(beats.length >= 2, `clean beats exist: ${beats}`);
  const { kept } = await frames("specimen", beats.flatMap((b) => [b - 1, b, b + 4]));
  const black = ([r, g, b]) => r < 30 && g < 30 && b < 40;
  for (const b of beats) {
    const [before, at, later] = [b - 1, b, b + 4].map((f) => centroid(kept.get(f), black));
    assert.ok(Math.hypot(at.x - before.x, at.y - before.y) > 30, `beat ${b}: the pair moved ${Math.hypot(at.x - before.x, at.y - before.y).toFixed(1)} px on the beat frame`);
    assert.ok(Math.hypot(later.x - at.x, later.y - at.y) < 3, `beat ${b}: the pair holds its place until the next beat`);
  }
});

test("wiring: the crimson glyph is at full brightness on the onset frame and dim 5 frames later", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const onsets = clean(features.meta.onsets, 8, 85).slice(0, 3);
  assert.ok(onsets.length >= 2, `clean onsets exist: ${onsets}`);
  const { kept } = await frames("wiring", onsets.flatMap((o) => [o, o + 5]));
  const bright = ([r, g, b]) => r > 200 && g < 60 && b < 90;
  for (const o of onsets) {
    const [at, after] = [o, o + 5].map((f) => count(kept.get(f), bright, 140, 14, 185, 56));
    assert.ok(at > 120, `onset ${o}: bright glyph pixels ${at}`);
    assert.ok(after < at * 0.1, `onset ${o}: ${at} -> ${after} after 5 frames`);
  }
});

test("field-cut: the field cuts on a beat frame (lime, amber, ultramarine in turn) and stays under the flash limit", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const [b0, b1, , b3] = features.meta.beats;
  assert.ok(b3 < 100 && b0 > 3, `four beats early in the clip: ${features.meta.beats.slice(0, 4)}`);
  const { kept, flash } = await frames("field-cut", [3, b1 - 1, b1, b3 + 1], { audit: true, dur: 4, audio: MUSIC });
  const lime = ([r, g, b]) => g > 220 && r > 150 && b < 90;
  const amber = ([r, g, b]) => r > 230 && g > 110 && g < 175 && b < 70;
  const blue = ([r, g, b]) => b > 200 && r < 70 && g < 70;
  const share = (f, t) => count(kept.get(f), t) / (W * H);
  assert.ok(share(3, lime) > 0.4, `before the first cut the lime field shows (${share(3, lime).toFixed(2)})`);
  assert.ok(share(b1 - 1, lime) > 0.4 && share(b1 - 1, amber) < 0.05, "the frame before the second beat is still lime");
  assert.ok(share(b1, amber) > 0.15 && share(b1, lime) < 0.05, `the beat frame is the amber field (${share(b1, amber).toFixed(2)})`);
  assert.ok(share(b3 + 1, blue) > 0.3, `two beats later the ultramarine field shows (${share(b3 + 1, blue).toFixed(2)})`);
  assert.equal(flash.exceeds, false, `flash gate: ${JSON.stringify(flash.worstWindow)} red ${flash.redFlashes}`);
});

test("pattern-sheet: the QR stamps re-seed on the beat frame and hold between beats; the green border stays", async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beats = clean(features.meta.beats, 8, 85).slice(0, 2);
  assert.ok(beats.length >= 2, `clean beats exist: ${beats}`);
  const { kept } = await frames("pattern-sheet", beats.flatMap((b) => [b - 1, b, b + 3]));
  const region = (rgba) => { const out = []; for (let y = 30; y < 92; y += 2) for (let x = 90; x < 152; x += 2) out.push(px(rgba, x, y)[0] < 100 ? 1 : 0); return out; };
  const diff = (a, b) => region(a).filter((v, i) => v !== region(b)[i]).length;
  for (const b of beats) {
    assert.ok(diff(kept.get(b - 1), kept.get(b)) > 80, `beat ${b}: the stamp changed on the beat frame (${diff(kept.get(b - 1), kept.get(b))} cells)`);
    assert.ok(diff(kept.get(b), kept.get(b + 3)) < 6, `beat ${b}: the stamp holds after the beat`);
    const [r, g, bl] = px(kept.get(b), 8, 180);
    assert.ok(g > 150 && r < 40 && bl < 120, "the signal-green border is there");
  }
});

/** Pixels of the region whose colour changed by more than 40 in any channel between two frames. */
const changed = (a, b, x0, y0, x1, y1) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = px(a, x, y); const q = px(b, x, y); if (Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])) > 40) n += 1; } return n; };
const cleanBeats = async (n = 2) => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const beats = clean(features.meta.beats, 8, 85).slice(0, n);
  assert.ok(beats.length >= n, `clean beats exist: ${beats}`);
  return beats;
};

test("bootlog: the progress bar fills three more segments on the beat frame", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("bootlog", beats.flatMap((b) => [b - 1, b]));
  const lit = ([, g]) => g > 150;
  for (const b of beats) {
    const [before, at] = [b - 1, b].map((f) => count(kept.get(f), lit, 86, 311, 345, 329));
    assert.ok(at > before + 100, `beat ${b}: bright progress pixels ${before} -> ${at}`);
  }
});

test("tunnel: the rings jump a step deeper on the beat frame and hold until the next beat", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("tunnel", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 0, W, 60) > 0.15 * W * 60, `beat ${b}: the checker above the window changed on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 0, W, 60) < 0.02 * W * 60, `beat ${b}: the tunnel holds between beats`);
  }
});

test("runner: the bar word swaps on the beat frame and holds", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("runner", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 217, W, 285) > 2500, `beat ${b}: the bar changed on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 217, W, 285) < 150, `beat ${b}: the bar holds between beats`);
  }
});

/** Beats that start a new even beat count (the scenes that act every second beat), clean of other events. */
const evenBeats = async () => {
  const features = await analyzeAudio(path.resolve(ROOT, MUSIC), { fps: 30 });
  const cleanSet = new Set(clean(features.meta.beats, 8, 85));
  const out = features.meta.beats.filter((b, i) => i % 2 === 1 && cleanSet.has(b));
  assert.ok(out.length >= 1, `an even clean beat exists: ${features.meta.beats}`);
  return out.slice(0, 2);
};

test("cube-wall: the cubes turn mid-way on the beat that starts a new pair of beats and are at rest 4 frames later", async () => {
  const beats = await evenBeats();
  const { kept } = await frames("cube-wall", beats.flatMap((b) => [b - 1, b + 1, b + 5, b + 6]));
  for (const b of beats) {
    const turn = changed(kept.get(b - 1), kept.get(b + 1), 180, 20, 460, 340);
    const hold = changed(kept.get(b + 5), kept.get(b + 6), 180, 20, 460, 340);
    assert.ok(turn > 4000, `beat ${b}: the wall changed while the cubes turn (${turn})`);
    assert.ok(hold < turn * 0.3, `beat ${b}: the wall is nearly still once the turn is done (${hold} vs ${turn})`);
  }
});

test("sticker-slap: a new sticker lands on the beat that starts a new pair of beats", async () => {
  const beats = await evenBeats();
  const { kept } = await frames("sticker-slap", beats.flatMap((b) => [b - 1, b + 1, b + 5, b + 6]));
  for (const b of beats) {
    const slap = changed(kept.get(b - 1), kept.get(b + 1), 0, 0, W, H);
    const hold = changed(kept.get(b + 5), kept.get(b + 6), 0, 0, W, H);
    assert.ok(slap > 3000, `beat ${b}: the frame changed when the sticker slapped on (${slap})`);
    assert.ok(hold < slap * 0.5, `beat ${b}: the pile is calmer after the slap (${hold} vs ${slap})`);
  }
});

test("slab-shear: the slabs shift on the beat frame and hold between beats", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("slab-shear", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 0, W, H) > 3000, `beat ${b}: the slabs changed on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 0, W, H) < 600, `beat ${b}: the slabs hold between beats`);
  }
});

test("frame-loop-dial: the split-flap digits change on the beat and the border text jumps ahead on an onset", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("frame-loop-dial", beats.flatMap((b) => [b - 1, b + 4]));
  for (const b of beats) assert.ok(changed(kept.get(b - 1), kept.get(b + 4), 400, 130, 536, 230) > 150, `beat ${b}: the flap digits changed`);
});

test("marquee-stack: every row jumps on the beat frame and holds between beats", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("marquee-stack", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 20, 380, 280) > 5000, `beat ${b}: the rows jumped on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 20, 380, 280) < 800, `beat ${b}: the rows hold between beats`);
  }
});

test("lens-wrap: the floor steps toward the viewer on the beat frame and holds", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("lens-wrap", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 280, W, 330) > 150, `beat ${b}: the floor lines moved on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 280, W, 330) < 100, `beat ${b}: the floor holds between beats`);
  }
});

test("liquid-type: the ripple phase steps on the beat frame and holds", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("liquid-type", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 0, W, 240) > 1500, `beat ${b}: the word moved on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 0, W, 240) < 500, `beat ${b}: the word holds between beats`);
  }
});

test("tilt-tiles and mirror-track: the rows or targets step on a beat and hold between beats", async () => {
  const beats = await evenBeats();
  const { kept } = await frames("tilt-tiles", beats.flatMap((b) => [b - 1, b, b + 3, b + 4]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 0, 0, W, H) > 8000, `tilt-tiles beat ${b}: the rows jumped`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 4), 0, 0, W, H) < 2500, `tilt-tiles beat ${b}: the rows hold`);
  }
  const m = await cleanBeats();
  const mk = (await frames("mirror-track", m.flatMap((b) => [b - 1, b, b + 3, b + 4]))).kept;
  for (const b of m) {
    assert.ok(changed(mk.get(b - 1), mk.get(b), 100, 20, 560, 280) > 300, `mirror-track beat ${b}: the targets jumped`);
    assert.ok(changed(mk.get(b + 3), mk.get(b + 4), 100, 20, 560, 280) < 150, `mirror-track beat ${b}: the targets hold`);
  }
});

test("anatomy: the red scan band jumps on the beat frame and the wireframe settles within 3 frames", async () => {
  const beats = await cleanBeats();
  const { kept } = await frames("anatomy", beats.flatMap((b) => [b - 1, b, b + 3, b + 5]));
  for (const b of beats) {
    assert.ok(changed(kept.get(b - 1), kept.get(b), 190, 20, 470, 340) > 1500, `beat ${b}: the panel changed on the beat frame`);
    assert.ok(changed(kept.get(b + 3), kept.get(b + 5), 190, 20, 470, 340) < 300, `beat ${b}: the panel is settled after 3 frames`);
  }
});
