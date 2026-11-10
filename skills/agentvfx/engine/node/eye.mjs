// agentvfx (Apache-2.0, see LICENSE). The eye: every render leaves stills the model must open before reporting.
// stills/sheet.png (12 evenly spaced frames, 4x3), stills/strip-<k>.png (7 consecutive frames centred
// on each hit, cut or onset, or on 25/50/75 % when there are none; at most 6 strips) and
// stills/poster.png (full size, 40 % in). Frames are downscaled as they arrive, so memory stays small.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { areaDownscale } from "./analysis.mjs";
import { encodePng, rgbaToRgb } from "./png.mjs";

const GAP = 8;
const BG = [18, 18, 18];
const MAX_STRIPS = 6;

/** Which frames the eye needs: { sheet: [f], strips: [{ centre, frames: [f] }], poster: f }. */
export function eyePlan(frameCount, events = []) {
  const sheet = [...new Set(Array.from({ length: 12 }, (_, i) => Math.round((i * (frameCount - 1)) / 11)))];
  const centres = (events.length ? events : [0.25, 0.5, 0.75].map((p) => Math.round(p * (frameCount - 1)))).slice(0, MAX_STRIPS);
  const strips = centres.map((c) => ({ centre: c, frames: Array.from({ length: 7 }, (_, i) => Math.min(frameCount - 1, Math.max(0, c - 3 + i))) }));
  return { sheet, strips, poster: Math.round(0.4 * (frameCount - 1)) };
}

function compose(thumbs, cols, tw, th) {
  const rows = Math.ceil(thumbs.length / cols);
  const W = cols * tw + (cols + 1) * GAP;
  const H = rows * th + (rows + 1) * GAP;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) out.set([...BG, 255], i * 4);
  thumbs.forEach((t, i) => {
    const ox = GAP + (i % cols) * (tw + GAP);
    const oy = GAP + Math.floor(i / cols) * (th + GAP);
    for (let y = 0; y < th; y++) t.copy(out, ((oy + y) * W + ox) * 4, y * tw * 4, (y + 1) * tw * 4);
  });
  return { rgba: out, width: W, height: H };
}

const png = (img) => encodePng(rgbaToRgb(img.rgba, img.width, img.height), img.width, img.height, 3, { level: 6 });

/** Collects the frames it needs during the render; write(outDir) saves the PNGs and returns their paths. */
export function createEye({ width, height, frameCount, events }) {
  const plan = eyePlan(frameCount, events);
  const sheetW = 480;
  const sheetH = Math.max(2, Math.round((sheetW * height) / width));
  const stripW = 320;
  const stripH = Math.max(2, Math.round((stripW * height) / width));
  const sheetSet = new Set(plan.sheet);
  const stripSet = new Set(plan.strips.flatMap((s) => s.frames));
  const sheetThumbs = new Map();
  const stripThumbs = new Map();
  let poster = null;
  return {
    plan,
    wants: (f) => sheetSet.has(f) || stripSet.has(f) || f === plan.poster,
    push(f, rgba) {
      if (sheetSet.has(f)) sheetThumbs.set(f, areaDownscale(rgba, width, height, sheetW, sheetH));
      if (stripSet.has(f)) stripThumbs.set(f, areaDownscale(rgba, width, height, stripW, stripH));
      if (f === plan.poster) poster = Buffer.from(rgba);
    },
    write(outDir) {
      const dir = path.join(outDir, "stills");
      mkdirSync(dir, { recursive: true });
      const files = {};
      const sheet = compose(plan.sheet.map((f) => sheetThumbs.get(f)), 4, sheetW, sheetH);
      files.sheet = path.join(dir, "sheet.png");
      writeFileSync(files.sheet, png(sheet));
      files.strips = plan.strips.map((s, k) => {
        const file = path.join(dir, `strip-${k}.png`);
        writeFileSync(file, png(compose(s.frames.map((f) => stripThumbs.get(f)), 7, stripW, stripH)));
        return { file, centre: s.centre, frames: s.frames };
      });
      if (poster) {
        files.poster = path.join(dir, "poster.png");
        writeFileSync(files.poster, png({ rgba: poster, width, height }));
      }
      return files;
    },
  };
}
