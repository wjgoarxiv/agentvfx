import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { openFootage } from "../engine/node/footage.mjs";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { auditFlash } from "../engine/core/flash.mjs";

const lib = loadLibrary();
const W = 320;
const H = 180;

function hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max };
}
const hueDiff = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

async function renderClip(clip, preset, frames) {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-sacred-"));
  const v = validateScore({ version: 1, template: "sacred", preset, input: { video: clip }, durationSec: 3, seed: 11, out: "s" }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const footage = openFootage(clip, { fps: 30, durationSec: 3, longEdge: W });
  const kept = new Map();
  try {
    const report = await renderScore(v.value, lib, { outDir: dir, width: W, height: H, footage, replay: true, onFrame: (f, a) => { if (frames.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
    return { report, kept };
  } finally {
    footage.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function makeClip(dir, lavfi) {
  const clip = path.join(dir, "in.mp4");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", lavfi, "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", clip], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return clip;
}

for (const preset of ["sacred-classic", "sacred-slow-tide"]) {
  test(`${preset}: the colour tide moves over time on still footage, saturated, deterministic`, async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-sacred-src-"));
    try {
      const clip = makeClip(tmp, `testsrc2=size=${W}x${H}:rate=30,trim=end_frame=1,loop=loop=-1:size=1`);
      const { report, kept } = await renderClip(clip, preset, [0, 60]);
      assert.equal(report.determinism.pass, true);
      const a = kept.get(0);
      const b = kept.get(60);
      let dh = 0;
      let sat = 0;
      let n = 0;
      for (let i = 0; i < W * H; i += 7) {
        const o = i * 4;
        const ha = hsv(a[o], a[o + 1], a[o + 2]);
        const hb = hsv(b[o], b[o + 1], b[o + 2]);
        dh += hueDiff(ha.h, hb.h);
        sat += hb.s;
        n += 1;
      }
      assert.ok(dh / n > 30, `mean hue change ${(dh / n).toFixed(1)} deg`);
      // Plan said >= 0.6; lowered to 0.45 after the user's look-gate round 1 ("Saturation 이 너무 심함").
      assert.ok(sat / n >= 0.45, `mean saturation ${(sat / n).toFixed(2)}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}

// sacred-thermal and sacred-halo use the "print" palette: four hard screenprint steps (ink, acid,
// signal orange, paper), dark luma stays ink, and halo adds a thick acid stroke over a dimmed grey base.
// They are checked for that look instead of the hue cycling and saturation the cyclic presets carry.
const isBlueField = (r, g, b) => b > r + 40 && b > g + 20;
const isAcid = (r, g, b) => g > 200 && b < 80 && r < 220 && g - r > 30;

for (const preset of ["sacred-thermal", "sacred-halo"]) {
  test(`${preset}: print palette, no blue field, the bands move over time, deterministic`, async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-sacred-src-"));
    try {
      const clip = makeClip(tmp, `testsrc2=size=${W}x${H}:rate=30,trim=end_frame=1,loop=loop=-1:size=1`);
      const { report, kept } = await renderClip(clip, preset, [0, 60]);
      assert.equal(report.determinism.pass, true);
      const a = kept.get(0);
      const b = kept.get(60);
      let n = 0;
      let moved = 0;
      let blue = 0;
      let acid = 0;
      let baseSat = 0;
      let baseN = 0;
      const bins = new Map();
      for (let i = 0; i < W * H; i += 3) {
        const o = i * 4;
        const [r, g, bl] = [b[o], b[o + 1], b[o + 2]];
        n += 1;
        if (Math.abs(a[o] - r) + Math.abs(a[o + 1] - g) + Math.abs(a[o + 2] - bl) > 60) moved += 1;
        if (isBlueField(r, g, bl)) blue += 1;
        if (isAcid(r, g, bl)) acid += 1;
        else { baseSat += hsv(r, g, bl).s; baseN += 1; }
        const k = `${r >> 5},${g >> 5},${bl >> 5}`;
        bins.set(k, (bins.get(k) || 0) + 1);
      }
      assert.ok(blue / n < 0.01, `blue-field share ${(blue / n).toFixed(3)}`);
      assert.ok(moved / n > 0.05, `moved share ${(moved / n).toFixed(3)}`);
      if (preset === "sacred-thermal") {
        const top4 = [...bins.values()].sort((x, y) => y - x).slice(0, 4).reduce((x, y) => x + y, 0);
        assert.ok(top4 / n > 0.85, `top-4 colour share ${(top4 / n).toFixed(3)}`);
      } else {
        assert.ok(acid / n > 0.05, `acid stroke share ${(acid / n).toFixed(3)}`);
        assert.ok(baseSat / baseN < 0.3, `base saturation ${(baseSat / baseN).toFixed(2)}`);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}

test("on flat grey footage, opposite edges of one frame differ in hue (spatial tide)", async () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "agentvfx-sacred-src-"));
  try {
    const clip = makeClip(tmp, `color=gray:size=${W}x${H}:rate=30`);
    const { kept } = await renderClip(clip, "sacred-classic", [45]);
    const f = kept.get(45);
    const meanHue = (x0, x1) => {
      let sx = 0;
      let sy = 0;
      for (let y = 20; y < H - 20; y += 4) for (let x = x0; x < x1; x += 2) {
        const o = (y * W + x) * 4;
        const h = (hsv(f[o], f[o + 1], f[o + 2]).h * Math.PI) / 180;
        sx += Math.cos(h);
        sy += Math.sin(h);
      }
      return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
    };
    const d = hueDiff(meanHue(0, 30), meanHue(W - 30, W));
    assert.ok(d > 20, `edge hue difference ${d.toFixed(1)} deg`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// Bass drives the tide speed under audioKick, so this is the same speed change per frame that a moving slider
// makes live. The hard print bands must not turn it into whole-frame ink/paper flips.
test("print palette: a speed that changes every frame and a maxed tide stay inside the flash limits", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-sacred-flash-"));
  const music = path.resolve("test-media/beat-132.mp3");
  const clip = path.resolve("test-media/clip-01.mp4");
  const params = { tideAmount: 3, tideSpeed: 3, tideScale: 0.1, tideWaves: 3, audioKick: 2 };
  const v = validateScore({ version: 1, template: "sacred", preset: "sacred-thermal", params, input: { video: "test-media/clip-01.mp4", audio: "test-media/beat-132.mp3" }, durationSec: 5, seed: 11, out: "s" }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const features = await analyzeAudio(music, { fps: 30, durationSec: 5 });
  const footage = openFootage(clip, { fps: 30, durationSec: 5, longEdge: W });
  const frames = [];
  try {
    await renderScore(v.value, lib, { outDir: dir, width: W, height: H, footage, features, replay: false, onFrame: (f, a) => { frames[f] = { width: W, height: H, data: Buffer.from(a.rgba) }; } });
  } finally {
    footage.close();
    rmSync(dir, { recursive: true, force: true });
  }
  const audit = auditFlash(frames, { fps: 30 });
  assert.equal(audit.exceeds, false, `worst ${audit.worstWindow.transitions} transitions in 1 s, red ${audit.redFlashes}`);
});
