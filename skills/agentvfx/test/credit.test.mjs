// Attribution is a licence condition for published output, so every render carries the credit line: CREDIT.txt next
// to the film, the MP4 description tag of every film written (the safe variant too), and the gate report the agent
// reads before reporting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore } from "../engine/core/validate.mjs";
import { runJob } from "../engine/node/job.mjs";
import { CREDIT_TEXT } from "../engine/core/mark.mjs";

const lib = loadLibrary({ includeTest: true });
const description = (file) => spawnSync("ffprobe", ["-v", "error", "-show_entries", "format_tags=description", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" }).stdout.trim();

test("the credit line names agentvfx, the author and the repository", () => {
  assert.match(CREDIT_TEXT, /agentvfx/);
  assert.match(CREDIT_TEXT, /Woojin Go/);
  assert.match(CREDIT_TEXT, /github\.com\/wjgoarxiv\/agentvfx/);
});

test("every render writes CREDIT.txt, tags each film with the credit and reports it in the gate", async () => {
  const v = validateScore({ version: 1, template: "test-strobe", durationSec: 3, seed: 1, out: "t", safety: { mode: "stage", safeVariant: true } }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-credit-"));
  try {
    const gate = await runJob(v.value, lib, { outDir: dir, width: 320, height: 180, replay: false });
    const credit = path.join(dir, "CREDIT.txt");
    assert.ok(existsSync(credit), "CREDIT.txt next to the film");
    assert.ok(readFileSync(credit, "utf8").includes(CREDIT_TEXT));
    assert.equal(description(path.join(dir, "film.mp4")), CREDIT_TEXT);
    const safe = gate.safeVariant?.withheld ?? gate.safeVariant?.film;
    assert.ok(safe && existsSync(safe), "a safe variant was written");
    assert.equal(description(safe), CREDIT_TEXT);
    assert.equal(gate.credit?.text, CREDIT_TEXT);
    assert.equal(gate.credit?.file, credit);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
