import { b, c, f, hex, l } from "../shared/defs.mjs";

const mono = (key, def, x, y, extra = {}) => ({ key, default: def, x, y, size: 0.0105, font: "mono", ...extra });

const INPUTS = [
  c("fieldColor", hex("#1414ff")), c("dotColor", hex("#cbbdff")), c("inkColor", hex("#dcd3ff")), c("textColor", hex("#e8e2ff")),
  c("barA", hex("#ff6ad5")), c("barB", hex("#00e5ff")),
  l("screenMode", [0, 1, 2], ["dots", "ordered-dither", "ascii-cells"], 0),
  f("cell", 4, 28, 10), f("dotAngle", 0, 1.5708, 0.7854), f("dotGain", 0.5, 1.6, 1.12), b("invert", false),
  f("imgContrast", 0.5, 3, 1.5), f("imgBias", -0.5, 0.5, 0),
  f("imgX", 0.2, 0.8, 0.5), f("imgY", 0.3, 0.7, 0.5), f("imgW", 0.4, 1, 0.9), f("imgH", 0.4, 1, 0.86),
  f("frameAmount", 0, 1, 1), b("marks", true), f("barAmount", 0, 1, 1), f("barDensity", 0, 1, 0.55),
  f("textKnock", 0, 1, 1), f("tearAmount", 0, 1, 0.3), f("kickGain", 0, 1, 0.8), f("reactivity", 0, 2, 1), f("introMs", 0, 3000, 500),
];

const TEXT = [
  { key: "headline", default: "PLATE//77", x: 0.052, y: 0.105, size: 0.17, font: "tall", style: "fill", weight: 300, tracking: 0.03 },
  mono("labelA", "NODE 7G-75 // PLATE 0417", 0.05, 0.022, { reveal: "type", revealStart: 0.3, revealDur: 1.2 }),
  mono("labelB", "LV//VFX  45DEG  4.0S", 0.95, 0.022, { align: "right" }),
  mono("labelC", "SCREEN 10PX / MONO / 1-TONE", 0.05, 0.9505),
  mono("labelD", "FRAME 0417 / 0120", 0.95, 0.9505, { align: "right" }),
];

const ULTRA = {};
const INK_BLUE = { fieldColor: hex("#0a0a9e"), dotColor: hex("#c4b5fd"), inkColor: hex("#c4b5fd"), textColor: hex("#d8ccff") };
const ACID = {
  fieldColor: hex("#c8ff00"), dotColor: hex("#0b0b0c"), inkColor: hex("#0b0b0c"), textColor: hex("#0b0b0c"), invert: true,
  barA: hex("#ff2e7e"), barB: hex("#1414ff"), imgContrast: 1.7,
};
const ORANGE = {
  fieldColor: hex("#ff3c00"), dotColor: hex("#0b0b0c"), inkColor: hex("#0b0b0c"), textColor: hex("#0b0b0c"), invert: true,
  barA: hex("#fff4e0"), barB: hex("#1414ff"), imgContrast: 1.7,
};
const PHOSPHOR = {
  fieldColor: hex("#050805"), dotColor: hex("#39ff14"), inkColor: hex("#39ff14"), textColor: hex("#7dff5c"), dotGain: 1.0,
};
const DITHER = { screenMode: 1, cell: 9, imgContrast: 1.7 };
const ASCII = {
  fieldColor: hex("#c8ff00"), dotColor: hex("#0b0b0c"), inkColor: hex("#0b0b0c"), textColor: hex("#0b0b0c"), invert: true,
  barA: hex("#ff2e7e"), barB: hex("#1414ff"), screenMode: 2, cell: 8, imgContrast: 1.8,
};

const fx = {
  DESCRIPTION: "Footage as a single-tone dot matrix on a full solid field: dot screen, ordered dither or ASCII cells, hairline frame, pink and cyan micro bars on the image edges and a tall thin headline",
  CREDIT: "agentvfx",
  ISFVSN: "2",
  CATEGORIES: ["brutal", "halftone", "audio"],
  INPUTS,
  X_AGENTVFX: {
    id: "halftone-field", family: "brutal", input: "either", spdx: "LicenseRef-agentvfx", flash: "possible", fps: 30, palette: false,
    presets: { ultramarine: ULTRA, "ink-blue": INK_BLUE, acid: ACID, orange: ORANGE, phosphor: PHOSPHOR, dither: DITHER, ascii: ASCII },
    audioBind: { dotGain: "bass", barAmount: "bands" },
    safeSubstitute: { params: { tearAmount: 0, kickGain: 0 } },
    text: TEXT,
    credits: [
      "Single-tone halftone / dot-matrix field grammar (original drawing; no images, marks or fonts from other works)",
      "Dot screen: rotated square lattice, dot area follows tone (classic AM halftone); ordered dither: 8x8 Bayer index matrix (Bryce Bayer, 1973); ASCII cells: original procedural glyphs",
    ],
  },
};

const MUSIC = "test-media/beat-132.mp3";
const demo = (video, seed, labels, startSec) => ({ input: { video, audio: MUSIC, startSec }, durationSec: 4, seed, labels });
const demos = {
  ultramarine: demo("test-media/clip-01.mp4", 51, { headline: "PLATE//77" }, 3),
  acid: demo("test-media/clip-02.mp4", 52, { headline: "SIGNAL 04", labelA: "NODE 7G-75 // KRAIT 0075" }, 5),
  orange: demo("test-media/clip-01.mp4", 53, { headline: "HEAT//31", labelA: "NODE 5C-31 // ORANGE 0031" }, 5),
  phosphor: demo("test-media/clip-02.mp4", 54, { headline: "ECHO/DOT", labelA: "NODE 2P-12 // PHOS 0012" }, 5),
  dither: demo("test-media/clip-01.mp4", 55, { headline: "BAYER 8", labelC: "SCREEN 9PX / ORDERED / 1-BIT" }, 2),
  ascii: demo("test-media/clip-02.mp4", 56, { headline: "CELL//08", labelC: "SCREEN 12PX / GLYPH / 6-LEVEL" }, 5),
};
export default { fx, demos };
