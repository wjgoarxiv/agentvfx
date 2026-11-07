// Flash audit thresholds (WCAG 2.2 general/red flash, ITU-R BT.1702-3, IRIS-style extended rule).
export const FLASH = Object.freeze({
  grid: [320, 180],
  windowCells: [107, 60], // 1/3 x 1/3 of the grid
  windowArea: 0.25,
  edgeFrames: 1, // a window transition is judged on the single frame whose cells registered it
  delta: 0.1,
  darkCeiling: 0.8,
  redRatio: 0.8,
  redScale: 320,
  redDelta: 20,
  maxFlashesPerSecond: 3,
  maxTransitionsPerSecond: 6, // BT.1702-3: more than 6 transitions (3 flashes) in any 1 s
  extendedMinTransitions: 4,
  extendedMaxTransitions: 6,
  extendedSeconds: 4,
});

/** 8-bit sRGB code value to linear light. */
export const LINEAR_LUT = Float32Array.from({ length: 256 }, (_, v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
});
