import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { runJob, FLASH_COMMENT } from "../engine/node/job.mjs";
import { auditFlash } from "../engine/core/flash.mjs";

const lib = loadLibrary({ includeTest: true });
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const W = 320;
const H = 180;
const strobe = (extra = {}) => {
  const raw = JSON.parse(readFileSync(path.join(FIX, "score-strobe-12hz.json"), "utf8"));
  const r = validateScore({ ...raw, ...extra }, lib);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.value;
};

function decode(file) {
  const p = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 1 << 30 });
  const frames = [];
  for (let o = 0; o + W * H * 4 <= p.stdout.length; o += W * H * 4) frames.push({ width: W, height: H, data: p.stdout.subarray(o, o + W * H * 4) });
  return frames;
}
const comment = (file) => spawnSync("ffprobe", ["-v", "error", "-show_entries", "format_tags=comment", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" }).stdout.trim();
const centreLuma = (f) => f.data[((H >> 1) * W + (W >> 1)) * 4];

test("stage mode at 12 flashes/s keeps every flash, writes SAFETY.txt and the MP4 comment", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-flash-"));
  try {
    const gate = await runJob(strobe(), lib, { outDir: dir, width: W, height: H, replay: false });
    assert.equal(gate.flash.exceeds, true);
    assert.ok(existsSync(path.join(dir, "SAFETY.txt")));
    assert.equal(comment(path.join(dir, "film.mp4")), FLASH_COMMENT);
    const frames = decode(path.join(dir, "film.mp4"));
    assert.equal(frames.length, 90);
    // 12 Hz at 30 fps: on for frames where fract(t*12) < 0.5. Every frame must keep full black or white.
    const expected = frames.map((_, f) => ((f / 30) * 12 + 1e-4) % 1 < 0.5);
    frames.forEach((fr, f) => assert.equal(centreLuma(fr) > 200, expected[f], `frame ${f} luma ${centreLuma(fr)}`));
    for (const k of ["sheet", "poster"]) assert.ok(existsSync(gate.stills[k]), k);
    assert.ok(gate.stills.strips.length >= 1 && gate.stills.strips.every((s) => existsSync(s.file)));
    assert.ok(existsSync(path.join(dir, "gate-report.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("safeVariant adds film.safe.mp4 within limits next to the untouched full-intensity film", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-flash-"));
  try {
    const gate = await runJob(strobe({ safety: { safeVariant: true } }), lib, { outDir: dir, width: W, height: H, replay: false });
    assert.equal(gate.flash.exceeds, true, "master keeps full intensity");
    assert.ok(existsSync(path.join(dir, "film.mp4")));
    assert.ok(existsSync(path.join(dir, "film.safe.mp4")), JSON.stringify(gate.safeVariant));
    assert.equal(gate.safeVariant.flash.exceeds, false);
    assert.equal(auditFlash(decode(path.join(dir, "film.safe.mp4")), { fps: 30 }).exceeds, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a hit schedule is thinned for broadcast-safe and the substitutions are listed", async () => {
  const hits = Array.from({ length: 10 }, (_, i) => ({ t: 0.5 + i * 0.1, template: "test-strobe", preset: "hold", durationFrames: 1 }));
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-flash-"));
  try {
    const gate = await runJob(strobe({ template: "test-gradient", preset: undefined, hits, safety: { safeVariant: true } }), lib, { outDir: dir, width: W, height: H, replay: false });
    assert.ok(gate.safeVariant.substitutions.length >= 6, JSON.stringify(gate.safeVariant.substitutions));
    assert.equal(gate.safeVariant.flash.exceeds, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown safety.mode is rejected naming safety.mode", () => {
  const raw = JSON.parse(readFileSync(path.join(FIX, "score-strobe-12hz.json"), "utf8"));
  const r = validateScore({ ...raw, safety: { mode: "gentle" } }, lib);
  assert.ok(r.errors.some((e) => e.path === "safety.mode"));
});
