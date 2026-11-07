// Role 14, scene: a whole mixed-material collage in one cell (flat fields, an image treatment of the plate, geometric
// primitives, pixel matter, leader lines, instruments and several type roles). Compositions are written in unit space
// (height 1, width = cell aspect) so a scene scales with its cell. The scene reads the text sheet of its own set
// (input textSet) through its own positions, and the tint colours for what the three palette colours cannot hold.
// Hits: stHit().x onset pulse, .y beat pulse; the cut count (clk.x) moves on the beat.
vec2 scS;
float scU;

float scAA(float d) { return clamp(0.5 - d * scU, 0.0, 1.0); }
float scLine(float d, float w) { return clamp(0.5 * w - abs(d * scU) + 0.5, 0.0, 1.0); }
float scPx() { return max(2.0, floor(6.0 * U + 0.5)); }
float scCell() { return max(2.0, floor(3.0 * U + 0.5)); }
float scPlus(vec2 c, vec2 p, float arm) {
  vec2 d = abs(c - p);
  return max(scLine(c.y - p.y, 1.0) * step(d.x, arm), scLine(c.x - p.x, 1.0) * step(d.y, arm));
}
float scBox(vec2 c, vec2 lo, vec2 hi) { return step(lo.x, c.x) * step(c.x, hi.x) * step(lo.y, c.y) * step(c.y, hi.y); }
float sdBox(vec2 p, vec2 lo, vec2 hi) {
  vec2 d = abs(p - 0.5 * (lo + hi)) - 0.5 * (hi - lo);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdArch(vec2 p, vec2 lo, vec2 hi) {
  float r = 0.5 * (hi.x - lo.x);
  vec2 ctr = vec2(0.5 * (lo.x + hi.x), lo.y + r);
  return p.y < ctr.y ? length(p - ctr) - r : sdBox(p, vec2(lo.x, ctr.y), hi);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// rectangle with its four corners cut at 45 degrees by ch (the octagon media window)
float sdChamfer(vec2 p, vec2 lo, vec2 hi, float ch) {
  vec2 q = abs(p - 0.5 * (lo + hi)) - 0.5 * (hi - lo);
  return max(max(q.x, q.y), (q.x + q.y + ch) * 0.7071);
}
// starburst glyph: n thin rays from radius inner out to R (each ray as long as the spectrum band it is hashed to), turned by rot
float scBurst(vec2 p, float R, float inner, float rot, float n) {
  float a = atan(p.y, p.x) + rot;
  float id = floor(a * n / 6.28318);
  float da = (fract(a * n / 6.28318) - 0.5) * 6.28318 / n;
  float len = R * (0.45 + 0.55 * bandAt(fract(id * 0.37)));
  float r = length(p);
  return scLine(da * r, 1.0) * step(inner, r) * step(r, len);
}
float scBayer(vec2 pix) {
  ivec2 p = ivec2(mod(pix, 8.0));
  int v = 0;
  for (int i = 0; i < 3; i++) { v = (v << 2) | ((((p.x ^ p.y) >> i) & 1) << 1) | ((p.y >> i) & 1); }
  return (float(v) + 0.5) / 64.0;
}

// the plate cover-fitted into the window lo..hi (cell px)
vec3 scPlate(vec2 q, vec2 lo, vec2 hi) { return HAS_INPUT ? footageBody(q - lo, hi - lo, 0.0, 0) : vec3(0.3); }
float scTone(vec2 q, vec2 lo, vec2 hi, float gain, float lift) { return clamp((luma(scPlate(q, lo, hi)) - lift) * gain, 0.0, 1.0); }

// plate edge strength (central differences of the luma at step d px): the wireframe look
float scEdge(vec2 q, vec2 lo, vec2 hi, float d) {
  float gx = luma(scPlate(q + vec2(d, 0.0), lo, hi)) - luma(scPlate(q - vec2(d, 0.0), lo, hi));
  float gy = luma(scPlate(q + vec2(0.0, d), lo, hi)) - luma(scPlate(q - vec2(0.0, d), lo, hi));
  return length(vec2(gx, gy));
}
// the text sheet at the same place on screen (1 : 1 for a full-frame cell)
float scSheet(vec2 q, int ch) { return sheetC(q * (RENDERSIZE / scS), ch); }
// a sheet word drawn with its own scale k (screen px per sheet px) so it can be squeezed or stretched: sheet point sheetLo lands at screen px o
float scWord(vec2 q, vec2 o, vec2 sheetLo, vec2 k, int ch) {
  float m = sheetC(sheetLo + (q - o) / (k * scS.y / RENDERSIZE.y), ch);
  return crisp(m, max(max(k.x, k.y), 1.0));
}
// the same with the horizontal strokes thinned (vertical erosion of d sheet px), for faux-tall type whose crossbars stretch
float scWordThin(vec2 q, vec2 o, vec2 sheetLo, vec2 k, int ch, float d) {
  vec2 sp = sheetLo + (q - o) / (k * scS.y / RENDERSIZE.y);
  float m = min(sheetC(sp, ch), min(sheetC(sp - vec2(0.0, d), ch), sheetC(sp + vec2(0.0, d), ch)));
  return crisp(m, max(max(k.x, k.y), 1.0));
}

// dot halftone on a 30 degree grid: dot radius follows the plate under the dot centre; 1 where the dot is
float scDots(vec2 q, vec2 lo, vec2 hi, float pitch, float gain, float lift, float inv) {
  mat2 R = mat2(0.866, 0.5, -0.5, 0.866);
  vec2 g = R * q / pitch;
  vec2 id = floor(g) + 0.5;
  vec2 cq = transpose(R) * (id * pitch);
  float l = scTone(cq, lo, hi, gain, lift);
  l = mix(l, 1.0 - l, inv);
  float r = 0.62 * sqrt(l);
  return clamp((r - length(g - id)) * pitch + 0.5, 0.0, 1.0);
}
// QR-like stamp of 21 x 21 modules: 1 dark, 0 light, -1 outside; three finder squares, the rest re-seeded by seed
float scFinder(vec2 m, vec2 o) {
  vec2 d = m - o;
  if (d.x < 0.0 || d.y < 0.0 || d.x > 6.0 || d.y > 6.0) { return -1.0; }
  bool ring = d.x < 0.5 || d.x > 5.5 || d.y < 0.5 || d.y > 5.5;
  bool core = d.x > 1.5 && d.x < 4.5 && d.y > 1.5 && d.y < 4.5;
  return ring || core ? 1.0 : 0.0;
}
float scQR(vec2 p, vec2 lo, float size, float seed) {
  vec2 u = (p - lo) / size;
  if (u.x < 0.0 || u.y < 0.0 || u.x >= 1.0 || u.y >= 1.0) { return -1.0; }
  vec2 m = floor(u * 21.0);
  float f = max(max(scFinder(m, vec2(0.0)), scFinder(m, vec2(14.0, 0.0))), scFinder(m, vec2(0.0, 14.0)));
  if (f >= 0.0) { return f; }
  if ((m.x < 8.0 && m.y < 8.0) || (m.x > 12.0 && m.y < 8.0) || (m.x < 8.0 && m.y > 12.0)) { return 0.0; }
  return step(0.5, hash12(m + seed * 17.3));
}
