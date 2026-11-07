import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL = fileURLToPath(new URL("..", import.meta.url));
const ENGINE = path.join(SKILL, "engine");

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".mjs") ? [p] : [];
});
const files = walk(ENGINE);

test("every relative import in the engine stays inside skill/agentvfx", () => {
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/gu)) {
      const target = path.resolve(path.dirname(f), m[1]);
      assert.ok(target.startsWith(SKILL), `${path.relative(SKILL, f)} imports ${m[1]} outside the skill`);
    }
  }
});

// Browser entry modules touch the DOM at load; for them only check that every relative import exists.
const isBrowserEntry = (f) => /\bdocument\.getElementById\b/u.test(readFileSync(f, "utf8"));

for (const f of files) {
  test(`imports ${path.relative(SKILL, f)}`, async () => {
    if (!isBrowserEntry(f)) {
      await import(pathToFileURL(f).href);
      return;
    }
    for (const m of readFileSync(f, "utf8").matchAll(/from\s*["'](\.{1,2}\/[^"']+)["']/gu)) {
      assert.ok(existsSync(path.resolve(path.dirname(f), m[1])), `${path.relative(SKILL, f)} imports missing ${m[1]}`);
    }
  });
}
