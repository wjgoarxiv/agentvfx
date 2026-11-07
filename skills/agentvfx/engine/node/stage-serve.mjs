// agentvfx (agentvfx licence, see LICENSE). Adapted from lit-typographic-motion 1.0.45 engine/node/stage-serve.mjs.
// Serving without a listening socket: every request the render page makes is paused by CDP Fetch
// interception and either fulfilled from disk on the synthetic origin http://lit.stage, or failed
// with BlockedByClient and recorded. Routes: /lit/engine/* (engine/web), /lit/templates/* (the
// template library) and everything else from the stage dir. Real paths must stay inside their root.
import { realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STAGE_ORIGIN = "http://lit.stage";
export const WEB_DIR = fileURLToPath(new URL("../web/", import.meta.url));
export const TEMPLATES_DIR = fileURLToPath(new URL("../../templates/", import.meta.url));
export const INIT_FILE = fileURLToPath(new URL("../web/init.js", import.meta.url));

export const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".json": "application/json", ".frag": "text/plain; charset=utf-8", ".vert": "text/plain; charset=utf-8",
  ".glsl": "text/plain; charset=utf-8",
});

const inside = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);

function resolveUnder(rootDir, rel) {
  if (rel.includes("\\") || rel.split("/").includes("..")) return { reason: "path traversal" };
  let root;
  let real;
  try {
    root = realpathSync(rootDir);
    real = realpathSync(path.join(rootDir, rel));
  } catch {
    return { reason: "not found" };
  }
  if (!inside(root, real)) return { reason: "resolves outside its root" };
  const type = CONTENT_TYPES[path.extname(real).toLowerCase()];
  if (!type || !statSync(real).isFile()) return { reason: "not a servable file" };
  return { file: real, type };
}

/**
 * The request router for one render run. Returns { kind: "file", file, type } | { kind: "blocked" } |
 * { kind: "missing" }, and records every refusal and miss.
 */
export function stageRouter({ stageDir, webDir = WEB_DIR, templatesDir = TEMPLATES_DIR }) {
  const refused = [];
  const missing = [];
  const route = (url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      refused.push({ url, reason: "unparsable URL" });
      return { kind: "blocked" };
    }
    if (parsed.origin !== STAGE_ORIGIN) {
      refused.push({ url, reason: "outside the stage origin" });
      return { kind: "blocked" };
    }
    const pathname = decodeURIComponent(parsed.pathname);
    if (pathname === "/favicon.ico") return { kind: "missing" };
    let hit;
    if (pathname.startsWith("/lit/engine/")) hit = resolveUnder(webDir, pathname.slice("/lit/engine/".length));
    else if (pathname.startsWith("/lit/templates/")) hit = resolveUnder(templatesDir, pathname.slice("/lit/templates/".length));
    else hit = resolveUnder(stageDir, pathname === "/" ? "index.html" : pathname.replace(/^\/+/u, ""));
    if (!hit.file) {
      missing.push({ url, reason: hit.reason });
      return { kind: "missing" };
    }
    return { kind: "file", file: hit.file, type: hit.type };
  };
  return { route, refused, missing };
}
