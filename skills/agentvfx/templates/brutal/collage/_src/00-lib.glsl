// collage main (generated from _src/*.glsl by _src/build.mjs; edit the parts, not this file).
// A collage on a 32 x 18 grid. Pass 0 decodes up to 16 cells (cell0.., style0.., src0.. inputs; or a seeded
// partition rebuilt on every cut in reshuffle mode) into the state texture; this pass draws them in list order.
// A cell is either the old boxed "tile" panel (gutter, header strip, frame) or an editorial cell with no box
// of its own: footage, hairline spectrum / scope / meters, live numbers, registration marks, rules and "type"
// cells that window the engine text sheet. Pixel units: U = pixels per design pixel at 1080p. Cells hold their
// place; only the instruments move, and nothing eases.
float U;
float HW;
const int MAXL = 16;
const float HEAD = 22.0;

float hlw(float d, float w) { return clamp(w * 0.5 - abs(d) + 0.5, 0.0, 1.0); }
float hl(float d) { return hlw(d, HW); }
float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float inBox(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }
float boxLnW(vec2 p, vec2 lo, vec2 hi, float w) {
  vec2 q = abs(p - (lo + hi) * 0.5) - (hi - lo) * 0.5;
  return hlw(max(q.x, q.y), w);
}
float dashed(float x, float period, float duty) { return step(fract(x / (period * U)), duty); }
float plusAt(vec2 p, vec2 c, float arm) {
  vec2 d = abs(p - c);
  return max(hl(d.y) * step(d.x, arm), hl(d.x) * step(d.y, arm));
}

vec4 stClock() { return texelFetch(state, ivec2(0, 0), 0); }
vec4 stLevel() { return texelFetch(state, ivec2(1, 0), 0); }
vec4 stHit() { return texelFetch(state, ivec2(3, 0), 0); }
float stBand(int i) { return texelFetch(state, ivec2(i, 1), 0).r; }

// 3 x 5 pixel font, 3 bits per row, row 0 at the top. Index: 0-9, A-Z (10..35), . - + / : % (36..41).
//@FONT@
int fontIndex(int ch) {
  if (ch >= 48 && ch <= 57) { return ch - 48; }
  if (ch >= 65 && ch <= 90) { return ch - 55; }
  if (ch == 46) { return 36; }
  if (ch == 45) { return 37; }
  if (ch == 43) { return 38; }
  if (ch == 47) { return 39; }
  if (ch == 58) { return 40; }
  if (ch == 37) { return 41; }
  return -1;
}
float cellPx(float c) { return max(1.0, floor(c + 0.5)); }
float glyphAt(vec2 p, int ch, float cell) {
  int gi = fontIndex(ch);
  if (gi < 0 || p.x < 0.0 || p.y < 0.0) { return 0.0; }
  ivec2 c = ivec2(floor(p / cell));
  if (c.x > 2 || c.y > 4) { return 0.0; }
  return float((FONT[gi] >> ((4 - c.y) * 3 + (2 - c.x))) & 1);
}
// up to four characters (ASCII codes, 0 = none) from the top-left o; advance is 4 cells
float txt4(vec2 p, vec2 o, float cell, int a, int b, int c, int d) {
  vec2 q = p - o;
  if (q.x < 0.0 || q.y < 0.0) { return 0.0; }
  float adv = 4.0 * cell;
  int i = int(floor(q.x / adv));
  if (i > 3) { return 0.0; }
  int ch = i == 0 ? a : (i == 1 ? b : (i == 2 ? c : d));
  return glyphAt(vec2(q.x - float(i) * adv, q.y), ch, cell);
}
// non-negative integer with nd digits
float numTxt(vec2 p, vec2 o, float cell, float v, int nd) {
  vec2 q = p - o;
  if (q.x < 0.0 || q.y < 0.0) { return 0.0; }
  float adv = 4.0 * cell;
  int i = int(floor(q.x / adv));
  if (i >= nd) { return 0.0; }
  int dg = int(mod(floor(v / pow(10.0, float(nd - 1 - i)) + 0.001), 10.0));
  return glyphAt(vec2(q.x - float(i) * adv, q.y), 48 + dg, cell);
}
float numW(int nd, float cell) { return float(nd) * 4.0 * cell - cell; }
