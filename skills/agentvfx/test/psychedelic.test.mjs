// Psychedelic family tests (plan task 8 acceptance criteria).
// Every template: validates, renders 120 frames, determinism passes with a
// recorded flash audit. echo-flow and mosh-melt declare a persistent pass.
// hologram-scan flicker is visible in strips (frame-to-frame fill change).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { runJob } from "../engine/node/job.mjs";

const lib = loadLibrary({ includeTest: true });
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 320;
const H = 180;
const CLIP = "test-media/clip-01.mp4";

const CASES = [
  ["tidal-bands", "tidal-classic"],
  ["kaleido-fold", "kaleido-six"],
  ["hologram-scan", "holo-cyan"],
  ["echo-flow", "echo-trail"],
  ["mosh-melt", "mosh-classic"],
];

function scoreFor(template, preset, extra = {}) {
  const v = validateScore(
    { version: 1, template, preset, input: { video: CLIP }, durationSec: 4, seed: 11, out: "t", ...extra },
    lib,
  );
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  return v.value;
}

for (const [template, preset] of CASES) {
  test(`${template}/${preset}: validates, renders 120 frames, deterministic, flash audit recorded`, async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-psy-"));
    try {
      const gate = await runJob(scoreFor(template, preset), lib, { outDir: dir, width: W, height: H, replay: true, cwd: ROOT });
      assert.equal(gate.render.frames, 120, `rendered ${gate.render.frames} frames`);
      assert.equal(gate.determinism.checked, true);
      assert.equal(gate.determinism.pass, true, JSON.stringify(gate.determinism.firstDifference));
      assert.ok(gate.flash && typeof gate.flash.exceeds === "boolean", "flash audit missing");
      assert.ok(gate.stills.sheet, "contact sheet missing");
      assert.ok(gate.stills.strips.length >= 1, "strips missing");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("echo-flow and mosh-melt declare a persistent pass", () => {
  for (const id of ["echo-flow", "mosh-melt"]) {
    const t = lib.get(id);
    assert.ok(t, `${id} missing from library`);
    const persistent = (t.fx.PASSES ?? []).filter((p) => p.PERSISTENT === true);
    assert.ok(persistent.length >= 1, `${id} has no PERSISTENT pass`);
  }
});

test("hologram-scan flicker is visible: fill luminance swing >= 0.1 at peaks", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-psy-"));
  try {
    const gate = await runJob(scoreFor("hologram-scan", "holo-storm"), lib, { outDir: dir, width: W, height: H, replay: false, cwd: ROOT });
    const film = gate.render.film;
    const p = spawnSync("ffmpeg", ["-v", "error", "-i", film, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1 << 30 });
    assert.equal(p.status, 0, p.stderr?.toString());
    const stride = W * H * 3;
    const n = Math.floor(p.stdout.length / stride);
    assert.ok(n >= 115, `decoded ${n} frames`);
    const meanLuma = (k) => {
      const o = k * stride;
      let s = 0;
      let c = 0;
      for (let y = H >> 2; y < (3 * H) >> 2; y += 2) {
        for (let x = W >> 2; x < (3 * W) >> 2; x += 2) {
          const i = o + (y * W + x) * 3;
          s += 0.2126 * p.stdout[i] + 0.7152 * p.stdout[i + 1] + 0.0722 * p.stdout[i + 2];
          c++;
        }
      }
      return s / (c * 255);
    };
    let peak = 0;
    let prev = meanLuma(0);
    for (let k = 1; k < n; k++) {
      const m = meanLuma(k);
      peak = Math.max(peak, Math.abs(m - prev));
      prev = m;
    }
    assert.ok(peak >= 0.1, `flicker peak swing ${peak.toFixed(3)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
