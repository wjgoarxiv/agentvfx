import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VFX = fileURLToPath(new URL("../scripts/vfx.mjs", import.meta.url));
const run = (args, env = {}) => spawnSync(process.execPath, [VFX, ...args], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 90000 });

test("doctor passes on this host with a GPU WebGL2 context and float targets", () => {
  const r = run(["doctor"]);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const report = JSON.parse(r.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.webgl2, true);
  assert.match(report.renderer, /ANGLE/u);
  assert.match(report.renderer, /Metal/u);
  assert.equal(report.extensions.EXT_color_buffer_float, true);
  assert.equal(report.extensions.OES_texture_float_linear, true);
  assert.match(report.ffmpeg, /^ffmpeg version/u);
});

test("doctor fails with a named blocker when Chrome is missing", () => {
  const r = run(["doctor"], { CHROME_PATH: "/nonexistent" });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /BLOCKED_NO_CHROME/u);
});

test("unknown subcommand is a usage error", () => {
  const r = run(["nope"]);
  assert.equal(r.status, 2);
});
