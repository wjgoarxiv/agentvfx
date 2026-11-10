// agentvfx (Apache-2.0, see LICENSE). Footage ingest: probe a clip, decode the requested window with ffmpeg at a
// constant frame rate, scale so the long edge is 1920 (even sizes), convert to RGBA with the clip's
// colour matrix (BT.709 when untagged), and hand frames to the renderer strictly in order. A request
// for frame 0 after later frames restarts the decoder (the determinism replay). The window's audio is
// extracted to a 48 kHz stereo WAV for analysis and muxing.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { EXIT } from "../core/constants.mjs";
import { BlockedError } from "./chrome.mjs";
import { findFfmpeg, findFfprobe } from "./encode.mjs";

const even = (n) => Math.max(2, 2 * Math.round(n / 2));

/** ffprobe a clip: { width, height, duration, fps, colorSpace, hasAudio }. */
export function probeClip(file) {
  const ffprobe = findFfprobe();
  const r = spawnSync(ffprobe, ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,color_space:format=duration", "-of", "json", file], { encoding: "utf8" });
  if (r.status !== 0) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: ffprobe could not read ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  if (!v) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: ${file} has no video stream`);
  const [num, den] = String(v.r_frame_rate ?? "0/1").split("/").map(Number);
  return { width: v.width, height: v.height, duration: Number(j.format?.duration ?? 0), fps: den ? num / den : 0, colorSpace: v.color_space ?? null, hasAudio: j.streams.some((s) => s.codec_type === "audio") };
}

/** Output size: keep the aspect, long edge `longEdge`, even dimensions. */
export function fitSize(width, height, longEdge = 1920) {
  return width >= height ? { width: even(longEdge), height: even((longEdge * height) / width) } : { width: even((longEdge * width) / height), height: even(longEdge) };
}

/**
 * Open a footage source for a render window. Returns { width, height, frames, info, frame(f), close() }.
 * Throws BLOCKED_ASSET_MISSING naming `input.video` when the file is missing or too short.
 */
export function openFootage(file, { fps, startSec = 0, durationSec, longEdge = 1920 }) {
  if (!file || !existsSync(file)) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: input.video not found: ${file}`);
  const info = probeClip(file);
  if (info.duration && info.duration + 0.05 < startSec + durationSec) {
    throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: input.video ${file} is ${info.duration.toFixed(2)} s; the window ${startSec}-${startSec + durationSec} s does not fit`);
  }
  const { width, height } = fitSize(info.width, info.height, longEdge);
  const frames = Math.round(durationSec * fps);
  const matrix = info.colorSpace && info.colorSpace !== "unknown" ? "auto" : "bt709";
  const ffmpeg = findFfmpeg();
  const frameBytes = width * height * 4;
  let proc = null;
  let next = 0;
  let chunks = [];
  let have = 0;
  let waiters = [];
  let ended = false;
  let stderr = "";

  const start = () => {
    stop();
    next = 0;
    chunks = [];
    have = 0;
    ended = false;
    stderr = "";
    const vf = `fps=${fps}:round=near,scale=${width}:${height}:flags=lanczos:in_color_matrix=${matrix}:in_range=auto,format=rgba`;
    proc = spawn(ffmpeg, ["-v", "error", "-ss", String(startSec), "-i", file, "-t", String(durationSec), "-an", "-vf", vf, "-frames:v", String(frames), "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { stdio: ["ignore", "pipe", "pipe"] });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.stdout.on("data", (d) => {
      chunks.push(d);
      have += d.length;
      if (have >= frameBytes * 4) proc.stdout.pause();
      flush();
    });
    proc.stdout.on("end", () => { ended = true; flush(); });
  };
  const take = () => {
    const all = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
    const frame = Buffer.from(all.subarray(0, frameBytes));
    const rest = all.subarray(frameBytes);
    chunks = rest.length ? [rest] : [];
    have = rest.length;
    if (proc && have < frameBytes * 4) proc.stdout.resume();
    return frame;
  };
  const flush = () => {
    while (waiters.length && (have >= frameBytes || ended)) {
      const w = waiters.shift();
      if (have >= frameBytes) w.resolve(take());
      else w.reject(new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: input.video ${file} ended early (${stderr.trim()})`));
    }
  };
  const stop = () => {
    if (proc && proc.exitCode === null) proc.kill("SIGKILL");
    proc = null;
  };

  return {
    width, height, frames, info, matrix,
    frame(f) {
      if (f === 0 || !proc) start();
      if (f !== next) return Promise.reject(new Error(`footage frames must be read in order (asked ${f}, next ${next})`));
      next += 1;
      return new Promise((resolve, reject) => {
        waiters.push({ resolve, reject });
        flush();
      });
    },
    close: stop,
  };
}

/** Extract an audio window to a 48 kHz stereo WAV in a temp dir; null when the file has no audio. */
export function extractAudio(file, { startSec = 0, durationSec }) {
  const info = probeClip(file);
  if (!info.hasAudio) return null;
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-audio-"));
  const out = path.join(dir, "window.wav");
  const r = spawnSync(findFfmpeg(), ["-v", "error", "-y", "-ss", String(startSec), "-i", file, "-t", String(durationSec), "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", out], { encoding: "utf8" });
  if (r.status !== 0) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: could not extract audio from ${file}: ${r.stderr.trim()}`);
  return { file: out, dir };
}

/** Audio-only file (input.audio) window to WAV. */
export function extractAudioFile(file, { startSec = 0, durationSec }) {
  if (!existsSync(file)) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: input.audio not found: ${file}`);
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-audio-"));
  const out = path.join(dir, "window.wav");
  const r = spawnSync(findFfmpeg(), ["-v", "error", "-y", "-ss", String(startSec), "-i", file, "-t", String(durationSec), "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", out], { encoding: "utf8" });
  if (r.status !== 0) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: could not decode input.audio ${file}: ${r.stderr.trim()}`);
  return { file: out, dir };
}
