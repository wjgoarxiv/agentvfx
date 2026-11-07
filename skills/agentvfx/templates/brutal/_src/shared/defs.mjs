// Shared helpers for the brutal family definitions (parameter builders, invented micro-text, colours).
export const f = (NAME, MIN, MAX, DEFAULT) => ({ NAME, TYPE: "float", MIN, MAX, DEFAULT });
export const b = (NAME, DEFAULT) => ({ NAME, TYPE: "bool", DEFAULT });
export const c = (NAME, DEFAULT) => ({ NAME, TYPE: "color", DEFAULT });
export const l = (NAME, VALUES, LABELS, DEFAULT) => ({ NAME, TYPE: "long", MIN: Math.min(...VALUES), MAX: Math.max(...VALUES), VALUES, LABELS, DEFAULT });

/** "#rrggbb" -> [r, g, b, 1] in sRGB 0..1, rounded to 3 places. */
export const hex = (s) => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round((v / 255) * 1000) / 1000).concat(1);
};

/** Seeded invented code lines ("7G75-0A4F 91C2 LV//09"): decoration only, never real data or marks. */
export function microLines(seed, rows, cols) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const hexd = "0123456789ABCDEF";
  const word = (n) => Array.from({ length: n }, () => hexd[Math.floor(rnd() * 16)]).join("");
  const tags = ["LV//", "NODE", "SIG", "RLY", "0x", "7G-", "AX", "KRN"];
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    while (line.length < cols - 10) line += `${rnd() < 0.3 ? pick(tags) : ""}${word(2 + Math.floor(rnd() * 3))} `;
    lines.push(line.slice(0, cols).trimEnd());
  }
  return lines.join("\n");
}
