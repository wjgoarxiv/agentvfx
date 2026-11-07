// Offline audio feature analysis for the agentvfx engine (plan task 7).
// Decodes with the system ffmpeg to float32 48 kHz stereo, runs an own
// radix-2 FFT (N=4096, Hann) in plain JS, and emits per-video-frame
// features in two passes: track statistics first, then normalisation.
// Deterministic: same input bytes -> byte-identical JSON (floats rounded
// to 6 decimals, fixed key order).
//
// Algorithm notes (ideas only, reimplemented here): log-spaced analysis
// bands in the spirit of librosa chroma/STFT practice (librosa, ISC);
// Butterchurn-style (MIT) energy bands 20-320 / 320-2800 / 2800-11025 Hz
// expressed as a ratio to a ~4 s long average (1 = typical); spectral-flux
// onset detection and onset-autocorrelation tempo in the style of the
// librosa/aubio literature. No aubio (GPL) or Essentia (AGPL) code is used.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';

const SR = 48000;
const N = 4096;
const HALF = N / 2;
const BIN_HZ = SR / N;
const NBANDS = 32;
const BAND_LO = 30;
const BAND_HI = 16000;
const DB_RANGE = 70;
const ATTACK_MS = 10;
const RELEASE_MS = 150;
// Onset picking: adaptive threshold (moving median over +/-0.2 s + delta)
// with a ~0.1 s minimum gap, plus low-band (kick) flux weighting.
const ONSET_FLOOR = 0.1;
const ONSET_DELTA = 0.25;
const ONSET_MED_HALF = 6; // frames each side (~0.2 s at 30 fps)
const MIN_GAP_SEC = 0.1;
const KICK_WEIGHT = 0.5;
// Tempo prior: log-normal centred at 120 BPM, sigma ~1 octave, over 60-180.
const PRIOR_REF_BPM = 120;

// Log-spaced band edges, 30 Hz - 16 kHz, 32 bands.
const BAND_EDGES = Array.from(
  { length: NBANDS + 1 },
  (_, k) => BAND_LO * Math.pow(BAND_HI / BAND_LO, k / NBANDS),
);

const HANN = new Float64Array(N);
for (let n = 0; n < N; n++) {
  HANN[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
}

const REV = new Uint16Array(N);
{
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >>> b) & 1) << (bits - 1 - b);
    REV[i] = r;
  }
}
const TW_RE = new Float64Array(HALF);
const TW_IM = new Float64Array(HALF);
for (let k = 0; k < HALF; k++) {
  TW_RE[k] = Math.cos((-2 * Math.PI * k) / N);
  TW_IM[k] = Math.sin((-2 * Math.PI * k) / N);
}

// In-place radix-2 DIT FFT on Float64Array pairs.
function fft(re, im) {
  for (let i = 0; i < N; i++) {
    const j = REV[i];
    if (j > i) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >>> 1;
    const step = N / len;
    for (let base = 0; base < N; base += len) {
      for (let j = 0; j < half; j++) {
        const w = TW_RE[j * step];
        const wi = TW_IM[j * step];
        const a = base + j;
        const b = a + half;
        const tr = re[b] * w - im[b] * wi;
        const ti = re[b] * wi + im[b] * w;
        const ar = re[a];
        const ai = im[a];
        re[a] = ar + tr;
        im[a] = ai + ti;
        re[b] = ar - tr;
        im[b] = ai - ti;
      }
    }
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Power (relative to a full-scale sine peak of 0.25) mapped dB -> 0..1 over 70 dB.
function db01(power) {
  return clamp01((10 * Math.log10(power + 1e-12) + DB_RANGE) / DB_RANGE);
}
const r6 = (v) => {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};

function binRange(loHz, hiHz) {
  const lo = Math.max(1, Math.ceil(loHz / BIN_HZ));
  const hi = Math.min(HALF - 1, Math.floor((hiHz - 1e-9) / BIN_HZ));
  return [lo, hi];
}

function decodeAudio(path, { startSec, durationSec }) {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-ss', String(startSec), '-i', path];
    if (durationSec != null) args.push('-t', String(durationSec));
    args.push('-ar', String(SR), '-ac', '2', '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1');
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => {
      reject(new Error(`ffmpeg failed to decode ${path}: ${err.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed to decode ${path} (exit ${code}): ${stderr.trim()}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      const n = Math.floor(buf.length / 8);
      const left = new Float32Array(n);
      const right = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        left[i] = buf.readFloatLE(i * 8);
        right[i] = buf.readFloatLE(i * 8 + 4);
      }
      resolve({ left, right, samples: n });
    });
  });
}

function windowAt(data, center, out) {
  const start = center - HALF;
  for (let i = 0; i < N; i++) {
    const idx = start + i;
    out[i] = idx >= 0 && idx < data.length ? data[idx] * HANN[i] : 0;
  }
}

// Magnitude-squared spectrum (normalised so a full-scale sine peaks at 0.25).
function magnitudeSquared(monoWin, re, im, mag2) {
  for (let i = 0; i < N; i++) {
    re[i] = monoWin[i];
    im[i] = 0;
  }
  fft(re, im);
  for (let b = 0; b < HALF; b++) {
    mag2[b] = (re[b] * re[b] + im[b] * im[b]) / (N * N);
  }
}

export async function analyzeAudio(path, { fps = 30, startSec = 0, durationSec = null } = {}) {
  try {
    await fs.access(path);
  } catch {
    throw new Error(`audio file not found: ${path}`);
  }
  const { left, right, samples } = await decodeAudio(path, { startSec, durationSec });
  const hop = SR / fps;
  const totalSec = durationSec != null ? durationSec : samples / SR;
  const nFrames = Math.max(1, Math.floor(totalSec * fps));

  const attA = 1 - Math.exp(-(1 / fps) / (ATTACK_MS / 1000));
  const relA = 1 - Math.exp(-(1 / fps) / (RELEASE_MS / 1000));
  const smooth = (cur, target) => cur + (target - cur) * (target > cur ? attA : relA);

  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const mag2 = new Float64Array(HALF);
  const monoWin = new Float64Array(N);
  const stereoL = new Float64Array(N);
  const stereoR = new Float64Array(N);

  const [bassLo, bassHi] = binRange(20, 320);
  const [midLo, midHi] = binRange(320, 2800);
  const [trebLo, trebHi] = binRange(2800, 11025);
  const bandRanges = Array.from({ length: NBANDS }, (_, k) => {
    const lo = Math.max(1, Math.ceil(BAND_EDGES[k] / BIN_HZ));
    const hi = Math.min(HALF - 1, Math.floor((BAND_EDGES[k + 1] - 1e-9) / BIN_HZ));
    if (lo <= hi) return [lo, hi];
    // A band narrower than one FFT bin takes the bin nearest its centre, so no band is dead.
    const c = Math.min(HALF - 1, Math.max(1, Math.round(Math.sqrt(BAND_EDGES[k] * BAND_EDGES[k + 1]) / BIN_HZ)));
    return [c, c];
  });

  const frames = [];
  const magStore = new Array(nFrames);
  const kickRaw = new Float64Array(nFrames);
  const bandState = new Float64Array(NBANDS);
  let bassAtt = 0;
  let midAtt = 0;
  let trebAtt = 0;
  const longHist = { bass: [], mid: [], treb: [] };
  const longWin = Math.max(1, Math.round(4 * fps));

  const monoAt = (idx) => {
    const l = idx >= 0 && idx < left.length ? left[idx] : 0;
    const r = idx >= 0 && idx < right.length ? right[idx] : 0;
    return (l + r) * 0.5;
  };

  for (let i = 0; i < nFrames; i++) {
    const center = Math.round(i * hop);
    windowAt(left, center, stereoL);
    windowAt(right, center, stereoR);
    for (let k = 0; k < N; k++) monoWin[k] = (stereoL[k] + stereoR[k]) * 0.5;

    // rms/peak on unwindowed mono over one hop around the frame centre.
    const w0 = Math.round(center - hop / 2);
    const w1 = Math.round(center + hop / 2);
    let sumSq = 0;
    let peak = 0;
    let wcount = 0;
    for (let k = w0; k < w1; k++) {
      const m = monoAt(k);
      sumSq += m * m;
      const a = Math.abs(m);
      if (a > peak) peak = a;
      wcount++;
    }
    let eL = 0;
    let eR = 0;
    let dot = 0;
    // Energy/balance from the unwindowed stereo neighbourhood.
    const s0 = center - HALF;
    for (let k = 0; k < N; k++) {
      const idx = s0 + k;
      const l = idx >= 0 && idx < left.length ? left[idx] : 0;
      const r = idx >= 0 && idx < right.length ? right[idx] : 0;
      eL += l * l;
      eR += r * r;
      dot += l * r;
    }
    const rms = wcount > 0 ? Math.sqrt(sumSq / wcount) : 0;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;

    magnitudeSquared(monoWin, re, im, mag2);
    magStore[i] = Float64Array.from(mag2);
    let kick = 0;
    for (let b = bassLo; b <= bassHi; b++) kick += Math.sqrt(mag2[b]);
    kickRaw[i] = kick;

    const bands = new Array(NBANDS);
    for (let k = 0; k < NBANDS; k++) {
      const [lo, hi] = bandRanges[k];
      let e = 0;
      for (let b = lo; b <= hi; b++) e += mag2[b];
      bandState[k] = smooth(bandState[k], db01(e));
      bands[k] = r6(bandState[k]);
    }

    const bandEnergy = (lo, hi) => {
      let e = 0;
      for (let b = lo; b <= hi; b++) e += mag2[b];
      return e;
    };
    const pushLong = (key, e) => {
      const h = longHist[key];
      h.push(e);
      if (h.length > longWin) h.shift();
      let s = 0;
      for (const v of h) s += v;
      return s / h.length;
    };
    const eBass = bandEnergy(bassLo, bassHi);
    const eMid = bandEnergy(midLo, midHi);
    const eTreb = bandEnergy(trebLo, trebHi);
    const avgBass = pushLong('bass', eBass);
    const avgMid = pushLong('mid', eMid);
    const avgTreb = pushLong('treb', eTreb);
    const bass = eBass / (avgBass + 1e-12);
    const mid = eMid / (avgMid + 1e-12);
    const treb = eTreb / (avgTreb + 1e-12);
    bassAtt = smooth(bassAtt, bass);
    midAtt = smooth(midAtt, mid);
    trebAtt = smooth(trebAtt, treb);

    const denom = Math.sqrt(eL * eR);
    const corr = denom > 1e-12 ? dot / denom : 0;
    const width = clamp01(1 - Math.abs(corr));
    const balance = eL + eR > 1e-12 ? (eR - eL) / (eR + eL) : 0;

    const spec = new Array(512);
    for (let s = 0; s < 512; s++) {
      let e = 0;
      for (let b = s * 4 + 1; b <= s * 4 + 4 && b < HALF; b++) e += mag2[b];
      spec[s] = r6(db01(e / 4));
    }

    // Trigger-aligned waveform from unwindowed mono: first rising zero
    // crossing in the 1024 samples before the frame centre, else near it.
    // (Windowed samples would taper the display to near-flat.)
    const segStart = center - 1024;
    const seg = new Float64Array(2048);
    for (let k = 0; k < 2048; k++) seg[k] = monoAt(segStart + k);
    let start = 1024 - 256;
    for (let k = 0; k + 1 < 1536; k++) {
      if (seg[k] <= 0 && seg[k + 1] > 0) {
        start = k + 1;
        break;
      }
    }
    const wave = new Array(512);
    const waveL = new Array(512);
    const waveR = new Array(512);
    for (let k = 0; k < 512; k++) {
      wave[k] = r6(seg[start + k]);
      // Stereo rows at the same trigger index, so scopes and XY see true L/R.
      const idx = segStart + start + k;
      waveL[k] = r6(idx >= 0 && idx < left.length ? left[idx] : 0);
      waveR[k] = r6(idx >= 0 && idx < right.length ? right[idx] : 0);
    }

    const xy = new Array(2048);
    for (let k = 0; k < 2048; k++) {
      const idx = s0 + HALF - 1024 + k;
      const l = idx >= 0 && idx < left.length ? left[idx] : 0;
      const r = idx >= 0 && idx < right.length ? right[idx] : 0;
      xy[k] = [r6(l), r6(r)];
    }

    frames.push({
      t: r6(i / fps),
      rms: r6(rms),
      peak: r6(peak),
      rmsDb: r6(rmsDb),
      bands,
      spec,
      bass: r6(bass),
      mid: r6(mid),
      treb: r6(treb),
      bass_att: r6(bassAtt),
      mid_att: r6(midAtt),
      treb_att: r6(trebAtt),
      flux: 0, // filled in pass two
      onset: 0,
      beat: 0,
      beatPhase: 0,
      bpm: 0, // filled in pass two (track bpm copied per frame)
      corr: r6(clamp01(corr * 0.5 + 0.5) * 2 - 1),
      width: r6(width),
      balance: r6(balance),
      wave,
      waveL,
      waveR,
      xy,
    });
  }

  // Pass two: flux from stored magnitudes (frame 0 uses a forward
  // difference so a clip starting mid-sound has no spurious onset there,
  // while a hit landing exactly at 0 still reads as an onset), normalise
  // by the track 95th percentile, peak-pick onsets with an adaptive
  // threshold and minimum gap, refine tempo off the frame grid, and lay a
  // beat grid on the exact (fractional) period.
  const magOf = (i, b) => Math.sqrt(magStore[i][b]);
  const fluxRaw = new Float64Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let f = 0;
    for (let b = 1; b < HALF; b++) {
      const later = i + 1 < nFrames ? magOf(i + 1, b) : 0;
      const d = i === 0 ? magOf(0, b) - later : magOf(i, b) - magOf(i - 1, b);
      if (d > 0) f += d;
    }
    fluxRaw[i] = f;
  }
  const p95of = (arr) => {
    const s = Array.from(arr).sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
  };
  const fluxNorm = p95of(fluxRaw) > 1e-12 ? p95of(fluxRaw) : 1;
  const kickNorm = p95of(kickRaw) > 1e-12 ? p95of(kickRaw) : 1;
  const flux = new Array(nFrames);
  const score = new Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    flux[i] = fluxRaw[i] / fluxNorm;
    score[i] = flux[i] + KICK_WEIGHT * (kickRaw[i] / kickNorm);
  }

  // Adaptive threshold: moving median over +/-0.2 s plus a delta, floored.
  const onsets = [];
  {
    const sorted = [];
    const medAt = (i) => {
      sorted.length = 0;
      for (let j = Math.max(0, i - ONSET_MED_HALF); j <= Math.min(nFrames - 1, i + ONSET_MED_HALF); j++) {
        sorted.push(score[j]);
      }
      sorted.sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const gap = Math.max(2, Math.round(MIN_GAP_SEC * fps));
    const cands = [];
    for (let i = 0; i < nFrames; i++) {
      const leftS = i > 0 ? score[i - 1] : -Infinity;
      const rightS = i < nFrames - 1 ? score[i + 1] : -Infinity;
      const thresh = Math.max(ONSET_FLOOR, medAt(i) + ONSET_DELTA);
      if (score[i] > thresh && score[i] >= leftS && score[i] > rightS) {
        cands.push(i);
      }
    }
    cands.sort((a, b) => score[b] - score[a] || a - b);
    const taken = new Array(nFrames).fill(false);
    for (const c of cands) {
      let clash = false;
      for (let j = Math.max(0, c - gap + 1); j <= Math.min(nFrames - 1, c + gap - 1); j++) {
        if (taken[j]) {
          clash = true;
          break;
        }
      }
      if (!clash) {
        taken[c] = true;
        onsets.push(c);
      }
    }
    onsets.sort((a, b) => a - b);
  }
  const onsetSet = new Set(onsets);
  for (let i = 0; i < nFrames; i++) {
    frames[i].flux = r6(flux[i]);
    frames[i].onset = onsetSet.has(i) ? 1 : 0;
  }

  // Tempo: mean-removed, per-lag normalised autocorrelation with a
  // log-normal prior at 120 BPM (sigma ~1 octave), refined to fractional
  // lags by interpolation plus parabolic interpolation.
  let bpm = 0;
  if (nFrames >= 8) {
    let mean = 0;
    for (let i = 0; i < nFrames; i++) mean += flux[i];
    mean /= nFrames;
    const y = flux.map((v) => v - mean);
    const yAt = (t) => {
      if (t < 0 || t > nFrames - 1) return 0;
      const i0 = Math.floor(t);
      const f = t - i0;
      const a = y[i0];
      const b = i0 + 1 < nFrames ? y[i0 + 1] : 0;
      return a + (b - a) * f;
    };
    const prior = (lag) => {
      const b = (60 * fps) / lag;
      const oct = Math.log2(b / PRIOR_REF_BPM);
      return Math.exp(-0.5 * oct * oct);
    };
    const corrAt = (lag) => {
      const start = Math.ceil(lag);
      let s = 0;
      for (let i = start; i < nFrames; i++) s += y[i] * yAt(i - lag);
      return (s / Math.max(1, nFrames - start)) * prior(lag);
    };
    const lo = Math.max(2, Math.floor((60 * fps) / 180));
    const hi = Math.ceil((60 * fps) / 60);
    let bestLag = 0;
    let bestScore = -Infinity;
    for (let lag = lo; lag <= hi && lag < nFrames; lag++) {
      const s = corrAt(lag);
      if (s > bestScore) {
        bestScore = s;
        bestLag = lag;
      }
    }
    // Comb score: how well a period explains the detected onsets (1 = every
    // onset on the grid). Phase is fitted over integer offsets.
    const combScore = (p) => {
      const K = Math.max(1, Math.ceil(p));
      let bestS = 0;
      for (let off = 0; off < K; off++) {
        let s = 0;
        for (const o of onsets) {
          const k = Math.round((o - off) / p);
          const g = off + k * p;
          const d = o - g;
          s += Math.exp(-(d * d) / 2);
        }
        if (s > bestS) bestS = s;
      }
      return bestS / Math.max(1, onsets.length);
    };
    if (bestScore > 1e-9 && bestLag > 0) {
      // Fractional refinement on a fine grid, then parabolic vertex.
      const step = 0.05;
      const glo = Math.max(lo, bestLag - 1);
      const ghi = Math.min(hi, bestLag + 1);
      let gl = bestLag;
      let gs = -Infinity;
      for (let lag = glo; lag <= ghi + 1e-9; lag += step) {
        const s = corrAt(lag);
        if (s > gs) {
          gs = s;
          gl = lag;
        }
      }
      let lag = gl;
      const s0 = corrAt(gl - step);
      const s1 = gs;
      const s2 = corrAt(gl + step);
      const denom = s0 - 2 * s1 + s2;
      if (denom < 0) {
        const off = 0.5 * (s0 - s2) / denom;
        if (Math.abs(off) <= 0.5) lag = gl + off * step;
      }
      let period = lag;
      // Onset-line fit: when detected onsets are nearly collinear in
      // (index, frame), their slope pins the period far more precisely than
      // the envelope autocorrelation (whose pulse shapes vary with
      // sub-frame hit position). It also corrects octave errors where the
      // autocorrelation locked onto a multiple of the true period.
      if (onsets.length >= 5) {
        const n = onsets.length;
        let sk = 0;
        let so = 0;
        let skk = 0;
        let sko = 0;
        for (let k = 0; k < n; k++) {
          sk += k;
          so += onsets[k];
          skk += k * k;
          sko += k * onsets[k];
        }
        const denomLs = n * skk - sk * sk;
        if (denomLs > 0) {
          const pLs = (n * sko - sk * so) / denomLs;
          const icept = (so - pLs * sk) / n;
          let rss = 0;
          for (let k = 0; k < n; k++) {
            const r = onsets[k] - (icept + pLs * k);
            rss += r * r;
          }
          const resid = Math.sqrt(rss / n);
          const inRange = pLs >= lo && pLs <= hi;
          const close = (a, b, tol) => Math.abs(a - b) / b < tol;
          if (resid < 0.75 && inRange) {
            if (close(pLs, lag, 0.03)) {
              period = pLs;
            } else {
              for (const m of [2, 3]) {
                if (close(lag / m, pLs, 0.04) && combScore(pLs) >= 0.75) {
                  period = pLs;
                  break;
                }
              }
            }
          }
        }
      }
      bpm = r6((60 * fps) / period);
    }
  }

  const beats = [];
  if (bpm > 0) {
    // Exact (fractional) period; beat k lands on round(phase + k*period)
    // so the grid cannot drift. Phase is fitted to the detected onsets.
    const period = (60 * fps) / bpm;
    const K = Math.max(1, Math.ceil(period));
    let maxF = 0;
    for (let i = 0; i < nFrames; i++) if (flux[i] > maxF) maxF = flux[i];
    let phase = 0;
    let best = -Infinity;
    for (let off = 0; off < K; off++) {
      let s = 0;
      for (const o of onsets) {
        const k = Math.round((o - off) / period);
        const g = off + k * period;
        s += Math.max(0, 1 - Math.abs(o - g) / 1.5);
      }
      if (s > best) {
        best = s;
        phase = off;
      }
    }
    for (let k = 0; ; k++) {
      const g = Math.round(phase + k * period);
      if (g >= nFrames) break;
      if (flux[g] > 0.05 * maxF) {
        frames[g].beat = 1;
        beats.push(g);
      }
    }
    for (let i = 0; i < nFrames; i++) {
      frames[i].beatPhase = r6(((((i - phase) / period) % 1) + 1) % 1);
    }
  }
  for (const fr of frames) fr.bpm = bpm;

  const meta = {
    sr: SR,
    fps,
    frames: nFrames,
    bpm,
    onsets,
    beats,
  };
  return { meta, frames };
}

export async function writeFeatures(features, outPath) {
  await fs.writeFile(outPath, JSON.stringify(features));
  return outPath;
}

export function summarize(features) {
  return {
    bpm: features.meta.bpm,
    onsetCount: features.meta.onsets.length,
    beatCount: features.meta.beats.length,
    frames: features.meta.frames,
  };
}
