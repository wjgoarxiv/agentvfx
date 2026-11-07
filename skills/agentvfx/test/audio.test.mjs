// Lane audio — TDD tests for engine/node/audio.mjs
// Task 7 acceptance criteria (plans/agentvfx-v1.md). WAV fixtures are
// generated at runtime under os.tmpdir() and removed afterwards.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyzeAudio,
  writeFeatures,
  summarize,
} from '../engine/node/audio.mjs';

const SR = 48000;
const FPS = 30;
let dir;
let clickPath;
let click140;
let click174;
let sinePath;
let sineLoudPath;
let noisePath;
let leftPath;

function wavBytes({ seconds, channels, fn }) {
  const n = Math.floor(seconds * SR);
  const data = Buffer.alloc(n * channels * 2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const s = fn(t, i);
    const ch = Array.isArray(s) ? s : [s, s];
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, ch[c] ?? 0));
      data.writeInt16LE(Math.round(v * 32767), (i * channels + c) * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// 120 BPM click: 16 clicks at k*0.5 s, short decaying 2 kHz blip.
function clickFn(t) {
  const phase = t % 0.5;
  const k = Math.floor(phase * SR);
  if (k >= 96) return 0;
  return Math.sin(2 * Math.PI * 2000 * phase) * Math.exp(-k / 24) * 0.9;
}

// Click train at a given BPM; returns { bytes, times } with click times in seconds.
function clickTrack(bpm, seconds) {
  const period = 60 / bpm;
  const times = [];
  for (let k = 0; ; k++) {
    const t = k * period;
    if (t > seconds - 0.15) break;
    times.push(t);
  }
  const fn = (t) => {
    let v = 0;
    for (const c of times) {
      const dt = t - c;
      if (dt >= 0 && dt * SR < 96) {
        const k = Math.floor(dt * SR);
        v += Math.sin(2 * Math.PI * 2000 * dt) * Math.exp(-k / 24) * 0.9;
      }
    }
    return v;
  };
  return { bytes: wavBytes({ seconds, channels: 2, fn }), times };
}

// Deterministic pseudo-random noise (LCG) at fixed amplitude.
function noiseFn(amp, seed) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return ((s / 0x100000000) * 2 - 1) * amp;
  };
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'lane-audio-'));
  clickPath = join(dir, 'click-120.wav');
  click140 = join(dir, 'click-140.wav');
  click174 = join(dir, 'click-174.wav');
  sinePath = join(dir, 'sine-440.wav');
  sineLoudPath = join(dir, 'sine-440-loud.wav');
  noisePath = join(dir, 'noise-mid.wav');
  leftPath = join(dir, 'hard-left.wav');
  await writeFile(clickPath, wavBytes({ seconds: 8, channels: 2, fn: clickFn }));
  await writeFile(click140, clickTrack(140, 6).bytes);
  await writeFile(click174, clickTrack(174, 6).bytes);
  await writeFile(
    sinePath,
    wavBytes({ seconds: 8, channels: 2, fn: (t) => Math.sin(2 * Math.PI * 440 * t) * 0.5 }),
  );
  await writeFile(
    sineLoudPath,
    wavBytes({ seconds: 4, channels: 2, fn: (t) => Math.sin(2 * Math.PI * 440 * t) * 1.0 }),
  );
  await writeFile(noisePath, wavBytes({ seconds: 4, channels: 2, fn: noiseFn(0.8, 12345) }));
  await writeFile(
    leftPath,
    wavBytes({
      seconds: 4,
      channels: 2,
      fn: (t) => [Math.sin(2 * Math.PI * 440 * t) * 0.5, 0],
    }),
  );
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('audio features — 120 BPM click track (8 s)', () => {
  it('detects every click as an onset within ±1 frame at 30 fps', async () => {
    const f = await analyzeAudio(clickPath, { fps: FPS });
    assert.equal(f.frames.length, 240);
    const expectedClicks = Array.from({ length: 16 }, (_, k) => k * 0.5);
    for (const c of expectedClicks) {
      const frame = Math.round(c * FPS);
      const hit = f.meta.onsets.some((o) => Math.abs(o - frame) <= 1);
      assert.ok(hit, `click at ${c}s (frame ${frame}) has no onset within ±1 frame`);
    }
    assert.equal(f.meta.onsets.length, 16);
  });

  it('estimates bpm 120 ± 1', async () => {
    const f = await analyzeAudio(clickPath, { fps: FPS });
    assert.ok(Math.abs(f.meta.bpm - 120) <= 1, `bpm was ${f.meta.bpm}`);
    const s = summarize(f);
    assert.ok(Math.abs(s.bpm - 120) <= 1);
    assert.equal(s.onsetCount, 16);
    assert.equal(s.frames, 240);
  });
});

describe('audio features — 440 Hz sine', () => {
  it('gives the 440 Hz band the maximum mean value', async () => {
    const f = await analyzeAudio(sinePath, { fps: FPS });
    // log-spaced band edges, 30 Hz–16 kHz, 32 bands (mirrors implementation)
    const edges = Array.from({ length: 33 }, (_, k) => 30 * Math.pow(16000 / 30, k / 32));
    let want = -1;
    for (let k = 0; k < 32; k++) {
      if (edges[k] <= 440 && 440 < edges[k + 1]) want = k;
    }
    assert.notEqual(want, -1);
    const means = Array(32).fill(0);
    for (const fr of f.frames) fr.bands.forEach((v, k) => { means[k] += v; });
    for (let k = 0; k < 32; k++) means[k] /= f.frames.length;
    let best = 0;
    for (let k = 1; k < 32; k++) if (means[k] > means[best]) best = k;
    assert.equal(best, want, `max band was ${best}, want ${want}`);
    assert.ok(means[want] > 0.5, `440 Hz band mean was ${means[want]}`);
  });
});

for (const [bpm, file] of [[140, 'click140'], [174, 'click174']]) {
  const getPath = () => (file === 'click140' ? click140 : click174);
  describe(`audio features — ${bpm} BPM click track (6 s)`, () => {
    it('detects every click as an onset within ±1 frame at 30 fps', async () => {
      const f = await analyzeAudio(getPath(), { fps: FPS });
      assert.equal(f.frames.length, 180);
      const { times } = clickTrack(bpm, 6);
      for (const c of times) {
        const frame = Math.round(c * FPS);
        const hit = f.meta.onsets.some((o) => Math.abs(o - frame) <= 1);
        assert.ok(hit, `click at ${c}s (frame ${frame}) has no onset within ±1 frame`);
      }
      assert.equal(f.meta.onsets.length, times.length);
    });

    it(`estimates bpm ${bpm} ± 1`, async () => {
      const f = await analyzeAudio(getPath(), { fps: FPS });
      assert.ok(Math.abs(f.meta.bpm - bpm) <= 1, `bpm was ${f.meta.bpm}`);
    });
  });
}

describe('audio features — windowing', () => {
  it('startSec=1, durationSec=5 at 30 fps gives exactly 150 frames', async () => {
    const f = await analyzeAudio(sinePath, { fps: FPS, startSec: 1, durationSec: 5 });
    assert.equal(f.frames.length, 150);
    assert.equal(f.meta.frames, 150);
    assert.ok(Math.abs(f.frames[0].t - 0) < 1e-9, `first frame t was ${f.frames[0].t}`);
  });

  it('a 440 Hz sine yields non-flat wave on every frame after the first', async () => {
    const f = await analyzeAudio(sineLoudPath, { fps: FPS });
    for (let i = 1; i < f.frames.length; i++) {
      const w = f.frames[i].wave;
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of w) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      assert.ok(hi - lo > 1.5, `frame ${i} wave peak-to-peak was ${hi - lo}`);
    }
  });

  it('a track starting mid-loud-noise has no onset at frame 0', async () => {
    const f = await analyzeAudio(noisePath, { fps: FPS });
    assert.ok(!f.meta.onsets.includes(0), `onsets were ${f.meta.onsets.slice(0, 8)}`);
  });

  it('RMS of a full-scale sine is within 0.5 dB of -3.01 dBFS', async () => {
    const f = await analyzeAudio(sineLoudPath, { fps: FPS });
    const mean = f.frames.reduce((a, fr) => a + fr.rmsDb, 0) / f.frames.length;
    assert.ok(Math.abs(mean - -3.01) <= 0.5, `mean rmsDb was ${mean}`);
  });
});

describe('audio features — hard-left signal', () => {
  it('reports mean balance < -0.9', async () => {
    const f = await analyzeAudio(leftPath, { fps: FPS });
    const mean = f.frames.reduce((a, fr) => a + fr.balance, 0) / f.frames.length;
    assert.ok(mean < -0.9, `mean balance was ${mean}`);
  });
});

describe('audio features — determinism and errors', () => {
  it('writes byte-identical JSON for identical input twice', async () => {
    const a = await analyzeAudio(sinePath, { fps: FPS });
    const b = await analyzeAudio(sinePath, { fps: FPS });
    const p1 = join(dir, 'a.json');
    const p2 = join(dir, 'b.json');
    await writeFeatures(a, p1);
    await writeFeatures(b, p2);
    const [b1, b2] = await Promise.all([readFile(p1), readFile(p2)]);
    assert.ok(b1.equals(b2), 'writeFeatures output differed between runs');
  });

  it('rejects with an error naming the path when the file is missing', async () => {
    const missing = join(dir, 'does-not-exist.wav');
    await assert.rejects(analyzeAudio(missing, { fps: FPS }), (err) => {
      assert.ok(err instanceof Error);
      assert.ok(String(err.message).includes(missing), `message was: ${err.message}`);
      return true;
    });
  });
});
