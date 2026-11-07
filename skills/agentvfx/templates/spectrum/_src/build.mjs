// Spectrum family build: templates share one GLSL "pro motion" stage and one "label stage" (camera,
// background, particle field, finish), and GLSL has no #include, so the sources live in _src/ and
// this script writes the standalone template folders. Run: node templates/spectrum/_src/build.mjs
// (the folder name starts with "_", so the template loader never treats _src as a template).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(SRC, "..");
const f = (NAME, MIN, MAX, DEFAULT) => ({ NAME, TYPE: "float", MIN, MAX, DEFAULT });

/** Pro motion stage: bin mapping, peak-preserving smoothing, per-bar exponent, head margin, attack / release, caps. */
const PRO = [
  f("startFreq", 10, 2000, 40), f("endFreq", 100, 20000, 14000), f("freqCurve", 1, 4, 2.2),
  f("floorLevel", 0, 0.6, 0.2), f("ceilLevel", 0.2, 1, 0.62), f("expLow", 0.5, 8, 2.1), f("expHigh", 0.5, 8, 1.3),
  f("monsterSmooth", 1.05, 3, 1.55), f("headBars", 0, 0.4, 0.12), f("headMin", 0, 1, 0.7), f("tilt", 0, 0.1, 0.02),
  f("attackMs", 1, 300, 14), f("releaseMs", 20, 1500, 150), f("bassHold", 0, 3, 0.8),
  f("capGravity", 0.1, 8, 2.2), f("capHoldMs", 0, 600, 90),
];
/** Stage: kick zoom, shake, background mode, flecks, vignette, grain, intro, hit thresholds. */
const STAGE = [
  f("kickZoom", 0, 0.15, 0), f("kickDecayMs", 30, 600, 120), f("kickBass", 0, 6, 1.6), f("shake", 0, 24, 0),
  { NAME: "bgMode", TYPE: "long", MIN: 0, MAX: 2, VALUES: [0, 1, 2], LABELS: ["flat", "blurred-footage", "halftone-footage"], DEFAULT: 2 },
  f("bgDim", 0, 1, 0.16), f("halftoneSize", 3, 24, 7), f("fieldAmount", 0, 1, 0), f("fieldSpeed", 0, 4, 1),
  f("vignette", 0, 1, 0), f("grain", 0, 0.12, 0.02), f("introMs", 0, 2000, 500), f("hitFlux", 0, 2, 0.9),
];
/** HUD ground / ink / accent, hairline width, optional palette accent and glow. */
const HUD = [
  { NAME: "groundColor", TYPE: "color", DEFAULT: [0.043, 0.043, 0.047, 1] },
  { NAME: "inkColor", TYPE: "color", DEFAULT: [0.914, 0.914, 0.894, 1] },
  { NAME: "accentColor", TYPE: "color", DEFAULT: [0.784, 1, 0, 1] },
  f("lineWidth", 0.8, 4, 1.5), f("gridAmount", 0, 1, 1),
  { NAME: "colorMode", TYPE: "long", MIN: 0, MAX: 1, VALUES: [0, 1], LABELS: ["accent", "palette-by-frequency"], DEFAULT: 0 },
  f("paletteShift", 0, 1, 0), f("glow", 0, 3, 0), f("glowRadius", 0.002, 0.1, 0.012),
  { NAME: "marks", TYPE: "bool", DEFAULT: true },
];

const SHARED = { pro: PRO, stage: STAGE, hud: HUD };
/** Full-frame field looks, merged into any preset that names one with "$field". */
const dark = [0.04, 0.04, 0.04, 1];
const FIELDS = {
  acid: { groundColor: [0.784, 1, 0, 1], inkColor: dark, accentColor: dark },
  ultramarine: { groundColor: [0.078, 0.078, 1, 1], inkColor: [0.95, 0.95, 0.92, 1], accentColor: [1, 1, 1, 1] },
  orange: { groundColor: [1, 0.235, 0, 1], inkColor: dark, accentColor: dark },
  phosphor: { groundColor: [0.02, 0.03, 0.02, 1], inkColor: [0.224, 1, 0.078, 1], accentColor: [0.224, 1, 0.078, 1] },
};
const resolvePresets = (presets) => Object.fromEntries(Object.entries(presets).map(([name, { $field, ...rest }]) => [name, $field ? { ...FIELDS[$field], ...rest } : rest]));
const include = (text) => text.replace(/^\/\/@include (\S+)\s*$/gmu, (_, name) => include(readFileSync(path.join(SRC, "shared", name), "utf8").trimEnd()));

for (const id of readdirSync(SRC)) {
  const dir = path.join(SRC, id);
  let src;
  try {
    src = JSON.parse(readFileSync(path.join(dir, "fx.src.json"), "utf8"));
  } catch {
    continue;
  }
  const { use = [], defaults = {}, ...fx } = src;
  fx.INPUTS = [...fx.INPUTS, ...use.flatMap((k) => SHARED[k])].map((input) => (input.NAME in defaults ? { ...input, DEFAULT: defaults[input.NAME] } : input));
  fx.X_AGENTVFX.presets = resolvePresets(fx.X_AGENTVFX.presets);
  const out = path.join(OUT, id);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "fx.json"), `${JSON.stringify(fx, null, 2)}\n`);
  for (const file of readdirSync(dir).filter((n) => n.endsWith(".src.frag"))) {
    writeFileSync(path.join(out, file.replace(".src.frag", ".frag")), include(readFileSync(path.join(dir, file), "utf8")));
  }
}
