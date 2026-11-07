// Flash audit: synthetic sequences built in memory, verdicts per WCAG 2.2 / BT.1702-3 / IRIS rules.
import test from "node:test";
import assert from "node:assert/strict";
import { auditFlash, createFlashAuditor, gridFor, LINEAR_LUT, FlashDetector } from "../engine/core/flash.mjs";

const W = 320;
const H = 180;
const FPS = 30;

/** Frame sequence: `stateAt(i)` says whether frame i is lit; `lit` is its colour, `box` limits the lit area. */
function sequence(seconds, stateAt, { lit = [255, 255, 255], box = null } = {}) {
  const frames = [];
  for (let i = 0; i < seconds * FPS; i++) {
    const data = new Uint8Array(W * H * 4);
    const on = stateAt(i);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inside = !box || (x < box.w && y < box.h);
        const o = (y * W + x) * 4;
        if (on && inside) { data[o] = lit[0]; data[o + 1] = lit[1]; data[o + 2] = lit[2]; }
        data[o + 3] = 255;
      }
    }
    frames.push({ width: W, height: H, data });
  }
  return frames;
}

// Square wave with `transitionsPerSecond` edges per second (30 fps, so 30 / n frames per half period).
const wave = (transitionsPerSecond) => (i) => Math.floor((i * transitionsPerSecond) / FPS) % 2 === 1;

test("Given black/white at 2 flashes/s When audited Then within limits", () => {
  const r = auditFlash(sequence(4, wave(4)), { fps: FPS });
  assert.equal(r.exceeds, false);
  assert.equal(r.redFlashes, 0);
  assert.ok(r.worstWindow.transitions <= 6);
});

test("Given black/white at 4 flashes/s When audited Then exceeds", () => {
  const r = auditFlash(sequence(4, wave(8)), { fps: FPS });
  assert.equal(r.exceeds, true);
  assert.ok(r.worstWindow.transitions > 6);
  assert.ok(r.flashesPerSecondMax >= 3);
});

test("Given saturated red/black at 2 flashes/s When audited Then the red rule makes it exceed", () => {
  const r = auditFlash(sequence(4, wave(4), { lit: [255, 0, 0] }), { fps: FPS });
  assert.equal(r.exceeds, true);
  assert.ok(r.redFlashes > 0);
});

test("Given a 2% white square at 6 flashes/s When audited Then within limits (area under threshold)", () => {
  const r = auditFlash(sequence(4, wave(12), { box: { w: 48, h: 24 } }), { fps: FPS });
  assert.equal(r.exceeds, false);
  assert.equal(r.worstWindow.transitions, 0);
});

test("Given 5 transitions/s for 5 s When audited Then extendedFlashing is set but exceeds is not", () => {
  const r = auditFlash(sequence(5, wave(5)), { fps: FPS });
  assert.equal(r.extendedFlashing, true);
  assert.equal(r.exceeds, false);
});

test("Given 5 transitions/s for 3 s When audited Then extendedFlashing is false", () => {
  assert.equal(auditFlash(sequence(3, wave(5)), { fps: FPS }).extendedFlashing, false);
});

test("Given a static frame sequence When audited Then nothing is reported", () => {
  const r = auditFlash(sequence(2, () => true), { fps: FPS });
  assert.equal(r.exceeds, false);
  assert.equal(r.flashesPerSecondMax, 0);
  assert.equal(r.perSecond.length, 2);
});

test("Given the same frames When pushed one by one Then the streaming result equals auditFlash", () => {
  const frames = sequence(4, wave(8));
  const auditor = createFlashAuditor({ fps: FPS, width: W, height: H });
  for (const f of frames) auditor.push(f);
  assert.deepEqual(auditor.finish(), auditFlash(frames, { fps: FPS }));
});

test("Given frames When audited Then the frame bytes are untouched (report only)", () => {
  const frames = sequence(1, wave(8));
  const before = frames.map((f) => Buffer.from(f.data).toString("base64"));
  auditFlash(frames, { fps: FPS });
  assert.deepEqual(frames.map((f) => Buffer.from(f.data).toString("base64")), before);
});

test("Given the analysis.mjs imports Then LINEAR_LUT, gridFor and FlashDetector keep their contracts", () => {
  assert.equal(LINEAR_LUT.length, 256);
  assert.equal(LINEAR_LUT[0], 0);
  assert.ok(Math.abs(LINEAR_LUT[255] - 1) < 1e-6);
  assert.deepEqual(gridFor(), { gw: 320, gh: 180, ww: 107, wh: 60 });
  assert.deepEqual(gridFor(1080, 1920), { gw: 180, gh: 320, ww: 60, wh: 107 });
  assert.equal(typeof FlashDetector, "function");
});

/** Frame sequence from a per-pixel grey code value: `grey(i, x, y)` in 0..255. */
function greySequence(seconds, grey) {
  const frames = [];
  for (let i = 0; i < seconds * FPS; i++) {
    const data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const v = grey(i, x, y);
        data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
      }
    }
    frames.push({ width: W, height: H, data });
  }
  return frames;
}

test("Given a hard-edged white bar (1/4 frame wide) sliding at 400 px/s When audited Then motion is not a flash", () => {
  const barW = W / 4;
  const span = W + barW;
  const frames = greySequence(4, (i, x) => {
    const left = ((Math.round((i * 400) / FPS) % span) + span) % span - barW;
    return x >= left && x < left + barW ? 255 : 0;
  });
  const r = auditFlash(frames, { fps: FPS });
  assert.equal(r.exceeds, false);
  assert.equal(r.redFlashes, 0);
  assert.ok(r.flashesPerSecondMax <= 3, `flashesPerSecondMax ${r.flashesPerSecondMax}`);
});

test("Given a high-contrast sine grating (period 40 px) drifting at 60 px/s When audited Then motion is not a flash", () => {
  const frames = greySequence(4, (i, x) => Math.round(127.5 + 127.5 * Math.sin((2 * Math.PI * (x - (60 * i) / FPS)) / 40)));
  const r = auditFlash(frames, { fps: FPS });
  assert.equal(r.exceeds, false);
  assert.equal(r.redFlashes, 0);
  assert.ok(r.flashesPerSecondMax <= 3, `flashesPerSecondMax ${r.flashesPerSecondMax}`);
});

// WCAG: opposing changes count when they happen in the same area. Here each half brightens while the
// other darkens, alternating every 3 frames, so each half alone makes 10 transitions/s (5 flashes/s)
// over 50% of any window inside it: that is a genuine failure (exceeds stays true). What must not
// happen is the two opposite halves being summed into a second, phantom transition per frame.
test("Given one half brightening while the other darkens, alternating every 3 frames When audited Then it counts only each half's own transitions", () => {
  const frames = greySequence(4, (i, x) => ((Math.floor(i / 3) % 2 === 0) === (x < W / 2) ? 255 : 0));
  const r = auditFlash(frames, { fps: FPS });
  assert.equal(r.exceeds, true);
  assert.ok(r.worstWindow.transitions <= 10, `worst window transitions ${r.worstWindow.transitions}`);
  assert.ok(r.flashesPerSecondMax <= 5, `flashesPerSecondMax ${r.flashesPerSecondMax}`);
});

test("Given an audit with a missing fps When called Then it throws a TypeError", () => {
  assert.throws(() => auditFlash([], {}), TypeError);
});
