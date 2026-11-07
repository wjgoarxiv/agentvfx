// agentvfx (agentvfx licence, see LICENSE). The template library: every templates/<family>/<id>/fx.json, keyed by
// X_AGENTVFX.id. Test templates live under templates/_test/ and are loaded only on request.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATES_ROOT = fileURLToPath(new URL("../../templates/", import.meta.url));

/** Map id -> { id, dir, rel, family, fx, passes: [file...] }. Throws on a duplicate id or unreadable JSON. */
export function loadLibrary({ root = TEMPLATES_ROOT, includeTest = false } = {}) {
  const lib = new Map();
  if (!existsSync(root)) return lib;
  for (const family of readdirSync(root).sort()) {
    const fdir = path.join(root, family);
    if (!statSync(fdir).isDirectory()) continue;
    if (family === "_test" && !includeTest) continue;
    if (family.startsWith(".") || (family.startsWith("_") && family !== "_test")) continue;
    for (const name of readdirSync(fdir).sort()) {
      const dir = path.join(fdir, name);
      const file = path.join(dir, "fx.json");
      if (!statSync(dir).isDirectory() || !existsSync(file)) continue;
      let fx;
      try {
        fx = JSON.parse(readFileSync(file, "utf8"));
      } catch (error) {
        throw new Error(`${path.relative(root, file)}: invalid JSON (${error.message})`);
      }
      const id = fx?.X_AGENTVFX?.id ?? name;
      if (lib.has(id)) throw new Error(`duplicate template id ${id} (${path.relative(root, lib.get(id).dir)} and ${path.relative(root, dir)})`);
      const passes = readdirSync(dir).filter((f) => /^(main|pass\d+)\.frag$/u.test(f)).sort();
      lib.set(id, { id, dir, rel: path.relative(root, dir).split(path.sep).join("/"), family, fx, passes });
    }
  }
  return lib;
}

/** Defaults from INPUTS, then the named preset, then explicit params. */
export function resolveParams(fx, { preset = null, params = {} } = {}) {
  const out = {};
  for (const input of fx.INPUTS ?? []) if (input.DEFAULT !== undefined) out[input.NAME] = input.DEFAULT;
  if (preset) Object.assign(out, fx.X_AGENTVFX.presets[preset]);
  return Object.assign(out, params);
}
