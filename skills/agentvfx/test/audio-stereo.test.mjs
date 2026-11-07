import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { analyzeAudio } from "../engine/node/audio.mjs";
import { seedToUnit } from "../engine/web/prelude.mjs";

test("waveL and waveR carry the two channels (L = 440 Hz sine, R = silence)", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-stereo-"));
  try {
    const wav = path.join(dir, "lr.wav");
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-filter_complex", "[0:a][1:a]join=inputs=2:channel_layout=stereo[a]", "-map", "[a]", "-t", "2", wav], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const f = await analyzeAudio(wav, { fps: 30 });
    const fr = f.frames[20];
    const p2p = (a) => Math.max(...a) - Math.min(...a);
    // ffmpeg's sine source has amplitude 1/8, so peak-to-peak is 0.25.
    assert.ok(p2p(fr.waveL) > 0.2, `left p2p ${p2p(fr.waveL)}`);
    assert.ok(p2p(fr.waveR) < 0.01, `right p2p ${p2p(fr.waveR)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no band is dead: a 40 Hz sine lights band 1", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-band-"));
  try {
    const wav = path.join(dir, "b.wav");
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=40:sample_rate=48000:duration=2", "-ac", "2", wav], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const f = await analyzeAudio(wav, { fps: 30 });
    assert.ok(f.frames[30].bands[1] > 0.3, `band 1 = ${f.frames[30].bands[1]}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seedToUnit spreads small integer seeds", () => {
  const v = [1, 2, 3, 7, 31].map(seedToUnit);
  for (const x of v) assert.ok(x >= 0 && x < 1);
  const spread = Math.max(...v) - Math.min(...v);
  assert.ok(spread > 0.3, `spread ${spread}`);
});
