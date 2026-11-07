// Ping-pong loop tool: no audio, 2N-2 frames, seamless wrap, flash audit over the loop played twice.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { findFfmpeg, findFfprobe, probeVideo } from "../engine/node/encode.mjs";
import { auditLoop, pingpong, readFrames } from "../scripts/loop.mjs";

const ffmpeg = findFfmpeg();
const ffprobe = findFfprobe();

function makeClip(dir, n = 30) {
  // 1 s, 30 fps, 160x90 ffmpeg test pattern (moves every frame), with a sine audio track that must be dropped.
  const src = path.join(dir, "src.mp4");
  const r = spawnSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=160x90:r=30:d=1",
    "-f", "lavfi", "-i", "sine=f=440:d=1",
    "-frames:v", String(n), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src]);
  assert.equal(r.status, 0, String(r.stderr));
  return src;
}

test("pingpong drops audio, has 2N-2 frames and wraps without a jump", { skip: !ffmpeg || !ffprobe }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-loop-"));
  try {
    const src = makeClip(dir);
    const out = path.join(dir, "loop.mp4");
    const res = pingpong(src, out);
    assert.equal(res.frames, 58);
    const audio = spawnSync(ffprobe, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", out], { encoding: "utf8" });
    assert.equal(audio.stdout.trim(), "", "no audio stream");
    assert.equal(probeVideo(out).frames, 58);
    const frames = readFrames(out);
    const mad = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]); return s / (a.data.length / 4); };
    const step = mad(frames[0], frames[1]);
    const wrap = mad(frames.at(-1), frames[0]);
    assert.ok(step > 0.5, "the box moves");
    assert.ok(wrap <= step * 1.5, `wrap step ${wrap} vs normal step ${step}`);
    const jump = mad(readFrames(src).at(-1), readFrames(src)[0]);
    assert.ok(jump > step * 5, "negative control: the source loop jumps");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("pingpong hold freezes each turn for the given frames", { skip: !ffmpeg || !ffprobe }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-loop-"));
  try {
    const out = path.join(dir, "hold.mp4");
    assert.equal(pingpong(makeClip(dir), out, { hold: 3 }).frames, 64);
    assert.equal(probeVideo(out).frames, 64);
    const f = readFrames(out);
    const mad = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]); return s / (a.data.length / 4); };
    assert.ok(mad(f[29], f[32]) < 1, "frames 29..32 are the held turn");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("auditLoop fails a full-frame strobe (negative control)", { skip: !ffmpeg || !ffprobe }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-loop-"));
  try {
    const src = path.join(dir, "strobe.mp4");
    const r = spawnSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=160x90:r=30:d=1",
      "-vf", "geq=lum='if(mod(N,2),235,16)':cb=128:cr=128", "-c:v", "libx264", "-pix_fmt", "yuv420p", src]);
    assert.equal(r.status, 0, String(r.stderr));
    const out = path.join(dir, "loop.mp4");
    pingpong(src, out);
    assert.equal((await auditLoop(out)).pass, false);
    assert.throws(() => pingpong(src, out, { hold: 1.5 }), /hold/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("auditLoop reports a pass for a calm clip, played twice", { skip: !ffmpeg || !ffprobe }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-loop-"));
  try {
    const out = path.join(dir, "loop.mp4");
    pingpong(makeClip(dir), out);
    const a = await auditLoop(out);
    assert.equal(a.pass, true);
    assert.equal(a.limits.frames, 116);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
