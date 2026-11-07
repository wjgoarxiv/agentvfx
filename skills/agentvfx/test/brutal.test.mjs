// Brutal family (plan task 14, first slice): hud-deck, halftone-field, boot-log. Validation of every preset and
// demo, 90-frame render + determinism + flash report per template, text ink, halftone dot structure,
// window shapes, audio-following panels and the beat flare.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
const IDS = ["hud-deck", "halftone-field", "boot-log"];
const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-brutal-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
let runs = 0;

const score = (template, preset, extra = {}) => {
  const v = validateScore({ version: 1, template, ...(preset ? { preset } : {}), durationSec: 3, seed: 7, out: "t", ...extra }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
};

/** Render a score at w x h and keep the RGBA of the wanted frames (audio features from `audio` when given). */
async function frames(s, keep, [w, h] = [640, 360], audio = null) {
  const features = audio ? await analyzeAudio(path.resolve(ROOT, audio), { fps: 30 }) : null;
  const kept = new Map();
  await renderScore(s, lib, { outDir: path.join(tmp, `r-${runs++}`), width: w, height: h, features, replay: false, onFrame: (f, a) => { if (keep.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
  return { kept, features };
}
/** Pixels in the (fractional) region whose channel `ch` is above `min`. */
function count(rgba, [w, h], [x0, y0, x1, y1], ch, min) {
  let n = 0;
  for (let y = Math.round(y0 * h); y < Math.round(y1 * h); y++) for (let x = Math.round(x0 * w); x < Math.round(x1 * w); x++) if (rgba[(y * w + x) * 4 + ch] > min) n += 1;
  return n;
}
const px = (rgba, w, x, y) => { const o = (y * w + x) * 4; return [rgba[o], rgba[o + 1], rgba[o + 2]]; };

test("every preset of every brutal template validates, with at least three presets, a flash class and demos", () => {
  for (const id of IDS) {
    const tpl = lib.get(id);
    assert.ok(tpl, `${id} is in the library`);
    assert.equal(tpl.family, "brutal");
    assert.ok(Object.keys(tpl.fx.X_AGENTVFX.presets).length >= 3, `${id} has at least 3 presets`);
    assert.ok(["none", "possible", "strobe"].includes(tpl.fx.X_AGENTVFX.flash));
    for (const preset of Object.keys(tpl.fx.X_AGENTVFX.presets)) score(id, preset, tpl.fx.X_AGENTVFX.input === "footage" ? { input: { video: "test-media/clip-01.mp4" } } : {});
    const demos = readdirSync(tpl.dir).filter((f) => f.startsWith("demo-"));
    assert.ok(demos.length >= 3, `${id} has demo scores`);
    for (const d of demos) {
      const demo = JSON.parse(readFileSync(path.join(tpl.dir, d), "utf8"));
      const v = validateScore(demo, lib);
      assert.equal(v.ok, true, `${d}: ${JSON.stringify(v.errors)}`);
      assert.equal(demo.durationSec, 4);
      if (demo.input?.video) assert.ok(existsSync(path.join(ROOT, demo.input.video)));
      assert.equal(demo.input.audio, MUSIC);
    }
  }
});

for (const id of IDS) {
  test(`${id}: demo renders every frame, passes determinism, reports flashes, muxes audio`, async () => {
    const tpl = lib.get(id);
    const demo = JSON.parse(readFileSync(path.join(tpl.dir, readdirSync(tpl.dir).filter((f) => f.startsWith("demo-")).sort()[0]), "utf8"));
    const s = validateScore({ ...demo, durationSec: 3, out: "t" }, lib).value;
    const gate = await runJob(s, lib, { outDir: path.join(tmp, `job-${id}`), width: 320, height: 180, cwd: ROOT });
    assert.equal(gate.render.frames, 90);
    assert.equal(gate.determinism.pass, true, JSON.stringify(gate.determinism));
    assert.equal(typeof gate.flash.exceeds, "boolean");
    assert.equal(typeof gate.flash.flashesPerSecondMax, "number");
  });
}

test("hud-deck: label text draws ink in the desk and the tall title, and labels override", async () => {
  const size = [640, 360];
  const { kept } = await frames(score("hud-deck", "night"), [75], size);
  const f = kept.get(75);
  assert.ok(count(f, size, [0.012, 0.745, 0.2, 0.82], 0, 160) > 250, "artist label in the desk");
  assert.ok(count(f, size, [0.012, 0.84, 0.2, 0.915], 0, 160) > 250, "track label in the desk");
  assert.ok(count(f, size, [0.7, 0.88, 0.99, 0.975], 0, 160) > 200, "tall title bottom right");
  const wide = await frames(score("hud-deck", "night", { labels: { title: "WWWWWWWWWW" } }), [75], size);
  assert.ok(count(wide.kept.get(75), size, [0.4, 0.88, 0.99, 0.975], 0, 160) > count(f, size, [0.4, 0.88, 0.99, 0.975], 0, 160), "longer title -> more ink");
});

test("hud-deck: spectrum graph and waveform follow the music and sit at the floor in silence", async () => {
  const size = [960, 540];
  const music = await frames(score("hud-deck", "night", { input: { audio: MUSIC } }), [60], size, MUSIC);
  const quiet = await frames(score("hud-deck", "night"), [60], size);
  const above = [0.3, 0.75, 0.68, 0.9];
  const loud = count(music.kept.get(60), size, above, 0, 200);
  assert.ok(loud > 30, `spectrum line above the floor with music: ${loud}`);
  assert.ok(count(quiet.kept.get(60), size, above, 0, 200) < 8, "silent spectrum stays on the floor");
  const waveBox = [0.02, 0.915, 0.26, 0.96];
  assert.ok(count(music.kept.get(60), size, waveBox, 0, 150) > count(quiet.kept.get(60), size, waveBox, 0, 150) + 40, "waveform strip draws the wave");
});

test("hud-deck: the window is a chamfered octagon in the octagon preset, a rect otherwise", async () => {
  const size = [640, 360];
  const solid = { params: { mediaMode: 3, winBg: [1, 1, 1, 1], tone: [1, 1, 1, 1], flare: 0, tearAmount: 0 } };
  const oct = await frames(score("hud-deck", "octagon", solid), [70], size);
  const rect = await frames(score("hud-deck", "octagon", { params: { ...solid.params, winShape: 0 } }), [70], size);
  const corner = [Math.round((0.55 - 0.29) * 640) + 6, Math.round((0.47 - 0.35) * 360) + 6];
  const centre = [320, 190];
  assert.ok(px(oct.kept.get(70), 640, ...corner)[0] < 40, "octagon corner is ground");
  assert.ok(px(rect.kept.get(70), 640, ...corner)[0] > 200, "rect corner is the window");
  assert.ok(px(oct.kept.get(70), 640, ...centre)[0] > 200, "octagon centre is the window");
});

test("hud-deck: the white-hot light bar breathes with the beat", async () => {
  const size = [640, 360];
  const base = await frames(score("hud-deck", "night", { input: { audio: MUSIC } }), Array.from({ length: 80 }, (_, i) => i), size, MUSIC);
  const off = await frames(score("hud-deck", "night", { input: { audio: MUSIC }, params: { flare: 0 } }), Array.from({ length: 80 }, (_, i) => i), size, MUSIC);
  const beat = base.features.meta.beats.find((b) => b >= 20 && b < 65);
  assert.ok(beat !== undefined, "a beat inside the window");
  const band = [0.3542 - 0.2, 0.3657 - 0.05, 0.3542 + 0.2, 0.3657 + 0.05];
  const light = (f) => { let s = 0; const a = base.kept.get(f); const b = off.kept.get(f); for (let y = Math.round(band[1] * 360); y < Math.round(band[3] * 360); y++) for (let x = Math.round(band[0] * 640); x < Math.round(band[2] * 640); x++) s += Math.max(0, a[(y * 640 + x) * 4 + 1] - b[(y * 640 + x) * 4 + 1]); return s; };
  assert.ok(light(beat + 1) > 1000, `flare adds light on the beat: ${light(beat + 1)}`);
  assert.ok(light(beat + 1) > light(Math.min(beat + 10, 79)) * 1.1, "brighter on the beat than between beats");
});

test("halftone-field: single-tone dot lattice at the set pitch, binary dither and glyph screens stay on two colours", async () => {
  const size = [960, 540];
  const params = { cell: 24, dotAngle: 0, tearAmount: 0, kickGain: 0, textKnock: 0 };
  const field = [20, 20, 255];
  const dot = [203, 189, 255];
  const region = [0.36, 0.56, 0.64, 0.9];
  const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const srgb = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const twoTone = (rgba, lim) => {
    let on = 0;
    let all = 0;
    for (let y = Math.round(region[1] * 540); y < Math.round(region[3] * 540); y++) {
      for (let x = Math.round(region[0] * 960); x < Math.round(region[2] * 960); x++) {
        const p = px(rgba, 960, x, y);
        const t = Math.min(1, Math.max(0, (lin(p[0]) - lin(field[0])) / (lin(dot[0]) - lin(field[0]))));
        const err = Math.max(...p.map((v, i) => Math.abs(v - srgb(lin(field[i]) + (lin(dot[i]) - lin(field[i])) * t))));
        all += 1;
        if (err <= lim) on += 1;
      }
    }
    return on / all;
  };
  const a = await frames(score("halftone-field", "ultramarine", { params }), [40], size);
  const f = a.kept.get(40);
  assert.ok(twoTone(f, 12) > 0.99, `dot screen is one tone: ${twoTone(f, 12)}`);
  const prof = [];
  for (let x = Math.round(region[0] * 960); x < Math.round(region[2] * 960); x++) { let s = 0; for (let y = Math.round(region[1] * 540); y < Math.round(region[3] * 540); y++) s += px(f, 960, x, y)[0]; prof.push(s); }
  const mean = prof.map((_, i) => { let s = 0; let n = 0; for (let k = Math.max(0, i - 12); k <= Math.min(prof.length - 1, i + 12); k++) { s += prof[k]; n += 1; } return s / n; });
  const z = prof.map((v, i) => v - mean[i]);
  const ac = (lag) => { let s = 0; for (let i = 0; i + lag < z.length; i++) s += z[i] * z[i + lag]; return s; };
  assert.ok(ac(12) > 0.3 * ac(0), `pitch 24 design px = 12 px at 960x540: lag-12 autocorrelation ${(ac(12) / ac(0)).toFixed(2)}`);
  assert.ok(ac(12) > ac(6) + 0.4 * ac(0), "half-pitch lag is anti-phase");
  const lo = Math.min(...prof);
  const hi = Math.max(...prof);
  assert.ok(hi > lo * 1.01, "dot area varies with the image tone");
  const dither = await frames(score("halftone-field", "dither", { params: { tearAmount: 0, kickGain: 0, textKnock: 0 } }), [40], size);
  assert.ok(twoTone(dither.kept.get(40), 6) > 0.995, `ordered dither is binary: ${twoTone(dither.kept.get(40), 6)}`);
});

test("halftone-field: pink and cyan micro bars hang on the image edges and the tall headline draws ink", async () => {
  const size = [640, 360];
  const { kept } = await frames(score("halftone-field", "ultramarine", { input: { audio: MUSIC } }), [60], size, MUSIC);
  const f = kept.get(60);
  const pink = count(f, size, [0.03, 0.15, 0.1, 0.95], 0, 230);
  assert.ok(pink > 40, `edge bars on the left edge: ${pink}`);
  assert.ok(count(f, size, [0.04, 0.1, 0.45, 0.5], 0, 215) > 200, "headline ink");
});

test("boot-log: the log types out, the headline decodes only after the log, then holds still", async () => {
  const size = [640, 360];
  const quiet = { params: { flickerAmount: 0, scanAmount: 0, tearAmount: 0, streakAmount: 0, dustAmount: 0 } };
  const { kept } = await frames(score("boot-log", "phosphor", { ...quiet, durationSec: 4 }), [8, 40, 85, 112, 119], size);
  const logBox = [0.03, 0.24, 0.45, 0.62];
  const headBox = [0.03, 0.68, 0.45, 0.84];
  const lit = (f, box) => count(kept.get(f), size, box, 1, 140);
  assert.ok(lit(8, logBox) < lit(40, logBox), "log grows while typing");
  assert.ok(lit(40, logBox) < lit(85, logBox), "log keeps typing");
  assert.ok(lit(40, headBox) < 12, "headline hidden before the decode");
  assert.ok(lit(112, headBox) > 120, "headline drawn after the decode");
  let diff = 0;
  const a = kept.get(112);
  const b = kept.get(119);
  for (let y = Math.round(headBox[1] * 360); y < Math.round(headBox[3] * 360); y++) for (let x = Math.round(headBox[0] * 640); x < Math.round(headBox[2] * 640); x++) diff += Math.abs(a[(y * 640 + x) * 4 + 1] - b[(y * 640 + x) * 4 + 1]);
  assert.ok(diff / ((headBox[2] - headBox[0]) * 640 * (headBox[3] - headBox[1]) * 360) < 2.5, "decoded headline is stable");
});
