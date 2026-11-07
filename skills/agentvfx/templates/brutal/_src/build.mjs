// Brutal family build. GLSL has no #include, so each template's shaders are assembled here from
// _src/shared/*.glsl and its own *.src.glsl parts, and fx.json plus demo scores are written from def.mjs.
// Run: node templates/brutal/_src/build.mjs   (the "_src" folder is never loaded as a template)
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(SRC, "..");

function include(text, dir) {
  return text.replace(/^\/\/@include (\S+)\s*$/gmu, (_, name) => {
    const local = path.join(dir, name);
    const file = existsSync(local) ? local : path.join(SRC, "shared", name);
    return include(readFileSync(file, "utf8").trimEnd(), dir);
  });
}

for (const id of readdirSync(SRC)) {
  const dir = path.join(SRC, id);
  const defFile = path.join(dir, "def.mjs");
  if (!existsSync(defFile)) continue;
  const { fx, demos } = (await import(defFile)).default;
  const out = path.join(OUT, id);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "fx.json"), `${JSON.stringify(fx, null, 2)}\n`);
  for (const file of readdirSync(dir).filter((n) => n.endsWith(".src.frag"))) {
    writeFileSync(path.join(out, file.replace(".src.frag", ".frag")), include(readFileSync(path.join(dir, file), "utf8"), dir));
  }
  for (const [preset, score] of Object.entries(demos)) {
    writeFileSync(path.join(out, `demo-${preset}.json`), `${JSON.stringify({ version: 1, template: id, preset, ...score, out: `${id}-${preset}` })}\n`);
  }
}
