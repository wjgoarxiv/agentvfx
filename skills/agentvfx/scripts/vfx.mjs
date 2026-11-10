#!/usr/bin/env node
// agentvfx (Apache-2.0, see LICENSE). Command-line entry: `vfx.mjs <subcommand> ...`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BlockedError, ChromeSession, findChrome, chromeVersion, stageFlags } from "../engine/node/chrome.mjs";
import { findFfmpeg, ffmpegVersion } from "../engine/node/encode.mjs";
import { EXIT } from "../engine/core/constants.mjs";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { runJob } from "../engine/node/job.mjs";

const out = (obj) => process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);

async function doctor() {
  const report = { ok: false, chrome: null, chromeVersion: null, webgl2: false, renderer: null, extensions: {}, ffmpeg: null, blockers: [] };
  const ffmpeg = findFfmpeg();
  report.ffmpeg = ffmpeg ? ffmpegVersion(ffmpeg) : null;
  if (!report.ffmpeg) report.blockers.push("BLOCKED_NO_FFMPEG_FOR_VIDEO: ffmpeg not found (set FFMPEG_PATH or install ffmpeg)");
  const chrome = findChrome();
  if (!chrome) {
    report.blockers.push("BLOCKED_NO_CHROME: Chrome/Chromium not found (set CHROME_PATH or install Google Chrome)");
    out(report);
    return EXIT.BLOCKED_NO_CHROME;
  }
  report.chrome = chrome;
  report.chromeVersion = chromeVersion(chrome);
  const profileDir = mkdtempSync(path.join(tmpdir(), "agentvfx-doctor-"));
  let session;
  try {
    session = await ChromeSession.launch({ chrome, flags: stageFlags({ width: 1920, height: 1080, rung: "gpu" }), profileDir, routes: () => null });
    await session.openPage();
    const probe = await session.evaluate(`(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return { webgl2: false };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const has = (n) => Boolean(gl.getExtension(n));
      return {
        webgl2: true,
        renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
        extensions: { EXT_color_buffer_float: has('EXT_color_buffer_float'), OES_texture_float_linear: has('OES_texture_float_linear') },
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      };
    })()`);
    Object.assign(report, probe);
  } catch (error) {
    report.blockers.push(error instanceof BlockedError ? error.message : `BLOCKED_NO_CHROME: ${error.message}`);
    out(report);
    return error instanceof BlockedError ? error.code : EXIT.BLOCKED_NO_CHROME;
  } finally {
    if (session) await session.close();
  }
  if (!report.webgl2) report.blockers.push("BLOCKED_NO_WEBGL2: no WebGL2 context on the GPU rung");
  else {
    if (!/ANGLE/u.test(report.renderer ?? "") || /swiftshader/iu.test(report.renderer ?? "")) report.blockers.push(`BLOCKED_NO_WEBGL2: renderer is not a GPU ANGLE backend (${report.renderer})`);
    for (const [name, ok] of Object.entries(report.extensions)) if (!ok) report.blockers.push(`BLOCKED_NO_WEBGL2: ${name} missing`);
  }
  report.ok = report.blockers.length === 0;
  out(report);
  if (report.ok) return EXIT.OK;
  return report.ffmpeg ? EXIT.BLOCKED_NO_WEBGL2 : EXIT.BLOCKED_NO_FFMPEG_FOR_VIDEO;
}

function list(args) {
  const lib = loadLibrary({ includeTest: args.includes("--include-test") });
  const rows = [...lib.values()].map((t) => ({
    id: t.id, family: t.fx.X_AGENTVFX.family, input: t.fx.X_AGENTVFX.input, flash: t.fx.X_AGENTVFX.flash,
    presets: Object.keys(t.fx.X_AGENTVFX.presets), description: t.fx.DESCRIPTION,
  }));
  if (args.includes("--json")) out(rows);
  else for (const r of rows) process.stdout.write(`${r.family.padEnd(14)} ${r.id.padEnd(22)} ${r.input.padEnd(10)} ${r.presets.join(", ")}\n`);
  return EXIT.OK;
}

function readScore(file) {
  if (!file || !existsSync(file)) throw new BlockedError(EXIT.USAGE, `score file not found: ${file}`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new BlockedError(EXIT.SCORE_INVALID, `SCORE_INVALID: ${file} is not valid JSON (${error.message})`);
  }
}

function validate([file]) {
  const lib = loadLibrary({ includeTest: true });
  for (const [id, t] of lib) {
    const r = validateTemplate(t.fx, id);
    if (!r.ok) {
      out({ ok: false, template: id, errors: r.errors });
      return EXIT.SCORE_INVALID;
    }
  }
  const r = validateScore(readScore(file), lib);
  out(r.ok ? { ok: true, score: r.value } : { ok: false, errors: r.errors });
  return r.ok ? EXIT.OK : EXIT.SCORE_INVALID;
}

function flag(args, name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

async function render(args) {
  const file = args[0];
  const outDir = flag(args, "--out");
  if (!file || !outDir) {
    process.stderr.write("usage: vfx.mjs render <score.json> --out <dir> [--width W --height H] [--no-replay]\n");
    return EXIT.USAGE;
  }
  const lib = loadLibrary({ includeTest: true });
  const v = validateScore(readScore(file), lib);
  if (!v.ok) {
    out({ ok: false, errors: v.errors });
    return EXIT.SCORE_INVALID;
  }
  const width = flag(args, "--width") ? Number(flag(args, "--width")) : undefined;
  const height = flag(args, "--height") ? Number(flag(args, "--height")) : undefined;
  const gate = await runJob(v.value, lib, { outDir: path.resolve(outDir), width, height, replay: !args.includes("--no-replay") });
  out({
    ok: gate.ok, film: gate.withheld ?? gate.render.film, frames: gate.render.frames, size: `${gate.render.width}x${gate.render.height}`, renderMs: gate.render.renderMs,
    determinism: gate.determinism.pass ?? "not checked",
    flash: { exceeds: gate.flash.exceeds, flashesPerSecondMax: gate.flash.flashesPerSecondMax, redFlashes: gate.flash.redFlashes },
    safetyNotice: gate.safetyNotice?.file ?? null, safeVariant: gate.safeVariant ? { film: gate.safeVariant.withheld ?? gate.safeVariant.film, exceeds: gate.safeVariant.flash.exceeds } : null,
    stills: { sheet: gate.stills.sheet, strips: gate.stills.strips.map((s) => s.file), poster: gate.stills.poster },
    credit: gate.credit.text,
    next: "open stills/sheet.png and every strip with Read before reporting; give the user the credit line from CREDIT.txt",
  });
  if (gate.determinism.pass === false) return EXIT.STAGE_NONDETERMINISTIC;
  return gate.ok ? EXIT.OK : EXIT.GATE_FAIL_QA;
}

async function analyze(args) {
  const file = args[0];
  if (!file) {
    process.stderr.write("usage: vfx.mjs analyze <audio> [--fps 30] [--out features.json]\n");
    return EXIT.USAGE;
  }
  if (!existsSync(file)) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: audio not found: ${file}`);
  const { analyzeAudio, writeFeatures, summarize } = await import("../engine/node/audio.mjs");
  const features = await analyzeAudio(file, { fps: Number(flag(args, "--fps", "30")) });
  const outFile = flag(args, "--out", path.join(path.dirname(file), "features.json"));
  await writeFeatures(features, outFile);
  out({ ...summarize(features), features: outFile });
  return EXIT.OK;
}

function exportWeb(args) {
  const script = new URL("./export-web.mjs", import.meta.url).pathname;
  const r = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  return r.status ?? 1;
}

const COMMANDS = { doctor, list, validate, render, analyze, "export-web": exportWeb };

async function main(argv) {
  const [cmd, ...rest] = argv;
  const fn = COMMANDS[cmd];
  if (!fn) {
    process.stderr.write(`usage: vfx.mjs <${Object.keys(COMMANDS).join("|")}> ...\n`);
    return EXIT.USAGE;
  }
  return fn(rest);
}

main(process.argv.slice(2)).then((code) => process.exit(code ?? 0), (error) => {
  if (error instanceof BlockedError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.code);
  }
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
