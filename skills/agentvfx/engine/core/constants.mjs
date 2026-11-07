// agentvfx (agentvfx licence, see LICENSE). Adapted from lit-typographic-motion 1.0.45 engine/core/constants.mjs.
// Every number the agentvfx engine and its gate use, in one place.

export const ENGINE_COMMIT = "ca251e3dddda422b364385eb484b5a3593a0990d";
export const ENGINE_CREDIT = `mexicat/pdoom-video ${ENGINE_COMMIT} (MIT)`;
export const CREDIT_LINE = "Capture engine adapted from lit-typographic-motion 1.0.45, itself adapted from mexicat/pdoom-video (MIT, Giacomo Magnanini), commit `ca251e3`.";

// ---- frame geometry ----
export const FRAME = Object.freeze({ width: 1920, height: 1080, maxScale: 4 });

// ---- exit codes (numbers kept from the source family; never renumbered) ----
export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 2,
  BLOCKED_NO_CHROME: 10,
  BLOCKED_NO_WEBGL2: 11,
  BLOCKED_NO_FFMPEG_FOR_VIDEO: 12,
  GATE_FAIL_QA: 13,
  SCORE_INVALID: 16,
  STAGE_CONTRACT_ERROR: 17,
  STAGE_NONDETERMINISTIC: 18,
  STAGE_NETWORK_REQUEST: 19,
  BLOCKED_ASSET_MISSING: 22,
});
export const EXIT_NAME = Object.freeze(Object.fromEntries(Object.entries(EXIT).map(([name, code]) => [code, name])));

export const TIMELINE = Object.freeze({ defaultFps: 30, defaultSeed: 20260926, minDurationSec: 3, maxDurationSec: 5 });

/** Software-rasterizer match list (case-insensitive substrings). */
export const SOFTWARE_RENDERERS = Object.freeze([
  "swiftshader", "llvmpipe", "softpipe", "lavapipe", "apple software renderer", "microsoft basic render driver",
]);
export const UNKNOWN_RENDERER = "unknown (debug-info extension unavailable)";

// ---- Chrome launch ladder ----
export const CHROME_ALWAYS = Object.freeze([
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
]);
export const CHROME_RUNGS = Object.freeze({
  darwin: [["--use-angle=metal", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"]],
  linux: [["--use-angle=gl", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"]],
  win32: [["--use-angle=d3d11", "--enable-gpu-rasterization"]],
  software: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

// ---- gate: flash audit grid and thresholds (WCAG 2.2 excursion method) ----
export const GATE = Object.freeze({
  flashGrid: [320, 180],
  flashCellPx: 6,
  flashDelta: 0.1,
  flashDarkCeiling: 0.8,
  flashWindowCells: [107, 60],
  flashWindowArea: 0.25,
  flashEdgeFrames: 3,
  redRatio: 0.8,
  redScale: 320,
  redDelta: 20,
  maxFlashesPerSecond: 3,
  maxRedFlashesPerSecond: 3,
  nearBlackPercentile: 0.995,
});

// ---- preview ladder ----
export const PREVIEW = Object.freeze({
  rungs: [
    { width: 960, fps: 30 },
    { width: 720, fps: 24 },
    { width: 540, fps: 20 },
  ],
  minWidth: 540,
  webpQuality: 60,
});

// ---- encode: H.264 master, BT.709 matrix and tags, tv range ----
export const ENCODE_ARGS = Object.freeze([
  // setparams tags the frames themselves: without it libx264 writes the matrix but leaves the
  // primaries and transfer unspecified, whatever -color_primaries / -color_trc say.
  "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
  "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "grain", "-x264-params", "aq-mode=3",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-movflags", "+faststart",
]);

export const MAX_ROUNDS = 3;
