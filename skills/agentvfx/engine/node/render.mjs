// agentvfx (agentvfx licence, see LICENSE). The host side of a render: open the render page in headless Chrome (GPU
// rung), prepare the templates, step every frame in order, capture, analyse in a worker pool, pipe
// RGBA to ffmpeg, then replay sampled frames in a fresh browser from frame 0 and compare bytes
// (determinism; exit 18 semantics after lit-typographic-motion's stage replay).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { EXIT } from "../core/constants.mjs";
import { resolvePalette } from "../core/palettes.mjs";
import { buildSchedule } from "../core/schedule.mjs";
import { BlockedError } from "./chrome.mjs";
import { findFfmpeg, startMaster } from "./encode.mjs";
import { FramePool, StageBrowser, analyzeChecked } from "./stage-capture.mjs";
import { seedToUnit } from "../web/prelude.mjs";
import { CREDIT_OVERLAY } from "../core/mark.mjs";

const PAGE = "lit/engine/render.html";
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Passes of one template as the page needs them: [{ file, target, persistent }]. */
export function templatePasses(tpl) {
  const passes = tpl.fx.PASSES;
  if (!Array.isArray(passes) || passes.length === 0) return [{ file: "main.frag", target: null, persistent: false }];
  return passes.map((p, i) => ({ file: i === passes.length - 1 ? "main.frag" : `pass${i}.frag`, target: i === passes.length - 1 ? null : p.TARGET ?? null, persistent: Boolean(p.PERSISTENT) }));
}

/** Frames the determinism replay samples: first, last and evenly spaced, `n` in all. */
export function sampleFrames(frameCount, n = 8) {
  if (frameCount <= n) return Array.from({ length: frameCount }, (_, i) => i);
  return [...new Set(Array.from({ length: n }, (_, i) => Math.round((i * (frameCount - 1)) / (n - 1))))];
}

/** The first differing 64x64 block between two RGBA frames, or null. */
export function firstDifference(a, b, width, height, block = 64) {
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      for (let y = by; y < Math.min(by + block, height); y++) {
        for (let x = bx; x < Math.min(bx + block, width); x++) {
          const o = (y * width + x) * 4;
          if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2]) return { x: bx, y: by, size: block };
        }
      }
    }
  }
  return null;
}

function pagePrepare({ schedule, lib, width, height, seed, palette, probeNondeterminism, credit = null }) {
  const templates = {};
  for (const id of schedule.templatesUsed) {
    const tpl = lib.get(id);
    templates[id] = { rel: tpl.rel, inputs: tpl.fx.INPUTS ?? [], passes: templatePasses(tpl), text: tpl.fx.X_AGENTVFX.text ?? null };
  }
  return { width, height, fps: schedule.fps, seed01: seedToUnit(seed), palette, templates, probeNondeterminism, credit };
}

function audioFor(features, f) {
  const fr = features?.frames?.[f];
  if (!fr) return null;
  const { xy, ...rest } = fr;
  return rest;
}

async function openRenderer({ prepare, width, height, seed, outDir, log, tag }) {
  const profileDir = mkdtempSync(path.join(tmpdir(), `agentvfx-${tag}-`));
  const browser = await StageBrowser.open({ stageDir: outDir, page: PAGE, prepare, width, height, seed, profileDir, rung: "gpu", log });
  if (!browser.prepared?.ok) {
    await browser.close();
    throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: render page failed to prepare: ${browser.prepared?.error ?? "no answer"}`);
  }
  return browser;
}

async function stepFrame(browser, f, schedule, features, footage) {
  if (footage) {
    const frame = await footage.frame(f);
    const route = `/lit/frame/${f}.rgba`;
    browser.dynamic = (p) => (p === route ? { body: frame, type: "application/octet-stream" } : null);
    await browser.evaluate(`window.__litFootageFetch(${JSON.stringify(route)}, ${footage.width}, ${footage.height})`);
    browser.dynamic = null;
  }
  const plan = { layers: schedule.frames[f].layers.map(({ key, template, params, t, labels, textStyle }) => ({ key, template, params, t, labels, textStyle })), audio: audioFor(features, f), footage: Boolean(footage) };
  try {
    await browser.evaluate(`window.__litStep(${f}, ${JSON.stringify(plan)})`);
  } catch (error) {
    throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: frame ${f}: ${error.message}`);
  }
}

/**
 * Render a validated score. Options: outDir, width/height (default 1920x1080), features (audio
 * analysis), footage ({ width, height, frame(f) -> Promise<Buffer RGBA> }), audioFile (muxed),
 * replay (default true), probeNondeterminism (test hook), onFrame(f, analysed) for stills/flash.
 * Returns the render report; writes outDir/film.mp4.
 */
export async function renderScore(score, lib, opts) {
  const { outDir, features = null, footage = null, audioFile = null, replay = true, probeNondeterminism = false, onFrame = null, comment = null, log = () => {} } = opts;
  const width = opts.width ?? footage?.width ?? 1920;
  const height = opts.height ?? footage?.height ?? 1080;
  mkdirSync(outDir, { recursive: true });
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new BlockedError(EXIT.BLOCKED_NO_FFMPEG_FOR_VIDEO, "BLOCKED_NO_FFMPEG_FOR_VIDEO: ffmpeg not found");
  const schedule = buildSchedule(score, lib, { features });
  const palette = resolvePalette(score.palette ?? "rainbow").map((c) => c.map(srgbToLinear));
  const prepare = pagePrepare({ schedule, lib, width, height, seed: score.seed, palette, probeNondeterminism, credit: score.credit?.overlay === false ? null : CREDIT_OVERLAY });
  const samples = sampleFrames(schedule.frameCount);
  const kept = new Map();
  const shas = [];
  const film = path.join(outDir, "film.mp4");
  const pool = new FramePool();
  let browser = null;
  let master = null;
  const t0 = Date.now();
  try {
    browser = await openRenderer({ prepare, width, height, seed: score.seed, outDir, log, tag: "master" });
    const renderer = browser.prepared.renderer;
    master = startMaster({ ffmpeg, width, height, fps: schedule.fps, out: film, audio: audioFile, comment });
    let pending = Promise.resolve();
    for (let f = 0; f < schedule.frameCount; f++) {
      await stepFrame(browser, f, schedule, features, footage);
      const png = await browser.capture();
      const analysed = analyzeChecked(pool, png, width, height);
      const prev = pending;
      pending = (async () => {
        const a = await analysed;
        await prev;
        shas[f] = a.rgbaSha256;
        if (samples.includes(f)) kept.set(f, a.rgba);
        if (onFrame) await onFrame(f, a);
        await master.write(a.rgba);
      })();
    }
    await pending;
    const enc = await master.finish();
    master = null;
    if (enc.code !== 0) throw new Error(`ffmpeg failed (${enc.code}): ${enc.stderr}`);
    await browser.close();
    browser = null;
    const report = { renderer, width, height, fps: schedule.fps, frames: schedule.frameCount, durationSec: schedule.frameCount / schedule.fps, renderMs: Date.now() - t0, events: schedule.events, film };
    if (!replay) return { ...report, determinism: { checked: false } };
    browser = await openRenderer({ prepare, width, height, seed: score.seed, outDir, log, tag: "replay" });
    const last = samples[samples.length - 1];
    for (let f = 0; f <= last; f++) {
      await stepFrame(browser, f, schedule, features, footage);
      if (!samples.includes(f)) continue;
      const a = await analyzeChecked(pool, await browser.capture(), width, height);
      if (a.rgbaSha256 !== shas[f]) {
        return { ...report, determinism: { checked: true, pass: false, sampled: samples, frame: f, firstDifference: firstDifference(kept.get(f), a.rgba, width, height) } };
      }
    }
    return { ...report, determinism: { checked: true, pass: true, sampled: samples } };
  } finally {
    if (master) await master.finish().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await pool.close();
  }
}

export function cleanDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}
