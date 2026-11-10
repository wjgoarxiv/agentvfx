// agentvfx (Apache-2.0, see LICENSE). Shared palettes, usable by any template that declares a `palette` input.
// Each palette is a list of sRGB hex stops; templates sample it as a ramp (index 0..1) or as a cyclic
// ramp. Brutal palettes are black, white and one acid accent, in the spirit of festival HUD
// colour grammar; the names are neutral and no existing colour system is copied.

export const PALETTES = Object.freeze({
  "brutal-acid": ["#000000", "#ffffff", "#c8ff00"],
  "brutal-red": ["#000000", "#ffffff", "#ff2a00"],
  mono: ["#000000", "#ffffff"],
  rainbow: ["#ff0040", "#ff8000", "#ffee00", "#30ff40", "#00e5ff", "#2040ff", "#b000ff", "#ff00c8"],
  thermal: ["#0010ff", "#6a00ff", "#ff00d0", "#ff0030", "#ff7a00", "#ffee00", "#00ffe0"],
  "paper-grey": ["#d9d9d6", "#0a0a0a", "#ff2a6d"],
  "acid-data": ["#000000", "#b6ff00", "#1f4dff"],
  "hazard-orange": ["#141414", "#8c8c88", "#ff5a00"],
  "flesh-pink": ["#ffffff", "#ff3c8e", "#111111"],
  "lilac-terminal": ["#0b0613", "#b69cff", "#ff6ad5"],
  "blood-red": ["#000000", "#d10000", "#ffffff"],
  "clinic-mint": ["#f2f4f1", "#7fe3c1", "#b8a4ff"],
});

export const PALETTE_NAMES = Object.freeze(Object.keys(PALETTES));

/** "#rrggbb" -> [r, g, b] in 0..1 (sRGB). */
export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/iu.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A palette name or a custom list of 2-8 hex stops -> list of [r, g, b]. */
export function resolvePalette(value) {
  const stops = typeof value === "string" ? PALETTES[value] : value;
  if (!Array.isArray(stops)) throw new Error(`unknown palette: ${value}`);
  return stops.map(hexToRgb);
}
