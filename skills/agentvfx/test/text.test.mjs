import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadLibrary } from "../engine/core/templates.mjs";
import { validateScore, validateTemplate } from "../engine/core/validate.mjs";
import { renderScore } from "../engine/node/render.mjs";
import { FONT_STACKS, drawTextLayer, fontStack, revealText } from "../engine/web/text.mjs";

const lib = loadLibrary({ includeTest: true });
const W = 640;
const H = 360;

async function frames(labels, want, extra = {}) {
  const v = validateScore({ version: 1, template: "test-text-probe", durationSec: 3, seed: 4, out: "t", ...(labels ? { labels } : {}), ...extra }, lib);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const dir = mkdtempSync(path.join(tmpdir(), "agentvfx-text-"));
  const kept = new Map();
  try {
    const report = await renderScore(v.value, lib, { outDir: dir, width: W, height: H, replay: true, onFrame: (f, a) => { if (want.includes(f)) kept.set(f, Buffer.from(a.rgba)); } });
    return { report, kept };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const ink = (rgba, x0, y0, x1, y1) => {
  let n = 0;
  for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y++) for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x++) if (rgba[(y * W + x) * 4] > 200) n++;
  return n;
};

test("text items draw ink in their boxes, decode settles over time, replay is deterministic", async () => {
  const { report, kept } = await frames(null, [0, 89]);
  assert.equal(report.determinism.pass, true);
  const last = kept.get(89);
  assert.ok(ink(last, 0.03, 0.03, 0.6, 0.32) > 300, "outlined title + tab box");
  assert.ok(ink(last, 0.03, 0.58, 0.9, 0.7) > 150, "decoded code line");
  assert.ok(ink(kept.get(0), 0.03, 0.58, 0.9, 0.7) < 5, "code line hidden before revealStart");
});

test("labels override defaults and unknown labels are rejected", async () => {
  const bad = validateScore({ version: 1, template: "test-text-probe", durationSec: 3, seed: 4, labels: { nope: "x" } }, lib);
  assert.ok(bad.errors.some((e) => e.path === "labels.nope"));
  const a = await frames({ title: "A" }, [60]);
  const b = await frames({ title: "WWWWWWWWW" }, [60]);
  assert.ok(ink(b.kept.get(60), 0.03, 0.03, 0.9, 0.32) > ink(a.kept.get(60), 0.03, 0.03, 0.9, 0.32), "longer title -> more ink");
});

test("textStyle overrides font, size and position of a template text item; bad input is rejected", async () => {
  const bad = (textStyle) => validateScore({ version: 1, template: "test-text-probe", durationSec: 3, seed: 4, textStyle }, lib).errors.map((e) => e.path);
  assert.ok(bad({ nope: { size: 0.1 } }).includes("textStyle.nope"));
  assert.ok(bad({ title: { font: "comic" } }).includes("textStyle.title.font"));
  assert.ok(bad({ title: { size: 5 } }).includes("textStyle.title.size"));
  assert.ok(bad({ title: { weight: 5000 } }).includes("textStyle.title.weight"));
  assert.ok(bad({ title: { colour: "red" } }).includes("textStyle.title.colour"));
  assert.ok(bad("x").includes("textStyle"));
  const base = await frames(null, [60]);
  const small = await frames(null, [60], { textStyle: { title: { size: 0.04, y: 0.45 } } });
  const region = (r) => ink(r.kept.get(60), 0.03, 0.03, 0.9, 0.32);
  assert.ok(region(small) < region(base) / 3, "smaller + moved title leaves its default box");
  assert.ok(ink(small.kept.get(60), 0.03, 0.44, 0.5, 0.5) > 20, "title now drawn at the new y");
  const serif = await frames(null, [60], { textStyle: { title: { font: "serif" } } });
  assert.notEqual(region(serif), region(base), "a different font changes the glyph ink");
});

const probe = (channel) => ({
  DESCRIPTION: "fixture", CATEGORIES: ["test"], ISFVSN: "2",
  INPUTS: [{ NAME: "speed", TYPE: "float", MIN: 0, MAX: 4, DEFAULT: 1 }],
  X_AGENTVFX: {
    id: "fixture", family: "test", input: "generative", spdx: "MIT", flash: "none",
    presets: { a: { speed: 1 }, b: { speed: 2 }, c: { speed: 3 } },
    text: [{ key: "w", default: "A", x: 0.1, y: 0.1, size: 0.2, ...(channel === undefined ? {} : { channel }) }],
  },
});

test("text item channel: r, g, b are accepted, anything else is rejected naming the item", () => {
  for (const c of [undefined, "r", "g", "b"]) assert.deepEqual(validateTemplate(probe(c), "fixture").errors, [], String(c));
  assert.ok(validateTemplate(probe("a"), "fixture").errors.some((e) => e.path === "X_AGENTVFX.text[0].channel"));
  assert.ok(validateTemplate(probe(3), "fixture").errors.some((e) => e.path === "X_AGENTVFX.text[0].channel"));
});

test("drawTextLayer paints glyph ink into the item's channel (r default, g, b) and an outline in the same channel", () => {
  const painted = [];
  const ctx = {
    setTransform() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, stroke() {},
    measureText: () => ({ width: 40 }),
    fillText() { painted.push(`fill ${this.fillStyle}`); },
    strokeText() { painted.push(`stroke ${this.strokeStyle}`); },
  };
  const item = (key, extra) => ({ key, default: "A", x: 0.1, y: 0.1, size: 0.2, font: "grotesk", ...extra });
  drawTextLayer(ctx, 640, 360, [item("a"), item("b", { channel: "g" }), item("c", { channel: "b" }), item("d", { channel: "b", style: "outline" })], null, 0, 0, 1);
  assert.deepEqual(painted, ["fill rgb(255,0,0)", "fill rgb(0,255,0)", "fill rgb(0,0,255)", "stroke rgb(0,0,255)"]);
});

test("text item family: valid installed names are accepted, injection-shaped or empty names are rejected (template item and textStyle)", () => {
  const withFamily = (family) => ({ ...probe(), X_AGENTVFX: { ...probe().X_AGENTVFX, text: [{ key: "w", default: "A", x: 0.1, y: 0.1, size: 0.2, family }] } });
  for (const ok of ["Monument Extended", "Pretendard", "MesloLGS NF", "Noto Sans KR", "Avenir-Next_2.0", "빛 고딕"]) assert.deepEqual(validateTemplate(withFamily(ok), "fixture").errors, [], ok);
  for (const bad of ['a"b', "x; y", "", "a".repeat(65), "{}", 7]) assert.ok(validateTemplate(withFamily(bad), "fixture").errors.some((e) => e.path === "X_AGENTVFX.text[0].family"), String(bad));
  const style = (family) => validateScore({ version: 1, template: "test-text-probe", durationSec: 3, seed: 4, textStyle: { title: { family } } }, lib).errors.map((e) => e.path);
  assert.deepEqual(style("Pretendard"), []);
  assert.ok(style('Bad"Name').includes("textStyle.title.family"));
});

test("fontStack: the named family comes first, the generic stack of `font` stays behind it as the fallback, bad names are ignored", () => {
  const generic = fontStack({ font: "grotesk" });
  const named = fontStack({ font: "grotesk", family: "Monument Extended" });
  assert.equal(named.family, `"Monument Extended", ${generic.family}`);
  assert.equal(named.weight, generic.weight);
  assert.equal(fontStack({ font: "tall", family: "Pretendard" }).stretchY, FONT_STACKS.tall.stretchY, "font still decides the vertical stretch");
  assert.equal(fontStack({ font: "mono", family: 'x"; color: red' }).family, fontStack({ font: "mono" }).family, "an invalid name is dropped, not injected");
  assert.equal(fontStack({ font: "serif", family: undefined }).family, FONT_STACKS.serif.family);
});

test("drawTextLayer sets the canvas font with the named family in front of the generic fallback stack", () => {
  const fonts = [];
  const ctx = {
    setTransform() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {},
    measureText: () => ({ width: 40 }),
    fillText() { fonts.push(this.font); },
  };
  const item = (key, extra) => ({ key, default: "A", x: 0.1, y: 0.1, size: 0.2, font: "grotesk", ...extra });
  drawTextLayer(ctx, 640, 360, [item("a"), item("b", { family: "Monument Extended", weight: 800 })], null, 0, 0, 1);
  assert.ok(fonts[0].includes("Helvetica Neue") && !fonts[0].includes("Monument"), fonts[0]);
  assert.ok(fonts[1].startsWith("800 72px \"Monument Extended\", \"Helvetica Neue\""), fonts[1]);
});

test("a family that is not installed falls back to the generic font: the render is pixel-identical to the same item without a family", async () => {
  const plain = await frames(null, [60]);
  const absent = await frames(null, [60], { textStyle: { title: { family: "Zz Absent Face Qq" } } });
  assert.ok(plain.kept.get(60).equals(absent.kept.get(60)), "same frame");
  const real = await frames(null, [60], { textStyle: { title: { font: "grotesk", weight: 900 } } });
  assert.ok(!plain.kept.get(60).equals(real.kept.get(60)), "control: a real style change does move pixels");
});

test("revealText: type prints progressively, decode settles to the source text", () => {
  const spec = { reveal: "type", revealStart: 0, revealDur: 1 };
  assert.equal(revealText(spec, "ABCD", 0.5, 15, 1).startsWith("AB"), true);
  const d = { reveal: "decode", revealStart: 0, revealDur: 1 };
  assert.equal(revealText(d, "HELLO", 1.2, 36, 1), "HELLO");
  assert.notEqual(revealText(d, "HELLO", 0.1, 3, 1), "HELLO");
});
