import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { APP_ORIGIN, ChromeSession, findChrome, stageFlags } from "../engine/node/chrome.mjs";
import { decodePng } from "../engine/node/png.mjs";
import { renderScore } from "../engine/node/render.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const exportScript = path.join(root, "scripts/export-web.mjs");
const URL_RE = /https?:\/\//iu;

function runExport(args) {
  return spawnSync(process.execPath, [exportScript, ...args], { encoding: "utf8" });
}

function assertNoExternalUrl(dir) {
  for (const name of ["agentvfx.js", "templates.js", "demo.html"]) {
    const text = readFileSync(path.join(dir, name), "utf8");
    assert.equal(URL_RE.test(text), false, `${name} contains an external URL`);
  }
}

function meanAbs(a, b) {
  const width = a.width ?? b.width;
  const height = a.height ?? b.height;
  const ap = a.pixels ?? a;
  const bp = b.pixels ?? b;
  const ac = a.channels ?? 4;
  const bc = b.channels ?? 4;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ia = (y * width + x) * ac;
      const ib = (y * width + x) * bc;
      sum += Math.abs(ap[ia] - bp[ib]) + Math.abs(ap[ia + 1] - bp[ib + 1]) + Math.abs(ap[ia + 2] - bp[ib + 2]);
      count += 3;
    }
  }
  return sum / count;
}

function meanRgb(image) {
  const pixels = image.pixels ?? image;
  const channels = image.channels ?? 4;
  const n = image.width && image.height ? image.width * image.height : pixels.length / channels;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    sum += pixels[o] + pixels[o + 1] + pixels[o + 2];
  }
  return sum / (n * 3);
}

async function shot(session, width, height) {
  const png = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  const image = decodePng(Buffer.from(png.data, "base64"));
  assert.equal(image.width, width, `screenshot width ${image.width}`);
  assert.equal(image.height, height, `screenshot height ${image.height}`);
  return image;
}

async function withChrome(dir, { width, height, reduced = false }, fn) {
  const chrome = findChrome();
  assert.ok(chrome, "Chrome/Chromium not found");
  const profileDir = mkdtempSync(path.join(tmpdir(), "agentvfx-web-"));
  const routes = (pathname) => {
    const rel = decodeURIComponent(pathname).replace(/^\/+/u, "");
    if (!rel || rel.includes("..")) return null;
    const file = path.join(dir, rel);
    if (!existsSync(file) || !statSync(file).isFile()) return null;
    return file;
  };
  const session = await ChromeSession.launch({
    chrome,
    flags: stageFlags({ width, height, rung: "gpu" }),
    profileDir,
    routes,
  });
  try {
    await session.openPage();
    await session.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    if (reduced) {
      await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    }
    return await fn(session);
  } finally {
    await session.close();
  }
}

async function open(session, page, readyExpr) {
  await session.navigate(`${APP_ORIGIN}/${page}`);
  const deadline = Date.now() + 20000;
  for (;;) {
    const ready = await session.evaluate(readyExpr).catch(() => false);
    if (ready) return;
    if (Date.now() > deadline) {
      const logs = session.logs.join("\n");
      throw new Error(`page did not become ready: ${page}\n${logs}`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

const PROBE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}canvas{display:block;width:320px;height:180px}</style></head>
<body><canvas id="c"></canvas><canvas id="bad"></canvas>
<script type="module">
import { AgentVfx } from "./agentvfx.js";
import templates from "./templates.js";
window.__fx = await AgentVfx.mount(document.getElementById("c"), { templates, template: "test-gradient", params: { speed: 0 }, motion: "always", dpr: 1 });
const broken = { ...templates, broken: { fx: { DESCRIPTION: "broken", INPUTS: [], X_AGENTVFX: { id: "broken", family: "_test", input: "generative", spdx: "MIT", flash: "none", presets: {} } }, passes: [{ target: null, persistent: false, src: "void main() { this is not glsl }" }] } };
try { await AgentVfx.mount(document.getElementById("bad"), { templates: broken, template: "broken", motion: "always", dpr: 1 }); window.__badThrew = false; } catch (e) { window.__badThrew = true; }
window.__litReady = true;
</script></body></html>`;

test("trigger() hits a still hero, a broken shader stays contained, and the context recovers after loss", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-probe-"));
  try {
    const exported = runExport(["test-gradient", "test-strobe", "--out", dir]);
    assert.equal(exported.status, 0, exported.stderr || exported.stdout);
    writeFileSync(path.join(dir, "probe.html"), PROBE);
    await withChrome(dir, { width: 320, height: 360 }, async (session) => {
      await open(session, "probe.html", "window.__litReady === true");
      const a = await shot(session, 320, 180);
      await new Promise((r) => setTimeout(r, 300));
      const b = await shot(session, 320, 180);
      assert.ok(meanAbs(a, b) < 1, "the still hero (speed 0) should not change");
      await session.evaluate("window.__fx.trigger('test-strobe', { preset: 'hold', durationMs: 600 })");
      await new Promise((r) => setTimeout(r, 120));
      const c = await shot(session, 320, 180);
      assert.ok(meanAbs(b, c) > 20, `trigger() did not change the next capture (${meanAbs(b, c).toFixed(2)})`);
      assert.equal(await session.evaluate("window.__badThrew"), false, "a compile error must not throw into the page");
      assert.ok(session.logs.some((l) => /broken/u.test(l)), `expected a console error naming the broken template\n${session.logs.join("\n")}`);
      await new Promise((r) => setTimeout(r, 700));
      const before = await shot(session, 320, 180);
      await session.evaluate("(() => { const gl = document.getElementById('c').getContext('webgl2'); window.__lose = gl.getExtension('WEBGL_lose_context'); window.__lose.loseContext(); return true; })()");
      await new Promise((r) => setTimeout(r, 200));
      await session.evaluate("window.__lose.restoreContext(), true");
      await new Promise((r) => setTimeout(r, 600));
      const after = await shot(session, 320, 180);
      assert.ok(meanRgb(after) > 8, "canvas is blank after context restore");
      assert.ok(meanAbs(before, after) < 3, `restored frame differs (${meanAbs(before, after).toFixed(2)})`);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const AUDIO_PROBE = `<!doctype html><html><head><meta charset="utf-8"></head>
<body><canvas id="c" style="width:160px;height:90px"></canvas>
<script type="module">
import { AgentVfx } from "./agentvfx.js";
import templates from "./templates.js";
const Base = window.AudioContext;
window.__ctxs = [];
window.AudioContext = class extends Base { constructor(...a) { super(...a); window.__ctxs.push(this); } };
const fx = await AgentVfx.mount(document.getElementById("c"), { templates, template: "test-gradient", motion: "always", dpr: 1 });
fx.audio(new Audio());
fx.destroy();
window.__litReady = true;
</script></body></html>`;

test("destroy() closes the AudioContext that audio() opened", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-audio-"));
  try {
    const exported = runExport(["test-gradient", "--out", dir]);
    assert.equal(exported.status, 0, exported.stderr || exported.stdout);
    writeFileSync(path.join(dir, "audio.html"), AUDIO_PROBE);
    await withChrome(dir, { width: 320, height: 180 }, async (session) => {
      await open(session, "audio.html", "window.__litReady === true");
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(await session.evaluate("window.__ctxs.length"), 1);
      assert.equal(await session.evaluate("window.__ctxs[0].state"), "closed");
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const GUARD_PROBE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}canvas{display:block;width:320px;height:180px}</style></head>
<body><canvas id="c"></canvas>
<script type="module">
import { AgentVfx } from "./agentvfx.js";
import templates from "./templates.js";
const q = new URLSearchParams(location.search);
window.__trips = [];
window.__fx = await AgentVfx.mount(document.getElementById("c"), {
  templates, template: q.get("t"), params: JSON.parse(q.get("p") || "{}"), motion: "always", dpr: 1,
  onFlashGuard: (info) => window.__trips.push(info),
});
window.__litReady = true;
</script></body></html>`;

async function guardRun(dir, query, ms) {
  return withChrome(dir, { width: 320, height: 180 }, async (session) => {
    await open(session, `guard.html?${query}`, "window.__litReady === true");
    await new Promise((r) => setTimeout(r, ms));
    const trips = await session.evaluate("JSON.stringify(window.__trips)").then(JSON.parse);
    const a = await shot(session, 320, 180);
    await new Promise((r) => setTimeout(r, 400));
    const b = await shot(session, 320, 180);
    let resumed = null;
    if (trips.length) {
      await session.evaluate("window.__fx.resume(), true");
      await new Promise((r) => setTimeout(r, 800));
      resumed = await session.evaluate("window.__trips.length");
    }
    return { trips, still: meanAbs(a, b), resumed };
  });
}

test("the live flash guard stops a strobe before a fourth flash in one second and shows no tripping frame", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-guard-"));
  try {
    const exported = runExport(["test-strobe", "test-gradient", "--out", dir]);
    assert.equal(exported.status, 0, exported.stderr || exported.stdout);
    writeFileSync(path.join(dir, "guard.html"), GUARD_PROBE);
    const strobe = await guardRun(dir, "t=test-strobe&p=%7B%22rate%22%3A12%7D", 1500);
    assert.equal(strobe.trips.length, 1, "a 12 Hz strobe must trip the guard once");
    assert.equal(strobe.trips[0].reason, "general");
    assert.ok(strobe.trips[0].shownTransitions <= 6, `shown transitions ${strobe.trips[0].shownTransitions} must stay at three flashes or fewer`);
    assert.ok(strobe.still < 0.5, "after the trip the canvas must hold still");
    assert.equal(strobe.resumed, 2, "resume() must run the effect again under a re-armed guard, which stops it again");
    const red = await guardRun(dir, "t=test-strobe&p=%7B%22rate%22%3A2%2C%22red%22%3Atrue%7D", 2500);
    assert.equal(red.trips.length, 1, "a slow saturated-red flash must trip the guard");
    assert.equal(red.trips[0].reason, "red");
    assert.ok(red.trips[0].shownRedTransitions <= 1, "no complete red flash may be shown");
    const calm = await guardRun(dir, "t=test-gradient", 1500);
    assert.equal(calm.trips.length, 0, "a calm gradient must not trip the guard");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export-web bundles templates whose shader credits carry links, keeping the credit without the scheme", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-export-"));
  try {
    const result = runExport(["boot-log", "halftone-field", "hud-deck", "vhs", "--out", dir]);
    assert.equal(result.status, 0, result.stderr);
    assertNoExternalUrl(dir);
    const bundled = readFileSync(path.join(dir, "templates.js"), "utf8");
    assert.match(bundled, /Inigo Quilez, iquilezles\.org\/articles\/distfunctions2d/u);
    assert.match(bundled, /en\.wikipedia\.org\/wiki\/YIQ/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export-web writes the LICENSE next to the bundle and keeps the licence notice in the runtime", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-export-"));
  try {
    const result = runExport(["test-gradient", "--out", dir]);
    assert.equal(result.status, 0, result.stderr);
    assertNoExternalUrl(dir);
    const license = readFileSync(path.join(dir, "LICENSE"), "utf8");
    assert.equal(license, readFileSync(path.join(root, "LICENSE"), "utf8"), "LICENSE is copied verbatim");
    assert.match(license, /^Required Notice: Copyright \(c\) 2026 Woojin Go \(https:\/\/github\.com\/wjgoarxiv\/agentvfx\)$/mu);
    const runtime = readFileSync(path.join(dir, "agentvfx.js"), "utf8");
    assert.match(runtime, /^\/\/ agentvfx licence: the full terms are in the LICENSE file in this folder/mu);
    assert.match(runtime, /^\/\/ Required Notice: Copyright \(c\) 2026 Woojin Go \(github\.com\/wjgoarxiv\/agentvfx\)$/mu);
    assert.match(readFileSync(path.join(dir, "demo.html"), "utf8"), /Required Notice: Copyright \(c\) 2026 Woojin Go/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("export-web rejects an unknown template id", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-export-"));
  try {
    const result = runExport(["no-such-template", "--out", dir]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /no-such-template/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("exported demo animates, freezes under reduced motion, and matches the offline frame", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-export-"));
  const offlineDir = mkdtempSync(path.join(tmpdir(), "agentvfx-offline-"));
  try {
    const exported = runExport(["test-gradient", "sacred", "test-strobe", "--out", dir]);
    assert.equal(exported.status, 0, exported.stderr || exported.stdout);
    for (const name of ["agentvfx.js", "templates.js", "demo.html"]) {
      assert.equal(existsSync(path.join(dir, name)), true, name);
    }
    assertNoExternalUrl(dir);
    const demo = readFileSync(path.join(dir, "demo.html"), "utf8");
    assert.match(demo, /test-gradient/u);
    assert.match(demo, /textSource/u);
    assert.match(demo, /type="file"/u);
    assert.match(demo, /trigger\(/u);

    const W = 640;
    const H = 360;
    await withChrome(dir, { width: W, height: H }, async (session) => {
      await open(session, "demo.html", "window.__litReady === true");
      const a = await shot(session, W, H);
      assert.ok(meanRgb(a) > 8, `demo canvas looks black (${meanRgb(a)})`);
      await new Promise((r) => setTimeout(r, 500));
      const b = await shot(session, W, H);
      assert.ok(meanAbs(a, b) > 1, "demo did not change across 500 ms");
      await session.evaluate("window.__hit()");
      await new Promise((r) => setTimeout(r, 100));
      const c = await shot(session, W, H);
      assert.ok(meanAbs(b, c) > 1, "trigger() did not change the next capture");
      const warned = session.logs.some((line) => /WCAG 2\.3\.1/u.test(line) && /test-strobe/u.test(line));
      assert.equal(warned, true, `expected a WCAG 2.3.1 warning for test-strobe\n${session.logs.join("\n")}`);
    });

    await withChrome(dir, { width: W, height: H, reduced: true }, async (session) => {
      await open(session, "demo.html", "window.__litReady === true");
      const a = await shot(session, W, H);
      await new Promise((r) => setTimeout(r, 500));
      const b = await shot(session, W, H);
      assert.equal(meanAbs(a, b), 0, "reduced motion captures differ");
      await session.evaluate("window.__hit()");
      await new Promise((r) => setTimeout(r, 100));
      const c = await shot(session, W, H);
      assert.equal(meanAbs(b, c), 0, "reduced motion did not suppress trigger()");
    });

    const lib = loadLibrary({ includeTest: true });
    const checked = validateScore({
      version: 1,
      template: "test-gradient",
      preset: "default",
      palette: "rainbow",
      durationSec: 3,
      fps: 30,
      seed: 1,
      out: "parity",
    }, lib);
    assert.equal(checked.ok, true, JSON.stringify(checked.errors));
    const frame = 15;
    let offline = null;
    await renderScore(checked.value, lib, {
      outDir: offlineDir,
      width: 256,
      height: 144,
      replay: false,
      onFrame: (f, analysed) => {
        if (f === frame) offline = analysed.rgba;
      },
    });
    assert.ok(offline, "offline frame missing");

    const harness = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#000">
<canvas id="c" width="256" height="144" style="width:256px;height:144px;display:block"></canvas>
<script type="module">
import { AgentVfx } from "./agentvfx.js";
import templates from "./templates.js";
const canvas = document.getElementById("c");
const fx = await AgentVfx.mount(canvas, {
  templates, template: "test-gradient", preset: "default", palette: "rainbow",
  seed: 1, dpr: 1, fps: 30, motion: "always"
});
window.__fx = fx;
window.__litReady = true;
</script>
</body></html>`;
    writeFileSync(path.join(dir, "harness.html"), harness);
    await withChrome(dir, { width: 256, height: 144 }, async (session) => {
      await open(session, "harness.html", "window.__litReady === true");
      await session.evaluate(`window.__fx.renderAt(${frame}/30)`);
      const live = await shot(session, 256, 144);
      const diff = meanAbs(live, { pixels: offline, channels: 4, width: 256, height: 144 });
      assert.ok(diff <= 2, `live vs offline mean abs ${diff} > 2`);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(offlineDir, { recursive: true, force: true });
  }
});

test("live analyser reads the same level window as the render, so loud masters do not pin every bar", () => {
  const runtime = readFileSync(path.join(root, "runtime/agentvfx.js"), "utf8");
  // Render: dB of power vs a full-scale sine, over 70 dB (engine/node/audio.mjs). AnalyserNode dB sit about 7 dB
  // higher on the same audio, so the live window is -63..+7 dB, unsmoothed (templates do their own attack/release).
  assert.match(runtime, /analyser\.minDecibels = -63;/u);
  assert.match(runtime, /analyser\.maxDecibels = 7;/u);
  assert.match(runtime, /analyser\.smoothingTimeConstant = 0;/u);
});
