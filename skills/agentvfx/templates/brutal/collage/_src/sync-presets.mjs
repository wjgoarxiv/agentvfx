// Writes the editorial presets of ../fx.json from ../layouts.json (entries written as { cells, params }); the old
// tile presets already in fx.json stay as they are. Run: node templates/brutal/collage/_src/sync-presets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layoutToParams } from "../layout.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fxFile = path.join(dir, "fx.json");
const fx = JSON.parse(readFileSync(fxFile, "utf8"));
const layouts = JSON.parse(readFileSync(path.join(dir, "layouts.json"), "utf8"));
const editorial = Object.entries(layouts).filter(([, e]) => !Array.isArray(e));
const old = Object.entries(fx.X_AGENTVFX.presets).filter(([n]) => !editorial.some(([m]) => m === n));
fx.X_AGENTVFX.presets = Object.fromEntries([...editorial.map(([n, e]) => [n, { ...e.params, ...layoutToParams(e) }]), ...old]);
writeFileSync(fxFile, `${JSON.stringify(fx, null, 2)}\n`);
process.stdout.write(`presets: ${Object.keys(fx.X_AGENTVFX.presets).join(", ")}\n`);
