import { c, f, hex } from "../shared/defs.mjs";

const mono = (key, def, x, y, size, extra = {}) => ({ key, default: def, x, y, size, font: "mono", ...extra });

const INPUTS = [
  c("fieldColor", hex("#020503")), c("inkColor", hex("#39ff14")), c("hotColor", hex("#d9ffd2")),
  f("logDone", 1, 3.5, 2.4), f("dustAmount", 0, 1, 0.8), f("streakAmount", 0, 1, 1), f("tearAmount", 0, 1, 0.6),
  f("scanAmount", 0, 1, 0.35), f("flickerAmount", 0, 0.5, 0.12), f("vignette", 0, 1, 0.45), f("bloomAmount", 0, 2, 0.9),
  f("letterbox", 0, 120, 46), f("introMs", 0, 3000, 500),
];

const LOG = [
  "AGENT//VFX BOOT 0x7G75", "MOUNT /ARCHIVE/COLD-04 ........ OK", "CACHE 4096K PAGES ......... ALIGNED", "RELAY NODE 7G-75 .......... LINKED",
  "CHECKSUM 91C2 E81B ........ PASS", "LOAD SECTOR 0417 .......... 73%", "DECODE FRAME TABLE ........ OK", "SCAN 0x00F0..0x0FFF ...... CLEAN",
  "SIGNAL BUS 04 ............. UP", "PHASE LOCK 48.000K ........ HELD", "SEED 0x4A7C ............... SET", "HANDSHAKE ACCEPTED ........ OK", "RUN //",
].join("\n");

const TEXT = [
  mono("tagA", "AGENT//VFX // COLD ARCHIVE\nNODE 7G-75   BUILD 0417\nSECTOR 04 / SIGNAL OK", 0.111, 0.066, 0.0135, { lineHeight: 1.45 }),
  mono("tagB", "BOOT 0x7G75\nREV 04.17.31", 0.9, 0.066, 0.0135, { align: "right", lineHeight: 1.45 }),
  mono("log", LOG, 0.033, 0.245, 0.0245, { lineHeight: 1.18, reveal: "type", revealStart: 0.2, revealDur: 2.2 }),
  mono("status", "BOOT SEQUENCE", 0.033, 0.848, 0.0135),
  { key: "headline", default: "NODE 7G ONLINE", x: 0.033, y: 0.69, size: 0.11, font: "display", style: "fill", reveal: "decode", revealStart: 2.5, revealDur: 0.9 },
];

const PHOSPHOR = {};
const ACID = { fieldColor: hex("#c8ff00"), inkColor: hex("#0b0b0c"), hotColor: hex("#0b0b0c"), bloomAmount: 0.35, scanAmount: 0.25, dustAmount: 1, vignette: 0.3 };
const ULTRA = { fieldColor: hex("#1414ff"), inkColor: hex("#dcd3ff"), hotColor: hex("#ffffff"), bloomAmount: 0.7, vignette: 0.35 };
const AMBER = { fieldColor: hex("#0a0600"), inkColor: hex("#ffb000"), hotColor: hex("#fff0c8"), bloomAmount: 1.1 };

const fx = {
  DESCRIPTION: "Boot log: monospace kernel log typing over a field with a dot-matrix emblem, corner + marks, scrolling side readouts, a progress bar and a decode headline; scanlines, slight bloom, flicker and beat tears",
  CREDIT: "agentvfx",
  ISFVSN: "2",
  CATEGORIES: ["brutal", "terminal", "audio"],
  INPUTS,
  X_AGENTVFX: {
    id: "boot-log", family: "brutal", input: "generative", spdx: "Apache-2.0", flash: "possible", fps: 30, palette: false,
    presets: { phosphor: PHOSPHOR, acid: ACID, ultramarine: ULTRA, amber: AMBER },
    audioBind: { tearAmount: "beat" },
    safeSubstitute: { params: { tearAmount: 0, flickerAmount: 0 } },
    text: TEXT,
    credits: [
      "Terminal boot-log grammar (original drawing; no names, marks, fonts or footage from other works)",
      "3x5 digit font, dot-matrix emblem generator, CRT scanline / flicker / vignette and 8-tap bloom are original",
    ],
  },
};

const MUSIC = "test-media/beat-132.mp3";
const demo = (seed, labels, startSec) => ({ input: { audio: MUSIC, startSec }, durationSec: 4, seed, labels });
const demos = {
  phosphor: demo(61, {}, 2),
  acid: demo(62, { headline: "DECK 04 LINKED", tagA: "AGENT//VFX // ACID FIELD\nNODE 7G-75   BUILD 0418\nSECTOR 05 / SIGNAL OK" }, 4),
  ultramarine: demo(63, { headline: "PLATE 77 READY", tagA: "AGENT//VFX // BLUE ARCHIVE\nNODE 3B-31   BUILD 0419\nSECTOR 06 / SIGNAL OK" }, 5),
};
export default { fx, demos };
