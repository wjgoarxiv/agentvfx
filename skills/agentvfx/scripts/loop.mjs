#!/usr/bin/env node
// Turn a rendered clip into a silent seamless loop: play forward, then backward (2N-2 frames, no held frame at either turn),
// optionally write a small looping WebP preview, and flash-audit the loop played twice so the wrap point is checked too.
// node loop.mjs <in.mp4> <out.mp4> [--preview out.webp|out.gif] [--audit out.json] [--crf 23] [--maxrate 3500] [--hold 0]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFlashAuditor } from "../engine/core/flash.mjs";
import { encodePreview, findFfmpeg, findImg2webp, previewRungs, probeVideo } from "../engine/node/encode.mjs";

function ffmpegOrThrow() {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error("BLOCKED_NO_FFMPEG_FOR_VIDEO: ffmpeg not found (set FFMPEG_PATH or install ffmpeg)");
  return ffmpeg;
}

function run(ffmpeg, args) {
  const r = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
}

/** Write the forward+backward loop of `src` to `out` with no audio stream. Returns { frames, fps }. */
export function pingpong(src, out, { crf = 23, maxrateKbps = 3500, hold = 0 } = {}) {
  if (!Number.isInteger(hold) || hold < 0) throw new Error(`pingpong: hold must be a whole number of frames >= 0, got ${hold}`);
  if (path.resolve(src) === path.resolve(out)) throw new Error("pingpong: output must differ from input");
  const ffmpeg = ffmpegOrThrow();
  const info = probeVideo(src);
  if (!info?.frames || info.frames < 3) throw new Error(`pingpong: cannot read frames of ${src}`);
  const n = info.frames;
  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  // hold > 0 freezes each turn for `hold` extra frames, which spreads the doubled-back transitions across a wider window.
  const pad = hold > 0 ? `,tpad=stop_mode=clone:stop=${hold}` : "";
  run(ffmpeg, ["-i", src, "-filter_complex",
    `[0:v]split[a][b];[a]setpts=PTS-STARTPTS${pad}[f];[b]reverse,trim=start_frame=1:end_frame=${n - 1},setpts=PTS-STARTPTS${pad}[r];[f][r]concat=n=2:v=1:a=0[v]`,
    "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
    "-maxrate", `${maxrateKbps}k`, "-bufsize", `${maxrateKbps * 2}k`, "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  return { frames: 2 * n - 2 + 2 * hold, fps: info.fps };
}

/** Small looping animated preview (README use): WebP through the engine's preview ladder (ffmpeg libwebp_anim, img2webp), GIF as the last rung. */
export function preview(src, out, { width = 400, fps = 12 } = {}) {
  const ffmpeg = ffmpegOrThrow();
  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-preview-"));
  try {
    run(ffmpeg, ["-i", src, "-vf", `fps=${fps},scale=${width}:-2:flags=lanczos`, "-an", "-start_number", "0", path.join(dir, "%05d.png")]);
    const rungs = previewRungs(ffmpeg).filter((r) => (out.endsWith(".gif") ? r === "gif" : r !== "gif"));
    if (!rungs.length) throw new Error(`preview: no encoder for ${path.extname(out)} (install img2webp, or ffmpeg with libwebp)`);
    const r = encodePreview({ encoder: rungs[0], ffmpeg, img2webp: findImg2webp(), dir, fps, out });
    if (r.code !== 0) throw new Error(`preview (${rungs[0]}) failed: ${r.stderr}`);
    return rungs[0];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Decode a whole (small) clip to RGBA frames. Meant for tests and short clips. */
export function readFrames(file) {
  const ffmpeg = ffmpegOrThrow();
  const { width, height } = probeVideo(file);
  const r = spawnSync(ffmpeg, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`readFrames: ${r.stderr}`);
  const size = width * height * 4;
  const frames = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) frames.push({ width, height, data: r.stdout.subarray(o, o + size) });
  return frames;
}

/** Flash-audit the clip played `plays` times back to back (streams frames; never holds the clip in memory). */
export function auditLoop(file, { plays = 2 } = {}) {
  const ffmpeg = ffmpegOrThrow();
  const info = probeVideo(file);
  if (!info) throw new Error(`auditLoop: cannot probe ${file}`);
  const { width, height, fps } = info;
  const auditor = createFlashAuditor({ fps, width, height });
  const size = width * height * 4;
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ["-v", "error", "-stream_loop", String(plays - 1), "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
    let pending = Buffer.alloc(0);
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    let failed = null;
    p.stdout.on("data", (chunk) => {
      if (failed) return;
      try {
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        while (pending.length >= size) {
          auditor.push({ width, height, data: pending.subarray(0, size) });
          pending = pending.subarray(size);
        }
      } catch (e) {
        failed = e;
        p.kill();
      }
    });
    p.on("error", reject);
    p.on("close", (code) => {
      if (failed) return reject(failed);
      if (code !== 0) return reject(new Error(`auditLoop: ffmpeg exit ${code} ${err}`));
      const report = auditor.finish();
      resolve({ pass: !report.exceeds, plays, ...report });
    });
  });
}

async function main(argv) {
  const [src, out, ...rest] = argv;
  if (!src || !out) {
    console.error("usage: loop.mjs <in.mp4> <out.mp4> [--preview out.webp|out.gif] [--audit out.json] [--crf 23] [--maxrate 3500] [--hold 0]");
    return 2;
  }
  const opt = {};
  for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, "")] = rest[i + 1];
  const res = pingpong(src, out, { crf: Number(opt.crf ?? 23), maxrateKbps: Number(opt.maxrate ?? 3500), hold: Number(opt.hold ?? 0) });
  if (opt.preview) preview(out, opt.preview);
  const audit = await auditLoop(out);
  if (opt.audit) {
    mkdirSync(path.dirname(path.resolve(opt.audit)), { recursive: true });
    writeFileSync(opt.audit, `${JSON.stringify(audit, null, 2)}\n`);
  }
  console.log(JSON.stringify({ out, frames: res.frames, fps: res.fps, flashPass: audit.pass, worstWindow: audit.worstWindow, redFlashes: audit.redFlashes }));
  return audit.pass ? 0 : 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
