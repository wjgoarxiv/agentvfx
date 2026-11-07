#!/usr/bin/env node
// Render a procedural Blender "plate" (background footage for agentvfx templates) and encode it to H.264 film.mp4.
// node plate.mjs --scene terminalcore --shot wall --out gallery/plates/terminalcore-wall --width 640 --height 360 --seconds 4 --fps 30 --samples 48
// Extra: --quality preview|final (final: 256 samples, accurate denoise, camera motion blur), --frame N (single test still, no video),
//        --exposure EV, --bloom X, --key X, --haze X, --keep-frames, --no-post
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findFfmpeg, which } from "../engine/node/encode.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FLAGS = new Set(["keep-frames", "no-post"]);

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, "");
    if (FLAGS.has(k)) o[k] = true;
    else o[k] = argv[++i];
  }
  return o;
}

function findBlender(env = process.env) {
  const mac = "/Applications/Blender.app/Contents/MacOS/Blender";
  const found = [env.BLENDER_PATH, which("blender", env), mac].find((p) => p && existsSync(p));
  if (!found) throw new Error("BLOCKED_NO_BLENDER: set BLENDER_PATH or install Blender 5.x");
  return found;
}

const o = parseArgs(process.argv.slice(2));
const scene = o.scene ?? "terminalcore";
const shot = o.shot ?? "wall";
const out = path.resolve(o.out ?? `gallery/plates/${scene}-${shot}`);
const width = Number(o.width ?? 640);
const height = Number(o.height ?? 360);
const seconds = Number(o.seconds ?? 4);
const fps = Number(o.fps ?? 30);
const quality = o.quality ?? "preview";
if (!["preview", "final"].includes(quality)) throw new Error(`--quality must be preview or final, got "${quality}"`);
const samples = Number(o.samples ?? (quality === "final" ? 256 : 40));
const script = path.join(here, "..", "plates", scene, "scene.py");
if (!existsSync(script)) throw new Error(`unknown plate scene "${scene}" (no ${script})`);

mkdirSync(out, { recursive: true });
const frames = path.join(out, "frames");
rmSync(frames, { recursive: true, force: true });
const args = ["-b", "--factory-startup", "--python-exit-code", "1", "--python", script, "--", "--shot", shot, "--out", out, "--width", width, "--height", height, "--seconds", seconds, "--fps", fps, "--samples", samples, "--quality", quality];
for (const k of ["frame", "exposure", "bloom", "key", "haze"]) if (o[k] !== undefined) args.push(`--${k}`, o[k]);

const t0 = Date.now();
const bl = spawnSync(findBlender(), args.map(String), { encoding: "utf8", maxBuffer: 1 << 29 });
const renderSec = (Date.now() - t0) / 1000;
const log = (bl.stdout ?? "") + (bl.stderr ?? "");
writeFileSync(path.join(out, "blender.log"), log);
if (bl.status !== 0 || log.includes("Traceback")) {
  console.error(log.split("\n").slice(-40).join("\n"));
  process.exit(bl.status || 1);
}

for (const line of log.split("\n")) if (line.startsWith("TIMING")) console.log(line);
if (o.frame) {
  console.log(`still ${path.join(out, `still_${String(o.frame).padStart(3, "0")}.png`)}  ${renderSec.toFixed(1)}s`);
  process.exit(0);
}

const ffmpeg = findFfmpeg();
if (!ffmpeg) throw new Error("BLOCKED_NO_FFMPEG: set FFMPEG_PATH or install ffmpeg");
const pngs = readdirSync(frames).filter((f) => f.endsWith(".png")).sort();
const grade = shot === "gallery" ? "vignette=PI/7,noise=alls=3:allf=t" : "vignette=PI/5.5,noise=alls=7:allf=t";
const post = o["no-post"] ? "format=yuv420p" : `${grade},format=yuv420p`;
const enc = spawnSync(ffmpeg, ["-v", "error", "-y", "-framerate", String(fps), "-start_number", "1", "-i", path.join(frames, "f_%04d.png"), "-vf", post, "-c:v", "libx264", "-crf", quality === "final" ? "14" : "17", "-preset", "slow", "-movflags", "+faststart", path.join(out, "film.mp4")], { encoding: "utf8" });
if (enc.status !== 0) {
  console.error(enc.stderr);
  process.exit(enc.status ?? 1);
}
for (const [label, idx] of [["first", 0], ["mid", Math.floor(pngs.length / 2)], ["last", pngs.length - 1]]) copyFileSync(path.join(frames, pngs[idx]), path.join(out, `still_${label}.png`));
if (!o["keep-frames"]) rmSync(frames, { recursive: true, force: true });
const report = { scene, shot, quality, width, height, fps, seconds, samples, frames: pngs.length, renderSeconds: renderSec, secondsPerFrame: renderSec / pngs.length };
writeFileSync(path.join(out, "plate.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
