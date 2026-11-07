// usage: node test/_render_light.mjs [outDir]   (default ./out/ under the current directory; renders the light-family demos)
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(process.argv[2] ?? "out");

const jobs = [
  ["templates/light/bloom-glow/demo-neon-night.json", "bloom-glow-neon-night"],
  ["templates/light/anamorphic-streak/demo-anamorphic-cinema.json", "anamorphic-streak-anamorphic-cinema"],
  ["templates/light/god-rays/demo-golden-hour.json", "god-rays-golden-hour"],
  ["templates/light/light-leak/demo-vintage-burn.json", "light-leak-vintage-burn"],
  ["templates/light/neon-saber/demo-saber-laser.json", "neon-saber-saber-laser"],
  ["templates/light/lens-flare/demo-sun-ghosts.json", "lens-flare-sun-ghosts"],
  ["templates/light/light-sweep/demo-logo-sweep.json", "light-sweep-logo-sweep"],
  ["templates/light/bloom-glow/demo-clip01-low.json", "bloom-glow-clip01-low"],
  ["templates/light/light-sweep/demo-onset.json", "light-sweep-onset"],
];

let failed = 0;
for (const [score, name] of jobs) {
  const out = path.join(outDir, name);
  mkdirSync(out, { recursive: true });
  const started = Date.now();
  console.log(`START ${out}`);
  const r = spawnSync("node", ["scripts/vfx.mjs", "render", score, "--out", out], { stdio: "inherit", cwd: root });
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  if (r.status !== 0) {
    failed += 1;
    console.log(`FAIL ${out} status=${r.status} sec=${sec}`);
  } else {
    console.log(`OK ${out} sec=${sec}`);
  }
}
console.log(failed === 0 ? "RENDER_ALL_OK" : `RENDER_FAILED ${failed}`);
process.exit(failed === 0 ? 0 : 1);
