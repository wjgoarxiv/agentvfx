// Flash audit for agentvfx, adapted from lit-typographic-motion 1.0.45 engine/core/flash.mjs (MIT).
// Pure report: frames are read, never modified (spec Amendment A1: stage mode keeps full intensity).
//
// Method: each RGBA frame is area-averaged onto a 320x180 linear-light grid. A flash is a pair of
// OPPOSING luminance changes of the SAME area (WCAG 2.2 / BT.1702-3), so the test is per cell first:
// a cell registers a transition when its luminance moves at least 0.1 from the extreme it reached
// since its last transition, in the direction opposite to that last transition, while the darker of
// the two is below 0.8. Continued motion the same way is not a new transition. A frame-level
// transition exists when, on that one frame, the cells that registered a transition in one
// direction cover more than 25% of some 1/3 x 1/3 window of the grid. Cells that brighten and
// cells that darken in the same frame (a moving edge) never combine into a transition pair; a
// frame where both directions fill a window counts as a single alternating transition. Red uses
// the same method on (R-G-B)x320 over saturated-red cells (R/(R+G+B) >= 0.8). Verdicts: BT.1702-3
// (more than 6 transitions in any 1 s), any red flash, and the IRIS-style extended rule (at least 4
// transitions in each of 4 consecutive seconds, at any frame offset; reported alone, not folded
// into `exceeds`).
import { FLASH, LINEAR_LUT } from "./flash-constants.mjs";

export { LINEAR_LUT };

/**
 * The audit grid for a frame: 6x6 px cells and the 640x360 window, transposed for a portrait
 * frame (180x320 cells, a 60x107 window) so the 10-degree field keeps its size in either format.
 */
export function gridFor(width = 1920, height = 1080) {
  const [gw, gh] = FLASH.grid;
  const [ww, wh] = FLASH.windowCells;
  return width >= height ? { gw, gh, ww, wh } : { gw: gh, gh: gw, ww: wh, wh: ww };
}

/**
 * Per-cell hysteresis. `hi`/`lo` are the extremes since the cell's last counted transition, `last`
 * is that transition's direction (0 = none yet). A transition counts only against `last`.
 */
class CellTracker {
  constructor(cells, delta, ceiling) {
    this.delta = delta;
    this.ceiling = ceiling;
    this.hi = new Float32Array(cells);
    this.lo = new Float32Array(cells);
    this.last = new Int8Array(cells);
  }

  start(values) {
    this.hi.set(values);
    this.lo.set(values);
  }

  /** Feed cell i's value; returns +1 / -1 when it counts a transition, else 0. */
  update(i, v) {
    const { hi, lo, last, delta, ceiling } = this;
    let dir = 0;
    if (last[i] !== 1 && v - lo[i] >= delta && Math.min(v, lo[i]) < ceiling) dir = 1;
    else if (last[i] !== -1 && hi[i] - v >= delta && Math.min(v, hi[i]) < ceiling) dir = -1;
    if (dir) {
      hi[i] = v; lo[i] = v; last[i] = dir;
    } else {
      if (v > hi[i]) hi[i] = v;
      if (v < lo[i]) lo[i] = v;
    }
    return dir;
  }
}

/** Streaming detector. Each frame is { R, G, B }: linear 0..1 cell averages on the grid. */
export class FlashDetector {
  constructor(grid = gridFor()) {
    const { gw, gh, ww, wh } = grid;
    this.grid = grid;
    this.cells = gw * gh;
    this.windowLimit = FLASH.windowArea * ww * wh;
    this.frames = 0;
    this.lum = new CellTracker(this.cells, FLASH.delta, FLASH.darkCeiling);
    this.red = new CellTracker(this.cells, FLASH.redDelta, Infinity);
    this.prevL = new Float32Array(this.cells);
    this.sat = new Int32Array((gw + 1) * (gh + 1));
  }

  /**
   * Feed one frame; returns { up, down, redUp, redDown, stepArea, edge }. The four flags say that,
   * on this frame, the cells registering a transition that way cover a window; `edge` says this
   * frame moved any cell that way.
   */
  push({ R, G, B }) {
    const CELLS = this.cells;
    const L = new Float32Array(CELLS);
    const V = new Float32Array(CELLS);
    for (let i = 0; i < CELLS; i++) {
      L[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
      const sum = R[i] + G[i] + B[i];
      V[i] = sum > 0 && R[i] / sum >= FLASH.redRatio ? Math.max(0, R[i] - G[i] - B[i]) * FLASH.redScale : 0;
    }
    const maps = { up: new Uint8Array(CELLS), down: new Uint8Array(CELLS), redUp: new Uint8Array(CELLS), redDown: new Uint8Array(CELLS) };
    const edge = { up: false, down: false, redUp: false, redDown: false };
    let stepCells = 0;
    if (this.frames === 0) {
      this.lum.start(L);
      this.red.start(V);
    } else {
      for (let i = 0; i < CELLS; i++) {
        if (Math.abs(L[i] - this.prevL[i]) >= FLASH.delta) stepCells += 1;
        const l = this.lum.update(i, L[i]);
        if (l) { maps[l > 0 ? "up" : "down"][i] = 1; edge[l > 0 ? "up" : "down"] = true; }
        const r = this.red.update(i, V[i]);
        if (r) { maps[r > 0 ? "redUp" : "redDown"][i] = 1; edge[r > 0 ? "redUp" : "redDown"] = true; }
      }
    }
    this.prevL = L;
    this.frames += 1;
    const result = { stepArea: +(stepCells / CELLS).toFixed(4), edge };
    for (const dir of ["up", "down", "redUp", "redDown"]) result[dir] = edge[dir] && this.windowHit(maps[dir]);
    return result;
  }

  // Largest window count of this frame's transition map via a summed-area table.
  windowHit(map) {
    const { gw: GW, gh: GH, ww: WW, wh: WH } = this.grid;
    const sat = this.sat;
    const stride = GW + 1;
    for (let y = 0; y < GH; y++) {
      let row = 0;
      for (let x = 0; x < GW; x++) {
        row += map[y * GW + x];
        sat[(y + 1) * stride + x + 1] = sat[y * stride + x + 1] + row;
      }
    }
    if (sat[GH * stride + GW] <= this.windowLimit) return false;
    for (let y = 0; y + WH <= GH; y++) {
      for (let x = 0; x + WW <= GW; x++) {
        const count = sat[(y + WH) * stride + x + WW] - sat[y * stride + x + WW] - sat[(y + WH) * stride + x] + sat[y * stride + x];
        if (count > this.windowLimit) return true;
      }
    }
    return false;
  }
}

/** Area-average an RGBA8 frame of any size onto its audit grid in linear light. */
export function cellsFromRgba(bytes, width, height, lut = LINEAR_LUT, { gw: GW, gh: GH } = gridFor(width, height)) {
  const CELLS = GW * GH;
  const R = new Float32Array(CELLS);
  const G = new Float32Array(CELLS);
  const B = new Float32Array(CELLS);
  const count = new Float32Array(CELLS);
  for (let y = 0; y < height; y++) {
    const cy = Math.min(GH - 1, Math.floor((y * GH) / height)) * GW;
    for (let x = 0; x < width; x++) {
      const c = cy + Math.min(GW - 1, Math.floor((x * GW) / width));
      const o = (y * width + x) * 4;
      R[c] += lut[bytes[o]];
      G[c] += lut[bytes[o + 1]];
      B[c] += lut[bytes[o + 2]];
      count[c] += 1;
    }
  }
  for (let i = 0; i < CELLS; i++) {
    const n = count[i] || 1;
    R[i] /= n; G[i] /= n; B[i] /= n;
  }
  return { R, G, B };
}

// Consecutive same-direction transitions collapse into one edge; an edge is one "transition".
function edgesIn(events, start, span) {
  let edges = 0;
  let last = 0;
  for (const t of events) {
    if (t.frame < start || t.frame >= start + span || t.dir === last) continue;
    edges += 1;
    last = t.dir;
  }
  return edges;
}

function summarize(general, red, count, fps) {
  const span = Math.round(fps);
  let worst = { startFrame: 0, transitions: 0 };
  for (const { frame } of general) {
    const transitions = edgesIn(general, frame, span);
    if (transitions > worst.transitions) worst = { startFrame: frame, transitions };
  }
  const perSecond = [];
  for (let s = 0; s * span < count; s++) {
    perSecond.push({ second: s, transitions: edgesIn(general, s * span, span), redTransitions: edgesIn(red, s * span, span) });
  }
  let extendedFlashing = false;
  for (let s0 = 0; !extendedFlashing && s0 + FLASH.extendedSeconds * span <= count; s0++) {
    extendedFlashing = Array.from({ length: FLASH.extendedSeconds }, (_, k) => edgesIn(general, s0 + k * span, span))
      .every((n) => n >= FLASH.extendedMinTransitions);
  }
  const redFlashes = Math.floor(edgesIn(red, 0, count) / 2);
  return {
    exceeds: worst.transitions > FLASH.maxTransitionsPerSecond || redFlashes > 0,
    worstWindow: { ...worst, startSec: +(worst.startFrame / fps).toFixed(3) },
    flashesPerSecondMax: Math.floor(worst.transitions / 2),
    redFlashes,
    extendedFlashing,
    perSecond,
    limits: { ...FLASH, fps, frames: count },
  };
}

// One event per frame: a lone direction is that direction; both directions filling windows on the
// same frame (opposite areas moving against each other) is one transition, alternating with the last.
function frameDir(up, down, last) {
  if (up && down) return last === 1 ? -1 : 1;
  return up ? 1 : down ? -1 : 0;
}

/**
 * Streaming auditor: push RGBA frames one at a time (only transition events are kept, never the
 * frames), then finish() for the report. Reports only; the pushed bytes are not modified.
 */
export function createFlashAuditor({ fps, width, height }) {
  if (!(Number.isFinite(fps) && fps > 0)) throw new TypeError("createFlashAuditor: fps must be a positive number");
  const grid = gridFor(width, height);
  const detector = new FlashDetector(grid);
  const general = [];
  const red = [];
  return {
    push(frame) {
      const frameIndex = detector.frames;
      const r = detector.push(cellsFromRgba(frame.data, frame.width, frame.height, LINEAR_LUT, grid));
      const dir = frameDir(r.up, r.down, general.at(-1)?.dir ?? 0);
      if (dir) general.push({ frame: frameIndex, dir });
      const redDir = frameDir(r.redUp, r.redDown, red.at(-1)?.dir ?? 0);
      if (redDir) red.push({ frame: frameIndex, dir: redDir });
    },
    finish: () => summarize(general, red, detector.frames, fps),
  };
}

/** Audit a whole frame sequence ({ width, height, data } RGBA sRGB) at `fps`. */
export function auditFlash(frames, { fps }) {
  if (!(Number.isFinite(fps) && fps > 0)) throw new TypeError("auditFlash: fps must be a positive number");
  const first = frames[0] ?? { width: 1920, height: 1080 };
  const auditor = createFlashAuditor({ fps, width: first.width, height: first.height });
  for (const frame of frames) auditor.push(frame);
  return auditor.finish();
}
