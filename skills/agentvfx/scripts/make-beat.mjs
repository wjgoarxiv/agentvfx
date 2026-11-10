#!/usr/bin/env node
// agentvfx (Apache-2.0, see LICENSE). Generates the original 10 s, 132 BPM demo drum loop (test-media/beat-132.mp3).
// Everything is synthesised here from sines and seeded noise: a kick on every beat, a snare on
// beats 2 and 4, closed hats on the 8ths, starting a quarter beat in, over a faint noise bed so the
// waveform never goes flat between hits. Nothing is sampled or downloaded.
// usage: node scripts/make-beat.mjs [out.mp3]
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findFfmpeg } from "../engine/node/encode.mjs";

const SR = 48000;
const BPM = 132;
const SECONDS = 10;
const BEAT = (60 / BPM) * SR;
const N = SR * SECONDS;
const LEAD_BEATS = 0.26;
const AIR = 0.06;
const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stereo float mix. L and R draw their own noise so the hats and snare are not mono. */
export function renderBeat() {
  const rand = mulberry32(132);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const add = (start, len, fn) => {
    for (let i = 0; i < len && start + i < N; i++) {
      const [l, r] = fn(i / SR, i);
      L[start + i] += l;
      R[start + i] += r;
    }
  };
  const noise = () => rand() * 2 - 1;

  const kick = (start) => {
    let phase = 0;
    add(start, Math.floor(0.25 * SR), (t) => {
      phase += (TAU * (45 + 110 * Math.exp(-t * 28))) / SR;
      const body = Math.sin(phase) * Math.exp(-t * 18) * 0.95;
      const click = Math.exp(-t * 250) * 0.5 * noise();
      return [body + click, body + click];
    });
  };
  const snare = (start) => {
    add(start, Math.floor(0.25 * SR), (t) => {
      const tone = Math.sin(TAU * 190 * t) * Math.exp(-t * 28) * 0.25;
      const env = Math.exp(-t * 17) * 0.22;
      return [tone + noise() * env, tone + noise() * env];
    });
  };
  const hat = (start, accent) => {
    let pl = 0;
    let pr = 0;
    add(start, Math.floor(0.06 * SR), (t) => {
      const nl = noise();
      const nr = noise();
      const env = Math.exp(-t * 90) * (accent ? 0.07 : 0.04);
      const out = [(nl - pl) * env, (nr - pr) * env];
      pl = nl;
      pr = nr;
      return out;
    });
  };

  for (let b = 0; (b + LEAD_BEATS) * BEAT < N; b++) {
    const at = Math.round((b + LEAD_BEATS) * BEAT);
    kick(at);
    if (b % 4 === 1 || b % 4 === 3) snare(at);
    hat(at, false);
    hat(Math.round((b + LEAD_BEATS + 0.5) * BEAT), true);
  }
  let lo = 0;
  let ro = 0;
  for (let i = 0; i < N; i++) {
    lo += (noise() - lo) * 0.35;
    ro += (noise() - ro) * 0.35;
    L[i] += lo * AIR;
    R[i] += ro * AIR;
  }
  return [L, R];
}

/** 16-bit stereo WAV bytes, soft-limited so the loudest hit sits near -1 dBFS. */
export function toWav([L, R]) {
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.round(Math.tanh(L[i] * 1.1) * 0.89 * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.tanh(R[i] * 1.1) * 0.89 * 32767), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = path.resolve(process.argv[2] ?? path.join(root, "test-media", "beat-132.mp3"));
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error("make-beat: ffmpeg not found (set FFMPEG_PATH or put it on PATH)");
    process.exit(1);
  }
  mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(ffmpeg, ["-v", "error", "-y", "-f", "wav", "-i", "pipe:0", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-c:a", "libmp3lame", "-b:a", "192k", out], { input: toWav(renderBeat()), encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    console.error(`make-beat: ffmpeg failed: ${r.stderr}`);
    process.exit(1);
  }
  console.log(`wrote ${out} (${SECONDS} s, ${BPM} BPM)`);
}
