// agentvfx (agentvfx licence, see LICENSE). One render job, end to end: resolve the score's footage and audio, analyse
// the audio, render the master (stage mode: full intensity, never tamed), keep the eye's stills, run
// the flash audit as a report, write SAFETY.txt and the MP4 comment when limits are exceeded, and, only
// when asked (safety.mode "broadcast-safe" or safeVariant), render a substituted broadcast-safe file.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXIT } from "../core/constants.mjs";
import { BlockedError } from "./chrome.mjs";
import { createFlashAuditor } from "../core/flash.mjs";
import { CREDIT_TEXT, creditText } from "../core/mark.mjs";
import { buildSchedule } from "../core/schedule.mjs";
import { findFfmpeg } from "./encode.mjs";
import { createEye } from "./eye.mjs";
import { extractAudio, extractAudioFile, openFootage } from "./footage.mjs";
import { renderScore } from "./render.mjs";

export const FLASH_COMMENT = "contains intense flashing";
const SAFE = { maxPerSecond: 3, minGapMs: 334 };

async function loadAudio() {
  return import("./audio.mjs");
}

/** Broadcast-safe hits: keep flashing hits at most 3 per 1 s with leading edges >= 334 ms apart; substitute the rest. */
export function safeScore(score, lib, features) {
  const fps = score.fps;
  const sched = buildSchedule({ ...score, cuts: [], bindings: [] }, lib, { features });
  const starts = (score.hits ?? []).map((h, i) => ({ i, h, start: sched.frames.findIndex((fr) => fr.layers.some((l) => l.key === `h${i}`)) }));
  const flashing = (id) => ["possible", "strobe"].includes(lib.get(id)?.fx.X_AGENTVFX.flash);
  const kept = [];
  const substitutions = [];
  const hits = [];
  for (const { i, h, start } of starts.sort((a, b) => a.start - b.start || a.i - b.i)) {
    if (!flashing(h.template)) {
      hits.push(h);
      continue;
    }
    const gapOk = kept.every((k) => Math.abs(start - k) * 1000 / fps >= SAFE.minGapMs);
    const windowOk = kept.filter((k) => start - k < fps).length < SAFE.maxPerSecond;
    const sub = lib.get(h.template).fx.X_AGENTVFX.safeSubstitute;
    if (start >= 0 && gapOk && windowOk) {
      kept.push(start);
      // A kept hit is one flash, not a burst: a params-only substitute (e.g. pulses: 1) still applies.
      hits.push(sub?.params && !sub.template ? { ...h, params: { ...(h.params ?? {}), ...sub.params } } : h);
      continue;
    }
    if (sub) {
      // A hit swaps to the substitute template (a motion or isoluminant hit); without one, the
      // substitute params tame the same template.
      const replaced = sub.template
        ? { ...h, template: sub.template, preset: undefined, params: undefined }
        : { ...h, params: { ...(h.params ?? {}), ...(sub.params ?? {}) } };
      hits.push(replaced);
      substitutions.push({ hit: i, frame: start, from: h.template, to: replaced.template, params: sub.params ?? {} });
    } else substitutions.push({ hit: i, frame: start, from: h.template, to: null, dropped: true });
  }
  const tame = (layer) => {
    const ref = typeof layer === "string" ? { template: layer } : layer;
    const sub = lib.get(ref.template)?.fx.X_AGENTVFX.flash === "strobe" ? lib.get(ref.template).fx.X_AGENTVFX.safeSubstitute : null;
    return sub ? { ...ref, params: { ...(ref.params ?? {}), ...(sub.params ?? {}) } } : layer;
  };
  const base = tame({ template: score.template, preset: score.preset, params: score.params });
  return {
    score: { ...score, params: base.params, stack: score.stack?.map(tame), cuts: score.cuts?.map((c) => ({ ...c, layers: c.layers.map(tame) })), hits: hits.length ? hits : undefined },
    substitutions,
  };
}

function remuxComment(file, comment) {
  const tmp = `${file}.tmp.mp4`;
  const r = spawnSync(findFfmpeg(), ["-v", "error", "-y", "-i", file, "-map", "0", "-c", "copy", "-metadata", `comment=${comment}`, "-movflags", "+faststart", tmp], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`could not tag ${file}: ${r.stderr}`);
  renameSync(tmp, file);
}

function safetyText(flash, film) {
  return [
    "SAFETY NOTICE: this clip contains intense flashing.",
    "",
    `File: ${path.basename(film)}`,
    `Worst 1 s window: ${flash.worstWindow?.transitions ?? "?"} transitions from ${flash.worstWindow?.startSec ?? "?"} s`,
    `Max flashes per second: ${flash.flashesPerSecondMax}`,
    `Red flashes: ${flash.redFlashes}`,
    `Extended flashing (4-6 transitions/s for 4 s): ${flash.extendedFlashing}`,
    "",
    "Limits exceeded: WCAG 2.2 SC 2.3.1 general flash / ITU-R BT.1702-3 (more than 3 flashes in any 1 s,",
    "or any saturated-red flash). This file was rendered at full intensity for stage use (stage mode).",
    "For broadcast or web posting, render with \"safety\": { \"safeVariant\": true } to also get film.safe.mp4.",
    "",
  ].join("\n");
}

async function pass({ score, lib, outDir, film, footageFile, audioWav, features, width, height, replay, events }) {
  const longEdge = width && height ? Math.max(width, height) : 1920;
  const footage = footageFile ? openFootage(footageFile, { fps: score.fps, startSec: score.input?.startSec ?? 0, durationSec: score.durationSec, longEdge }) : null;
  const w = width ?? footage?.width ?? 1920;
  const h = height ?? footage?.height ?? 1080;
  const sched = buildSchedule(score, lib, { features });
  const eventsAll = sched.events.length ? sched.events : (features?.meta?.onsets ?? []).filter((f) => f < sched.frameCount);
  const eye = createEye({ width: w, height: h, frameCount: sched.frameCount, events: events ?? eventsAll });
  const auditor = createFlashAuditor({ fps: score.fps, width: w, height: h });
  try {
    const report = await renderScore(score, lib, {
      outDir, width: w, height: h, features, footage, audioFile: audioWav, replay,
      onFrame: (f, a) => {
        auditor.push({ width: w, height: h, data: a.rgba });
        if (eye.wants(f)) eye.push(f, a.rgba);
      },
    });
    if (film !== report.film) renameSync(report.film, film);
    return { report: { ...report, film }, flash: auditor.finish(), eye, footage: footage ? { width: footage.width, height: footage.height, matrix: footage.matrix, transport: "cdp-fetch-interception" } : null };
  } finally {
    footage?.close();
  }
}

/**
 * Run a validated score. Writes film.mp4, stills/, gate-report.json, features.json (with audio),
 * CREDIT.txt (the attribution line), SAFETY.txt (stage mode, limits exceeded), film.safe.mp4 (safe variant) or withheld/ (safe file failed).
 */
export async function runJob(score, lib, { outDir, width, height, replay = true, cwd = process.cwd() }) {
  mkdirSync(outDir, { recursive: true });
  const footageFile = score.input?.video ? path.resolve(cwd, score.input.video) : null;
  if (footageFile && !existsSync(footageFile)) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: input.video not found: ${footageFile}`);
  const window = { startSec: score.input?.startSec ?? 0, durationSec: score.durationSec };
  const tmpDirs = [];
  try {
    let audio = null;
    if (score.input?.audio) audio = extractAudioFile(path.resolve(cwd, score.input.audio), window);
    else if (footageFile) audio = extractAudio(footageFile, window);
    if (audio) tmpDirs.push(audio.dir);
    let features = null;
    if (audio) {
      const { analyzeAudio, writeFeatures } = await loadAudio();
      features = await analyzeAudio(audio.file, { fps: score.fps });
      await writeFeatures(features, path.join(outDir, "features.json"));
    }
    const stageMode = score.safety.mode === "stage";
    const gate = { ok: true, score, safetyMode: score.safety.mode };
    const master = await pass({ score: stageMode ? score : safeScore(score, lib, features).score, lib, outDir, film: path.join(outDir, "film.mp4"), footageFile, audioWav: audio?.file ?? null, features, width, height, replay });
    gate.render = master.report;
    gate.flash = master.flash;
    gate.footage = master.footage;
    gate.stills = master.eye.write(outDir);
    gate.determinism = master.report.determinism;
    if (master.report.determinism.pass === false) gate.ok = false;
    if (stageMode && master.flash.exceeds) {
      writeFileSync(path.join(outDir, "SAFETY.txt"), safetyText(master.flash, master.report.film));
      remuxComment(master.report.film, FLASH_COMMENT);
      gate.safetyNotice = { file: path.join(outDir, "SAFETY.txt"), mp4Comment: FLASH_COMMENT };
    }
    if (!stageMode && master.flash.exceeds) {
      const held = path.join(outDir, "withheld");
      mkdirSync(held, { recursive: true });
      renameSync(master.report.film, path.join(held, "film.mp4"));
      gate.ok = false;
      gate.withheld = path.join(held, "film.mp4");
    }
    if (!stageMode) gate.substitutions = safeScore(score, lib, features).substitutions;
    if (stageMode && score.safety.safeVariant) {
      const safe = safeScore(score, lib, features);
      const safeDir = path.join(outDir, ".safe");
      const res = await pass({ score: safe.score, lib, outDir: safeDir, film: path.join(outDir, "film.safe.mp4"), footageFile, audioWav: audio?.file ?? null, features, width, height, replay: false, events: master.eye.plan.strips.map((s) => s.centre) });
      rmSync(safeDir, { recursive: true, force: true });
      gate.safeVariant = { film: res.report.film, flash: res.flash, substitutions: safe.substitutions };
      if (res.flash.exceeds) {
        const held = path.join(outDir, "withheld");
        mkdirSync(held, { recursive: true });
        renameSync(res.report.film, path.join(held, "film.safe.mp4"));
        gate.safeVariant.withheld = path.join(held, "film.safe.mp4");
      }
    }
    writeFileSync(path.join(outDir, "CREDIT.txt"), creditText());
    gate.credit = { text: CREDIT_TEXT, file: path.join(outDir, "CREDIT.txt") };
    writeFileSync(path.join(outDir, "gate-report.json"), `${JSON.stringify(gate, null, 2)}\n`);
    return gate;
  } finally {
    for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  }
}
