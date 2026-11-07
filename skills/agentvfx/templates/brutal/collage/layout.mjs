// agentvfx (agentvfx licence, see LICENSE). Collage layout as data: up to 16 cells on a 32 x 18 grid, validated here and packed
// into the template's integer inputs. Three ints per cell:
//   cellN  = role * 1e8 + x * 1e6 + y * 1e4 + w * 100 + h          (RRXXYYWWHH, plain decimal)
//   styleN = variant * 1e4 + tone * 1e3 + fill * 100 + frame * 10 + rot
//   srcN   = sheet * 1e6 + scale * 10 * 1e4 + (src.x + 10) * 2 * 100 + (src.y + 10) * 2     (text-sheet window; 0 = unused)
// A cell is { x, y, w, h, role } plus optional { frame, fill, tone, variant, rot, src: { x, y, scale, sheet } }.
// Role "typefx" is warped type (variant 1 micro-type field, 2 glyph window, 3 slit-scan word, 4 echo stack, 5 echo ripple, 6 type equalizer);
// `src.sheet` picks which text-sheet channel a type or typefx cell reads: "r" (default, the editorial sheet), "g" or "b".
// Role "scene" is a whole mixed-material composition (variant 1 specimen, 2 wiring, 3 field-cut, 4 pattern-sheet) that fills its cell;
// it reads its own text set (the template input textSet) and the tint colours.
// Cells are drawn in list order, later on top, and may overlap unless both are frame "tile" (the old boxed panel).
export const GRID = Object.freeze({ cols: 32, rows: 18 });
export const MAX_CELLS = 16;
export const ROLES = Object.freeze({ footage: 1, spectrum: 2, scope: 3, meter: 4, readout: 5, crosshair: 6, ruler: 7, plate: 8, hatch: 9, pixels: 10, type: 11, rule: 12, typefx: 13, scene: 14 });
export const SHEETS = Object.freeze({ r: 0, g: 1, b: 2 });
export const FRAMES = Object.freeze({ tile: 0, none: 1, hairline: 2, corners: 3 });
export const FILLS = Object.freeze({ none: 0, ground: 1, ink: 2, accent: 3 });
export const TONES = Object.freeze({ ink: 0, ground: 1, accent: 2 });
export const ROTS = Object.freeze([0, 1, 2]);
const CELL_KEYS = Object.freeze(["x", "y", "w", "h", "role", "frame", "fill", "tone", "variant", "rot", "src"]);
const SRC_KEYS = Object.freeze(["x", "y", "scale", "sheet"]);
const isInt = (v) => Number.isInteger(v);
const isHalf = (v) => Number.isFinite(v) && Number.isInteger(v * 2);

/** A layouts.json entry is either a bare cell list (old form) or { cells, params?, description? }. */
export const layoutCells = (entry) => (Array.isArray(entry) ? entry : entry?.cells);

/** Returns a list of { path, message } errors; an empty list means the layout is valid. */
export function checkLayout(entry) {
  const cells = layoutCells(entry);
  const errors = [];
  const err = (path, message) => errors.push({ path, message });
  if (!Array.isArray(cells) || cells.length < 1 || cells.length > MAX_CELLS) {
    err("", `layout must be a list of 1 to ${MAX_CELLS} cells`);
    return errors;
  }
  const ok = [];
  cells.forEach((c, i) => {
    const p = `[${i}]`;
    if (c === null || typeof c !== "object" || Array.isArray(c)) return err(p, "must be an object { x, y, w, h, role }");
    for (const k of Object.keys(c)) if (!CELL_KEYS.includes(k)) err(`${p}.${k}`, `unknown key (allowed: ${CELL_KEYS.join(", ")})`);
    if (!Object.hasOwn(ROLES, c.role)) err(`${p}.role`, `must be one of ${Object.keys(ROLES).join(", ")}`);
    if (c.frame !== undefined && !Object.hasOwn(FRAMES, c.frame)) err(`${p}.frame`, `must be one of ${Object.keys(FRAMES).join(", ")}`);
    if (c.fill !== undefined && !Object.hasOwn(FILLS, c.fill)) err(`${p}.fill`, `must be one of ${Object.keys(FILLS).join(", ")}`);
    if (c.tone !== undefined && !Object.hasOwn(TONES, c.tone)) err(`${p}.tone`, `must be one of ${Object.keys(TONES).join(", ")}`);
    if (c.variant !== undefined && !(isInt(c.variant) && c.variant >= 0 && c.variant <= 9)) err(`${p}.variant`, "must be an integer 0..9");
    if (c.rot !== undefined && !ROTS.includes(c.rot)) err(`${p}.rot`, "must be 0, 1 (text reads upward) or 2 (text reads downward)");
    if (c.src !== undefined) checkSrc(c.src, `${p}.src`, err);
    const dims = CELL_KEYS.slice(0, 4);
    for (const k of dims) if (!isInt(c[k])) err(`${p}.${k}`, "must be an integer grid unit");
    if (!dims.every((k) => isInt(c[k]))) return;
    if (c.x < 0 || c.y < 0) err(p, "x and y must be >= 0");
    if (c.w < 1 || c.h < 1) err(p, "w and h must be >= 1");
    if (c.x + c.w > GRID.cols) err(p, `out of bounds: x + w = ${c.x + c.w} > ${GRID.cols}`);
    if (c.y + c.h > GRID.rows) err(p, `out of bounds: y + h = ${c.y + c.h} > ${GRID.rows}`);
    ok.push([i, c]);
  });
  const tile = (c) => (c.frame ?? "tile") === "tile";
  for (let a = 0; a < ok.length; a++) {
    for (let b = a + 1; b < ok.length; b++) {
      const [i, p] = ok[a];
      const [j, q] = ok[b];
      if (tile(p) && tile(q) && p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) err(`[${j}]`, `overlaps cell [${i}] (only cells with frame none, hairline or corners may overlap)`);
    }
  }
  return errors;
}

function checkSrc(s, path, err) {
  if (s === null || typeof s !== "object" || Array.isArray(s)) return err(path, "must be an object { x, y, scale, sheet }");
  if (s.sheet !== undefined && !Object.hasOwn(SHEETS, s.sheet)) err(`${path}.sheet`, `must be one of ${Object.keys(SHEETS).join(", ")}`);
  for (const k of Object.keys(s)) if (!SRC_KEYS.includes(k)) err(`${path}.${k}`, `unknown key (allowed: ${SRC_KEYS.join(", ")})`);
  for (const k of ["x", "y"]) if (s[k] !== undefined && !(isHalf(s[k]) && s[k] >= -10 && s[k] <= 39.5)) err(`${path}.${k}`, "must be a multiple of 0.5 between -10 and 39.5 (grid units of the text sheet)");
  if (s.scale !== undefined && !(Number.isFinite(s.scale) && Number.isInteger(Math.round(s.scale * 10)) && Math.abs(s.scale * 10 - Math.round(s.scale * 10)) < 1e-9 && s.scale >= 0.1 && s.scale <= 9.9)) err(`${path}.scale`, "must be 0.1 steps between 0.1 and 9.9");
}

/** One cell -> the packed decimal integer (0 stays 0 = empty slot). */
export const packCell = (c) => ROLES[c.role] * 100000000 + c.x * 1000000 + c.y * 10000 + c.w * 100 + c.h;
export const packStyle = (c) => (c.variant ?? 0) * 10000 + TONES[c.tone ?? "ink"] * 1000 + FILLS[c.fill ?? "none"] * 100 + FRAMES[c.frame ?? "tile"] * 10 + (c.rot ?? 0);
export const packSrc = (c) => {
  if (c.src === undefined && c.role !== "type" && c.role !== "typefx") return 0;
  const s = { x: 0, y: 0, scale: 1, sheet: "r", ...c.src };
  return SHEETS[s.sheet] * 1000000 + Math.round(s.scale * 10) * 10000 + Math.round((s.x + 10) * 2) * 100 + Math.round((s.y + 10) * 2);
};

/** A valid layout -> { cell0.., style0.., src0.. } score params (unused slots are 0). Throws on an invalid layout. */
export function layoutToParams(entry) {
  const errors = checkLayout(entry);
  if (errors.length) throw new Error(`invalid collage layout: ${errors.map((e) => `${e.path} ${e.message}`).join("; ")}`);
  const cells = layoutCells(entry);
  const slots = Array.from({ length: MAX_CELLS }, (_, k) => cells[k]);
  return {
    ...Object.fromEntries(slots.map((c, k) => [`cell${k}`, c ? packCell(c) : 0])),
    ...Object.fromEntries(slots.map((c, k) => [`style${k}`, c ? packStyle(c) : 0])),
    ...Object.fromEntries(slots.map((c, k) => [`src${k}`, c ? packSrc(c) : 0])),
  };
}
