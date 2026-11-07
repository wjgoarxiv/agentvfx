// Single-tone screens. The including shader defines `float lumAt(vec2 p)` first: ink amount 0..1 at a design
// space point (1 = full dot). Cell sizes g are in design units.

// Dot screen: rotated square lattice, dot radius grows with sqrt(ink) so the dot AREA follows tone.
// The 3x3 neighbourhood is evaluated so large dots overlap instead of being clipped to their cell.
float dotScreen(vec2 p, float g, float ang, float gain, float soft) {
  mat2 R = rot(ang);
  vec2 q = (R * p) / g;
  vec2 cell = floor(q);
  float m = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j)) + 0.5;
      float L = lumAt((c * g) * R);
      float r = 0.5 * sqrt(clamp(L, 0.0, 1.0)) * gain;
      m = max(m, clamp(0.5 - (length(q - c) - r) * g * U / soft, 0.0, 1.0));
    }
  }
  return m;
}

// Ordered dither: Bayer 8x8 thresholds on blocks of `block` design units.
float orderedDither(vec2 p, float block) {
  vec2 b = floor(p * U / max(block * U, 1.0));
  vec2 centre = (b + 0.5) * block;
  return step(bayer8(b), lumAt(centre));
}

// ASCII-style cell: one of six procedural glyphs picked by tone (dot, +, x, #, =, block), no font needed.
float asciiScreen(vec2 p, float g) {
  vec2 id = floor(p / g);
  vec2 f = fract(p / g) - 0.5;
  float L = lumAt((id + 0.5) * g);
  float d = 1e3;
  if (L < 0.1) return 0.0;
  if (L < 0.26) d = length(f) - 0.09;
  else if (L < 0.42) d = min(abs(f.x), abs(f.y)) - 0.05 + step(0.34, max(abs(f.x), abs(f.y))) * 1e3;
  else if (L < 0.58) d = min(abs(f.x - f.y), abs(f.x + f.y)) * 0.7071 - 0.05 + step(0.36, max(abs(f.x), abs(f.y))) * 1e3;
  else if (L < 0.74) d = min(min(abs(abs(f.x) - 0.15), abs(abs(f.y) - 0.15)), 1e3) - 0.045 + step(0.4, max(abs(f.x), abs(f.y))) * 1e3;
  else if (L < 0.88) d = min(abs(f.y - 0.13), abs(f.y + 0.13)) - 0.06 + step(0.4, abs(f.x)) * 1e3;
  else d = max(abs(f.x), abs(f.y)) - 0.4;
  return clamp(0.5 - d * g * U, 0.0, 1.0);
}
