import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findFfmpeg, startMaster } from "../engine/node/encode.mjs";

test("a master encode whose ffmpeg dies rejects the next write instead of hanging", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-enc-"));
  try {
    // Odd width makes libx264 (yuv420p) fail at once.
    const m = startMaster({ ffmpeg: findFfmpeg(), width: 321, height: 181, fps: 30, out: path.join(dir, "x.mp4") });
    const frame = Buffer.alloc(321 * 181 * 4);
    await assert.rejects(async () => {
      for (let i = 0; i < 400; i++) await m.write(frame);
    }, /ffmpeg exited/u);
    const r = await m.finish();
    assert.notEqual(r.code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
