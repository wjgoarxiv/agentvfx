// agentvfx (Apache-2.0, see LICENSE). Engine text layer, drawn in the render page with Canvas 2D and system fonts
// (nothing bundled). Output is a mask: R = glyph and line ink, G = solid box/bar fill. Templates colour
// it. Reveal modes are frame-deterministic: "type" prints characters over time with a block cursor,
// "decode" settles each character out of seeded random glyphs.

export const FONT_STACKS = Object.freeze({
  display: { family: '"DIN Condensed", "Avenir Next Condensed", "Arial Narrow", sans-serif', weight: 700, stretchY: 1.0 },
  tall: { family: '"Avenir Next Condensed", "Helvetica Neue", "Arial Narrow", sans-serif', weight: 300, stretchY: 1.75 },
  grotesk: { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weight: 800, stretchY: 1.0 },
  mono: { family: 'Menlo, "SF Mono", Monaco, "Courier New", monospace', weight: 400, stretchY: 1.0 },
  serif: { family: '"Times New Roman", Times, serif', weight: 400, stretchY: 1.0 },
});

const SCRAMBLE = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/\\";
const INK = "rgb(255,0,0)";
const FILL = "rgb(0,255,0)";
/** Glyph ink colour per item `channel`: r (default) is the shared sheet, g and b are extra independent sheets. */
export const CHANNEL_INK = Object.freeze({ r: INK, g: FILL, b: "rgb(0,0,255)" });

function hash(a, b, c) {
  let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  return x >>> 0;
}

/** The visible string for one item at time t (seconds). */
export function revealText(spec, text, t, frame, seedInt) {
  const start = spec.revealStart ?? 0;
  const dur = Math.max(1e-3, spec.revealDur ?? 1);
  const p = Math.min(1, Math.max(0, (t - start) / dur));
  if (spec.reveal === "type") {
    if (t < start) return "";
    const n = Math.floor(p * text.length);
    const blink = Math.floor(t * 4) % 2 === 0;
    return text.slice(0, n) + (p < 1 || blink ? "█" : "");
  }
  if (spec.reveal === "decode") {
    if (t < start) return "";
    const tick = Math.floor(frame / 2);
    return [...text].map((ch, i) => {
      if (ch === " " || ch === "\n") return ch;
      const settle = (i + 1) / text.length;
      return p >= settle ? ch : SCRAMBLE[hash(i, tick, seedInt) % SCRAMBLE.length];
    }).join("");
  }
  return text;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Installed font family names an item may name: letters (any script), digits, spaces, dots, hyphens, underscores. */
export const FAMILY_PATTERN = /^[\p{L}\p{N} ._-]{1,64}$/u;

/**
 * The CSS font stack of one item: its generic `font` stack, with an installed `family` (referenced by name only, nothing is
 * bundled) put in front so an absent family falls through to the generic stack.
 */
export function fontStack(spec) {
  const base = FONT_STACKS[spec.font ?? "display"];
  const family = typeof spec.family === "string" && FAMILY_PATTERN.test(spec.family) ? `"${spec.family}", ` : "";
  return { ...base, family: `${family}${base.family}` };
}

/** Draw every text item of a layer into ctx (cleared first). */
export function drawTextLayer(ctx, W, H, specs, labels, t, frame, seedInt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  ctx.textBaseline = "alphabetic";
  for (const spec of specs) {
    const raw = labels?.[spec.key] ?? spec.default;
    const text = revealText(spec, raw, t, frame, seedInt);
    const font = fontStack(spec);
    const px = Math.max(4, spec.size * H);
    const sy = font.stretchY;
    ctx.font = `${spec.weight ?? font.weight} ${px}px ${font.family}`;
    ctx.letterSpacing = `${(spec.tracking ?? 0) * px}px`;
    const lines = text.split("\n");
    const lh = px * sy * (spec.lineHeight ?? 1.15);
    const widths = lines.map((l) => ctx.measureText(l).width);
    const maxW = Math.max(1, ...widths, spec.box && spec.box !== "none" ? ctx.measureText(raw.split("\n")[0]).width : 0);
    const align = spec.align ?? "left";
    const x0 = spec.x * W;
    const yTop = spec.y * H;
    const left = align === "left" ? x0 : align === "center" ? x0 - maxW / 2 : x0 - maxW;
    const blockH = lh * lines.length;
    const ink = CHANNEL_INK[spec.channel ?? "r"];
    const pad = px * 0.28;
    const stroke = Math.max(1.5, px * 0.035);
    if (spec.box === "bar") {
      ctx.fillStyle = FILL;
      ctx.fillRect(left - pad, yTop - pad * 0.6, maxW + 2 * pad, blockH + pad * 0.8);
    } else if (spec.box === "frame") {
      ctx.strokeStyle = INK;
      ctx.lineWidth = stroke;
      roundRect(ctx, left - pad, yTop - pad * 0.6, maxW + 2 * pad, blockH + pad * 0.8, pad * 0.6);
      ctx.stroke();
    } else if (spec.box === "tab") {
      // index card: square box with the top-right corner cut at 45 degrees and a solid spine on the left edge
      const bx = left - pad;
      const by = yTop - pad * 0.6;
      const bw = maxW + 2 * pad;
      const bh = blockH + pad * 0.8;
      const cut = Math.min(bh * 0.42, px * 0.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw - cut, by);
      ctx.lineTo(bx + bw, by + cut);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(bx - stroke * 0.5, by, Math.max(stroke * 2.5, px * 0.09), bh);
    }
    lines.forEach((line, i) => {
      const w = widths[i];
      const lx = align === "left" ? left : align === "center" ? x0 - w / 2 : x0 - w;
      const baseline = yTop + lh * i + px * sy * 0.82;
      ctx.save();
      ctx.translate(lx, baseline);
      ctx.scale(1, sy);
      if (spec.style === "outline") {
        ctx.strokeStyle = ink;
        ctx.lineWidth = stroke / sy;
        ctx.strokeText(line, 0, 0);
      } else {
        ctx.fillStyle = ink;
        ctx.fillText(line, 0, 0);
      }
      ctx.restore();
    });
  }
}

/** Make sure the system faces (the generic stacks and every item's named family) are resolved before the first frame (no fallback race). */
export async function warmFonts(specs, H) {
  if (!document.fonts?.load) return;
  const stacks = [...Object.values(FONT_STACKS), ...specs.filter((s) => s.family).map(fontStack)];
  const loads = specs.flatMap((s) => stacks.map((f) => (
    document.fonts.load(`${s.weight ?? f.weight} ${Math.max(4, s.size * H)}px ${f.family}`, s.default || "A").catch(() => null)
  )));
  await Promise.all(loads);
}
