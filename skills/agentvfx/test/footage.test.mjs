import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { runJob } from "../engine/node/job.mjs";

const lib = loadLibrary({ includeTest: true });
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};
const probe = (file, sel) => JSON.parse(spawnSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", sel, "-of", "json", file], { encoding: "utf8" }).stdout);
const score = (video, extra = {}) => {
  const r = validateScore({ version: 1, template: "test-identity", input: { video }, durationSec: 3, seed: 1, out: "f", ...extra }, lib);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  return r.value;
};

test("a 29.97 fps clip renders exactly durationSec*fps frames, with audio within 50 ms of the video", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-foot-"));
  try {
    const clip = path.join(dir, "src.mp4");
    ff(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30000/1001", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clip]);
    const out = path.join(dir, "out");
    await runJob(score(clip), lib, { outDir: out, width: 320, height: 180, replay: false });
    const film = path.join(out, "film.mp4");
    const v = probe(film, "stream=codec_type,nb_read_frames,duration");
    const vs = v.streams.find((s) => s.codec_type === "video");
    const as = v.streams.find((s) => s.codec_type === "audio");
    assert.equal(Number(vs.nb_read_frames), 90);
    assert.ok(as, "has an audio stream");
    assert.ok(Math.abs(Number(as.duration) - Number(vs.duration)) <= 0.05, `audio ${as.duration} vs video ${vs.duration}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("colour bars through identity keep each bar's mean RGB within 4/255", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-foot-"));
  try {
    const clip = path.join(dir, "bars.mp4");
    ff(["-f", "lavfi", "-i", "smptehdbars=size=1280x720:rate=30", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "4", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", clip]);
    const out = path.join(dir, "out");
    await runJob(score(clip), lib, { outDir: out, width: 640, height: 360, replay: false });
    const grab = (file) => {
      const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-frames:v", "1", "-vf", "scale=640:360:flags=area:in_color_matrix=bt709,format=rgb24", "-f", "rawvideo", "pipe:1"], { maxBuffer: 1 << 28 });
      return r.stdout;
    };
    const a = grab(clip);
    const b = grab(path.join(out, "film.mp4"));
    // Top band: seven bars across the width; sample the centre of each bar at 1/3 height.
    for (let i = 0; i < 7; i++) {
      const x0 = Math.round(((i + 0.3) / 7) * 640 * 0.75);
      const x1 = Math.round(((i + 0.7) / 7) * 640 * 0.75);
      const mean = (buf) => {
        const s = [0, 0, 0];
        let n = 0;
        for (let y = 100; y < 140; y++) for (let x = x0; x < x1; x++) { const o = (y * 640 + x) * 3; s[0] += buf[o]; s[1] += buf[o + 1]; s[2] += buf[o + 2]; n++; }
        return s.map((v) => v / n);
      };
      const ma = mean(a);
      const mb = mean(b);
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(ma[c] - mb[c]) <= 4, `bar ${i} ch ${c}: ${ma[c].toFixed(1)} vs ${mb[c].toFixed(1)}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing video is a named error on input.video", async () => {
  await assert.rejects(runJob(score("nope/missing.mp4"), lib, { outDir: mkdtempSync(path.join(tmpdir(), "agentvfx-foot-")), width: 320, height: 180, replay: false }), /input\.video/u);
});

test("test media is present with a licence for every file", () => {
  const sources = readFileSync(path.join(ROOT, "test-media/SOURCES.md"), "utf8");
  assert.ok(existsSync(path.join(ROOT, "test-media/beat-132.mp3")), "beat-132.mp3");
  for (const f of ["clip-01.mp4", "clip-02.mp4"]) {
    assert.ok(existsSync(path.join(ROOT, "test-media", f)), f);
    const section = sources.split(`## ${f}`)[1] ?? "";
    assert.match(section.split("\n## ")[0], /Licence: /u, `licence for ${f}`);
  }
});
