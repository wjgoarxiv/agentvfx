// agentvfx (agentvfx licence, see LICENSE). Adapted from lit-typographic-motion 1.0.45 engine/node/board.mjs: only the
// tile geometry is kept. Look-gate boards (references beside rendered frames) are composed in Node
// from RGBA buffers by stills.mjs, so no browser or font is involved.

export const BOARD = Object.freeze({ width: 1920, height: 1080, margin: 48, gap: 20, header: 150, footer: 56, caption: 104 });

/** Tile geometry: columns, thumbnail size, for n tiles of a frame of size width x height. */
export function boardGrid(n, width, height) {
  const usableW = BOARD.width - 2 * BOARD.margin;
  const usableH = BOARD.height - BOARD.header - BOARD.footer - BOARD.margin;
  const aspect = width / height;
  const options = [];
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const rows = Math.ceil(n / cols);
    const tw = Math.floor((usableW - (cols - 1) * BOARD.gap) / cols);
    const byHeight = Math.floor((usableH - (rows - 1) * BOARD.gap) / rows) - BOARD.caption;
    const th = Math.min(Math.round(tw / aspect), byHeight);
    if (th <= 0) continue;
    options.push({ cols, rows, tw: Math.round(th * aspect), th, empty: rows * cols - n });
  }
  // The largest tiles, unless a grid with fewer empty slots keeps 85 % of their area.
  const largest = Math.max(...options.map((o) => o.tw * o.th));
  return options.filter((o) => o.tw * o.th >= 0.85 * largest).sort((a, b) => a.empty - b.empty || b.tw * b.th - a.tw * a.th)[0];
}
