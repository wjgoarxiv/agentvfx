import { b, c, f, hex, l, microLines } from "../shared/defs.mjs";

const mono = (key, def, x, y, size, extra = {}) => ({ key, default: def, x, y, size, font: "mono", ...extra });
const freq = (key, def, x) => mono(key, def, x, 0.9361, 0.0098, { align: "center" });

const INPUTS = [
  c("groundColor", [0.043, 0.043, 0.047, 1]), c("inkColor", [0.914, 0.914, 0.894, 1]), c("winBg", [0.02, 0.02, 0.022, 1]),
  c("tone", [0.914, 0.914, 0.894, 1]), f("dimAmount", 0, 1, 0.5),
  l("deckLayout", [0, 1], ["night-deck", "tiles"], 0), l("winShape", [0, 1, 2], ["rect", "rounded", "octagon"], 0),
  f("winX", 0.2, 0.8, 0.3542), f("winY", 0.3, 0.7, 0.3657), f("winW", 0.3, 0.85, 0.6771), f("winH", 0.4, 0.98, 0.6759),
  f("chamfer", 20, 300, 150), b("marks", true),
  l("mediaMode", [0, 1, 2, 3], ["natural", "mono", "halftone", "duotone"], 0), f("mediaContrast", 0.5, 3, 1.25), f("mediaBias", -0.5, 0.5, 0),
  f("dotSize", 3, 24, 8), f("dotAngle", 0, 1.5708, 0.7854),
  f("flare", 0, 1, 0.85), f("flareX", 0, 1, 0.5), f("flareY", 0, 1, 0.5), f("flareW", 0.05, 0.6, 0.42), f("flareBeat", 0, 1, 0.8),
  f("tearAmount", 0, 1, 0.4),
  f("reactivity", 0, 2, 1), f("spectrumGain", 0.2, 1.5, 1), f("waveGain", 0.2, 4, 2.4), f("particleDensity", 0.3, 2.5, 1.1),
  f("driftSpeed", 0, 3, 1), f("contourScale", 0.5, 4, 1.7), f("contourLevels", 2, 8, 3.6), f("introMs", 0, 3000, 600),
  f("startFreq", 20, 400, 50), f("endFreq", 3000, 20000, 12800), f("floorLevel", 0, 0.6, 0.14), f("ceilLevel", 0.2, 1, 0.72),
  f("specExp", 0.5, 3, 1.5), f("attackMs", 1, 300, 16), f("releaseMs", 20, 1500, 240),
];

const TEXT = [
  { key: "artist", default: "SIGMA7", x: 0.0156, y: 0.752, size: 0.066, font: "display", style: "fill" },
  mono("artistTag", "ARTIST", 0.0156, 0.7333, 0.0098),
  { key: "track", default: "RELAY", x: 0.0156, y: 0.8463, size: 0.066, font: "display", style: "fill" },
  mono("trackTag", "TRACK", 0.0156, 0.8278, 0.0098),
  { key: "title", default: "SIGNAL//04", x: 0.9844, y: 0.8852, size: 0.066, font: "tall", style: "fill", weight: 500, align: "right", tracking: 0.14 },
  freq("f1", "50Hz", 0.2917), freq("f2", "200Hz", 0.3919), freq("f3", "800Hz", 0.4922), freq("f4", "3.2k", 0.5924), freq("f5", "12.8k", 0.6927),
  mono("winTag", "LV-0417 *", 0.0156, 0.712, 0.0095),
  mono("code", microLines(31, 3, 34), 0.7135, 0.7852, 0.0105, { lineHeight: 2.2, reveal: "type", revealStart: 0.6, revealDur: 1.4 }),
  mono("microL", microLines(7, 15, 40), 0.0151, 0.372, 0.0085, { lineHeight: 1.25 }),
  mono("microR", microLines(19, 15, 40), 0.8604, 0.372, 0.0085, { lineHeight: 1.25 }),
];

const NIGHT = {};
const ULTRA = {
  groundColor: hex("#1414ff"), inkColor: hex("#dcd3ff"), winBg: hex("#0a0a9e"), tone: hex("#c9b8ff"), mediaMode: 2, dotSize: 8,
  mediaContrast: 1.45, flare: 0.55, dimAmount: 0.55,
};
const ACID = {
  groundColor: hex("#c8ff00"), inkColor: hex("#0b0b0c"), winBg: hex("#0b0b0c"), tone: hex("#c8ff00"), mediaMode: 3, dimAmount: 0.6,
  mediaContrast: 1.3, flare: 0.7,
};
const OCTAGON = {
  winShape: 2, deckLayout: 1, winX: 0.55, winY: 0.47, winW: 0.58, winH: 0.7, chamfer: 96, flare: 0, marks: false, mediaContrast: 1.15,
  inkColor: hex("#ffb21a"), dimAmount: 0.2,
};
const ORANGE = {
  groundColor: hex("#ff3c00"), inkColor: hex("#0b0b0c"), winBg: hex("#0b0b0c"), tone: hex("#ff3c00"), mediaMode: 1, dimAmount: 0.6,
  mediaContrast: 1.5, flare: 0.6,
};

const fx = {
  DESCRIPTION: "Neo-brutalist control desk: a wide framed media window (rect, rounded or chamfered octagon) over a desk of artist and track labels, waveform strip and hatched spectrum, beside a rail with a contour map, particle box, beat sequencer and micro code, all following the music",
  CREDIT: "agentvfx",
  ISFVSN: "2",
  CATEGORIES: ["brutal", "hud", "audio"],
  INPUTS,
  PASSES: [{ TARGET: "specState", PERSISTENT: true, FLOAT: true }, {}],
  X_AGENTVFX: {
    id: "hud-deck", family: "brutal", input: "either", spdx: "Apache-2.0", flash: "possible", fps: 30, palette: false,
    presets: { night: NIGHT, ultramarine: ULTRA, acid: ACID, octagon: OCTAGON, "orange-mono": ORANGE },
    audioBind: { spectrumGain: "bands", flare: "beat" },
    safeSubstitute: { params: { flare: 0, tearAmount: 0 } },
    text: TEXT,
    credits: [
      "Instrument-panel grammar (original drawing; no names, marks, fonts or footage from other works)",
      "2D signed distance functions after Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/ (circle, box, segment, ellipse, triangle); 3x5 digit font, dot screen, Bayer 8x8 index and glyph icons are original",
      "Spectrum column mapping: log-spaced columns, peak-preserving neighbour smoothing, attack/release follower (same structure as the agentvfx spectrum family)",
    ],
  },
};

const MUSIC = "test-media/beat-132.mp3";
const demo = (video, seed, labels, startSec = 2) => ({ input: { video, audio: MUSIC, startSec }, durationSec: 4, seed, labels });
const demos = {
  night: demo("test-media/clip-02.mp4", 41, { artist: "SIGMA7", track: "RELAY", title: "SIGNAL//04" }, 4),
  ultramarine: demo("test-media/clip-01.mp4", 42, { artist: "VANTA", track: "HALO-9", title: "PLATE//77", winTag: "UM-3301 *" }),
  acid: demo("test-media/clip-02.mp4", 43, { artist: "KRAIT", track: "DRIFT", title: "NODE//7G", winTag: "AC-0075 *" }, 4),
  octagon: demo("test-media/clip-01.mp4", 44, {}),
};
export default { fx, demos };
