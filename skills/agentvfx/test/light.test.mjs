import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFlashAuditor } from "../engine/core/flash.mjs";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { openFootage } from "../engine/node/footage.mjs";
import { renderScore } from "../engine/node/render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clip = path.join(root, "test-media/clip-01.mp4");
const familyDir = path.join(root, "templates/light");
const IDS = ["bloom-glow", "anamorphic-streak", "god-rays", "light-leak", "neon-saber", "lens-flare", "light-sweep"];
const BASES = ["light-stage"];

function rec709(buf, o) {
  return (0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2]) / 255;
}

/** Mean display luma of the 1px ring at radius r around (cx, cy). */
function ringMean(buf, w, h, cx, cy, r) {
  const steps = Math.max(24, Math.ceil(Math.PI * 2 * r));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    sum += rec709(buf, (y * w + x) * 4);
    n += 1;
  }
  return sum / n;
}

/** Mean display luma of the darkest fifth of the frame. */
function darkestMean(buf, w, h) {
  const n = w * h;
  const lum = new Float64Array(n);
  for (let i = 0; i < n; i++) lum[i] = rec709(buf, i * 4);
  const sorted = Float64Array.from(lum).sort();
  const k = Math.max(1, Math.floor(n * 0.2));
  let sum = 0;
  for (let i = 0; i < k; i++) sum += sorted[i];
  return sum / k;
}

function findImpulse(buf, w, h) {
  let best = -1;
  let x = 0;
  let y = 0;
  const x0 = Math.floor(w * 0.35);
  const x1 = Math.ceil(w * 0.65);
  const y0 = Math.floor(h * 0.35);
  const y1 = Math.ceil(h * 0.65);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * w + xx) * 4;
      const s = buf[o] + buf[o + 1] + buf[o + 2];
      if (s > best) {
        best = s;
        x = xx;
        y = yy;
      }
    }
  }
  return { x, y };
}

/** Radius, as a fraction of height, where the halo falls through half its inner-ring peak. */
function halfRadiusFrac(buf, w, h, cx, cy) {
  const maxR = Math.floor(h * 0.45);
  const rings = [];
  for (let r = 1; r <= maxR; r++) rings.push(ringMean(buf, w, h, cx, cy, r));
  let worstRise = 0;
  let worstStep = 0;
  for (let i = 0; i < rings.length - 1; i++) {
    worstRise = Math.max(worstRise, rings[i + 1] - rings[i]);
    worstStep = Math.max(worstStep, rings[i] - rings[i + 1]);
  }
  const peak = rings[0];
  let half = rings.length + 1;
  for (let i = 0; i < rings.length; i++) {
    if (rings[i] < peak * 0.5) {
      half = i + 1;
      break;
    }
  }
  return { worstRise, worstStep, peak, frac: half / h };
}

test("light family", { timeout: 1_800_000 }, async (t) => {
  const lib = loadLibrary();

  await t.test("seven templates validate and each demo score validates", () => {
    assert.deepEqual([...lib.keys()].filter((id) => lib.get(id).family === "light").sort(), [...IDS, ...BASES].sort());
    for (const id of [...IDS, ...BASES]) {
      const tpl = lib.get(id);
      const v = validateTemplate(tpl.fx, id);
      assert.equal(v.ok, true, `${id} ${JSON.stringify(v.errors)}`);
      assert.equal(tpl.fx.X_AGENTVFX.family, "light");
      assert.ok(Object.keys(tpl.fx.X_AGENTVFX.presets).length >= 3);
      if (!IDS.includes(id)) continue;
      const demos = readdirSync(path.join(familyDir, id)).filter((f) => f.startsWith("demo-") && f.endsWith(".json"));
      assert.ok(demos.length >= 1, `${id} needs a demo score`);
      for (const demo of demos) {
        const score = JSON.parse(readFileSync(path.join(familyDir, id, demo), "utf8"));
        const s = validateScore(score, lib);
        assert.equal(s.ok, true, `${demo} ${JSON.stringify(s.errors)}`);
      }
    }
  });

  for (const id of IDS) {
    await t.test(`${id} renders 90 frames, determinism passes, flash audit is recorded`, async () => {
      const tpl = lib.get(id);
      const preset = Object.keys(tpl.fx.X_AGENTVFX.presets)[0];
      const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-light-"));
      const ref = openFootage(clip, { fps: 30, durationSec: 3, longEdge: 320 });
      const src0 = Buffer.from(await ref.frame(0));
      ref.close();
      const footage = openFootage(clip, { fps: 30, durationSec: 3, longEdge: 320 });
      const auditor = createFlashAuditor({ fps: 30, width: footage.width, height: footage.height });
      let out0 = null;
      try {
        const v = validateScore({
          version: 1, template: id, preset, input: { video: clip }, durationSec: 3, seed: 12, out: id,
        }, lib);
        assert.equal(v.ok, true, JSON.stringify(v.errors));
        const report = await renderScore(v.value, lib, {
          outDir: dir,
          width: footage.width,
          height: footage.height,
          footage,
          replay: true,
          onFrame: (f, a) => {
            auditor.push({ width: footage.width, height: footage.height, data: a.rgba });
            if (f === 0 && !out0) out0 = Buffer.from(a.rgba);
          },
        });
        const flash = auditor.finish();
        assert.equal(report.frames, 90);
        const rise = darkestMean(out0, footage.width, footage.height) - darkestMean(src0, footage.width, footage.height);
        assert.ok(rise <= 0.03, `${id} darkest-fifth luma rose ${rise.toFixed(4)}`);
        assert.equal(report.determinism.pass, true, JSON.stringify(report.determinism));
        assert.equal(typeof flash.flashesPerSecondMax, "number");
        assert.equal(typeof flash.redFlashes, "number");
        assert.equal(typeof flash.exceeds, "boolean");
        assert.equal(flash.limits.frames, 90);
      } finally {
        footage.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  await t.test("bloom-glow on one white pixel falls off smoothly and the radius scales", async () => {
    const probe = {
      version: 1,
      template: "bloom-glow",
      params: {
        probeDot: 1, paletteMix: 0, tint: [1, 1, 1, 1], toneMap: 1,
        bloomRadius: 0.36, bloomMix: 0.15, bloomGain: 16, levelGain: 1.6,
        coreTrim: 0.04, threshold: 0.15, knee: 0.9,
      },
      durationSec: 3,
      seed: 3,
      out: "bloom-probe",
    };
    const v = validateScore(probe, lib);
    assert.equal(v.ok, true, JSON.stringify(v.errors));
    const measured = [];
    for (const [w, h] of [[960, 540], [1920, 1080]]) {
      const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-bloom-"));
      let kept = null;
      try {
        const report = await renderScore(v.value, lib, {
          outDir: dir, width: w, height: h, replay: false,
          onFrame: (f, a) => { if (f === 0) kept = Buffer.from(a.rgba); },
        });
        assert.equal(report.frames, 90);
        const spot = findImpulse(kept, w, h);
        const centre = rec709(kept, (spot.y * w + spot.x) * 4);
        assert.ok(centre > 0.75, `impulse pixel ${centre.toFixed(3)} at ${w}x${h}`);
        const m = halfRadiusFrac(kept, w, h, spot.x, spot.y);
        assert.ok(m.peak >= 12 / 255, `halo peak ${(m.peak * 255).toFixed(1)}/255 at ${w}x${h}`);
        assert.ok(m.worstRise * 255 <= 2, `rise ${(m.worstRise * 255).toFixed(2)}/255 at ${w}x${h}`);
        assert.ok(m.worstStep * 255 <= 2, `step ${(m.worstStep * 255).toFixed(2)}/255 at ${w}x${h}`);
        measured.push(m.frac);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    const rel = Math.abs(measured[0] - measured[1]) / Math.max(measured[1], 1e-4);
    assert.ok(rel <= 0.05, `relative radii ${measured.map((n) => n.toFixed(4)).join(" vs ")} differ by ${(rel * 100).toFixed(1)}%`);
  });
});
