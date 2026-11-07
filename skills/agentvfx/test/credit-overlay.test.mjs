// The on-screen credit: platforms strip MP4 metadata, so every render burns a small "made with agentvfx" mark into the
// bottom-right corner unless the score opts out with "credit": { "overlay": false }. The mark is static, so it cannot add
// a flash, and it touches nothing outside its corner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";

const lib = loadLibrary({ includeTest: true });
const W = 640;
const H = 360;
const base = { version: 1, template: "test-gradient", durationSec: 3, seed: 3, out: "t" };

test("credit defaults to an on-screen overlay and only accepts { overlay: boolean }", () => {
  const v = validateScore(base, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.deepEqual(v.value.credit, { overlay: true });
  assert.deepEqual(validateScore({ ...base, credit: { overlay: false } }, lib).value.credit, { overlay: false });
  const bad = validateScore({ ...base, credit: { overlay: "no" } }, lib);
  assert.ok(bad.errors.some((e) => e.path === "credit.overlay"), JSON.stringify(bad.errors));
  const unknown = validateScore({ ...base, credit: { size: 3 } }, lib);
  assert.ok(unknown.errors.some((e) => e.path === "credit.size"), JSON.stringify(unknown.errors));
});

async function frame(score, f = 30) {
  const v = validateScore(score, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-overlay-"));
  let kept = null;
  try {
    await renderScore(v.value, lib, { outDir: dir, width: W, height: H, replay: false, onFrame: (i, a) => { if (i === f) kept = Buffer.from(a.rgba); } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return kept;
}

test("the overlay marks the bottom-right corner and nothing else; overlay false leaves the frame untouched", async () => {
  const on = await frame(base);
  const off = await frame({ ...base, credit: { overlay: false } });
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]);
      if (d <= 6) continue;
      if (x > W * 0.55 && y > H * 0.85) inside += 1;
      else outside += 1;
    }
  }
  assert.ok(inside > 150, `credit pixels in the corner: ${inside}`);
  assert.equal(outside, 0, "nothing changes outside the corner");
});
