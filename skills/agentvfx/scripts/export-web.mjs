// agentvfx (Apache-2.0, see LICENSE). Bundle selected templates and the live runtime into a folder a page
// can open with no network and no build. The GLSL prelude is imported here and inlined verbatim.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTES, hexToRgb } from "../engine/core/palettes.mjs";
import { resolveParams } from "../engine/core/templates.mjs";
import { loadLibrary } from "../engine/core/templates.mjs";
import { templatePasses } from "../engine/node/render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const runtimePath = path.join(here, "../runtime/agentvfx.js");
const preludePath = path.join(here, "../engine/web/prelude.mjs");
const licensePath = path.join(here, "../LICENSE");
const noticePath = path.join(here, "../NOTICE");
// The licence notice is added after stripUrls runs, so it survives; it names the repository without a scheme because the
// bundle must hold no fetchable URL. LICENSE and NOTICE, with their URLs, are written beside it.
const LICENSE_NOTICE = [
  "agentvfx is licensed under the Apache License 2.0; see LICENSE and NOTICE in this folder. Keep them with these files.",
  "Copyright 2026 Woojin Go (github.com/wjgoarxiv/agentvfx)",
];
const flashPaths = ["../engine/core/flash-constants.mjs", "../engine/core/flash.mjs"].map((p) => path.join(here, p));

function parseArgs(argv) {
  const ids = [];
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i];
    else ids.push(argv[i]);
  }
  return { ids, out };
}

function stripUrls(source) {
  return source.split("\n").filter((line) => !/https?:\/\//u.test(line)).join("\n");
}

// Shader credits cite their sources as links inside comments. The bundle keeps each credit and drops only the
// scheme, so the folder still holds no fetchable URL.
function delink(source) {
  return source.replace(/https?:\/\//gu, "");
}

function bundleRuntime() {
  const prelude = stripUrls(readFileSync(preludePath, "utf8"));
  const runtime = readFileSync(runtimePath, "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("import "))
    .join("\n");
  const glue = `const PALETTES = Object.freeze(${JSON.stringify(PALETTES)});\n${hexToRgb.toString()}\n${resolveParams.toString()}\n`;
  // The live flash guard runs the audit's own detector, inlined module by module without its import/export syntax.
  const flash = flashPaths.map((p) => readFileSync(p, "utf8").split("\n")
    .filter((line) => !line.startsWith("import ") && !line.startsWith("export {"))
    .map((line) => line.replace(/^export /u, ""))
    .join("\n")).join("\n");
  return `${LICENSE_NOTICE.map((line) => `// ${line}`).join("\n")}\n${prelude}\n${glue}\n${flash}\n${runtime}`;
}

function bundleTemplates(lib, ids) {
  const out = {};
  for (const id of ids) {
    const tpl = lib.get(id);
    const fx = structuredClone(tpl.fx);
    if (fx.X_AGENTVFX) delete fx.X_AGENTVFX.credits;
    out[id] = {
      fx,
      passes: templatePasses(tpl).map((pass) => ({
        target: pass.target,
        persistent: pass.persistent,
        file: pass.file,
        src: delink(readFileSync(path.join(tpl.dir, pass.file), "utf8")),
      })),
    };
  }
  return `export default ${JSON.stringify(out)};\n`;
}

function demoHtml(ids) {
  const hero = ids[0];
  const hit = ids.includes("test-strobe") ? "test-strobe" : ids[0];
  const head = ids.includes("sacred") ? "sacred" : ids[0];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<!-- ${LICENSE_NOTICE.join(" ")} -->
<title>agentvfx</title>
<style>
  html, body { margin: 0; background: #000; color: #fff; font: 16px sans-serif; }
  #hero { position: fixed; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
  #head { position: fixed; left: 24px; top: 24px; width: min(70vw, 640px); height: 96px; pointer-events: none; }
  #hit, label { position: fixed; z-index: 2; background: #111; color: #fff; border: 1px solid #fff; padding: 8px 14px; font: 16px sans-serif; }
  #hit { left: 24px; bottom: 24px; }
  label { right: 24px; bottom: 24px; }
  audio { position: fixed; left: 24px; bottom: 72px; width: min(70vw, 360px); }
</style>
</head>
<body>
<canvas id="hero"></canvas>
<canvas id="head"></canvas>
<button id="hit" type="button">Hit</button>
<audio id="player" controls></audio>
<label>Audio <input id="file" type="file" accept="audio/*"></label>
<script type="module">
import { AgentVfx } from "./agentvfx.js";
import templates from "./templates.js";
const hero = document.getElementById("hero");
const head = document.getElementById("head");
const fx = await AgentVfx.mount(hero, { templates, template: ${JSON.stringify(hero)} });
const label = AgentVfx.textSource({ text: "AGENTVFX", font: "700 64px sans-serif", color: "#ffffff", background: "#000000", width: 960, height: 180 });
await AgentVfx.mount(head, { templates, template: ${JSON.stringify(head)}, source: label });
const fire = () => fx.trigger(${JSON.stringify(hit)}, { preset: "hold", durationMs: 2000 });
document.getElementById("hit").addEventListener("pointerenter", fire);
document.getElementById("hit").addEventListener("click", fire);
document.getElementById("file").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const player = document.getElementById("player");
  player.src = URL.createObjectURL(file);
  player.play();
  fx.audio(player);
});
window.__hit = fire;
window.__litReady = true;
</script>
</body>
</html>
`;
}

const { ids, out } = parseArgs(process.argv.slice(2));
if (!out || ids.length === 0) {
  console.error("usage: node scripts/export-web.mjs <templateId...> --out <dir>");
  process.exit(1);
}
const lib = loadLibrary({ includeTest: true });
const missing = ids.filter((id) => !lib.has(id));
if (missing.length) {
  for (const id of missing) console.error(`unknown template id ${id}`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const files = {
  "agentvfx.js": bundleRuntime(),
  "templates.js": bundleTemplates(lib, ids),
  "demo.html": demoHtml(ids),
};
for (const [name, body] of Object.entries(files)) {
  if (/https?:\/\//u.test(body)) {
    console.error(`${name} still contains an external URL`);
    process.exit(1);
  }
  writeFileSync(path.join(out, name), body);
}
// The licence and notice carry URLs by design, so they are copied verbatim after the no-URL check above.
writeFileSync(path.join(out, "LICENSE"), readFileSync(licensePath));
writeFileSync(path.join(out, "NOTICE"), readFileSync(noticePath));
