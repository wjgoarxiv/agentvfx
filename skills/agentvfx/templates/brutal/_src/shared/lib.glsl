// brutal family shared GLSL (written fresh). Layout units are "design pixels" of a 1920x1080 frame:
// U real pixels per design unit, D the fragment position in design units (origin top-left, y down).
// Distance functions after the standard analytic forms (circle, box, segment, ellipse, equilateral
// triangle: Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/); the 3x5 digit font, the
// dot screen, the Bayer matrix and the glyph icons are original.
float U;
vec2 D;
const float TAU = 6.28318530718;

void initDesign() {
  U = RENDERSIZE.y / 1080.0;
  D = vec2(gl_FragCoord.x, RENDERSIZE.y - gl_FragCoord.y) / U;
}
float designWidth() { return RENDERSIZE.x / U; }

float fillAA(float d) { return clamp(0.5 - d * U, 0.0, 1.0); }
float strokeAA(float d, float w) { return clamp((0.5 * w - abs(d)) * U + 0.5, 0.0, 1.0); }
float sdBox(vec2 p, vec2 h) { vec2 q = abs(p) - h; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float sdRound(vec2 p, vec2 h, float r) { return sdBox(p, h - r) - r; }
// chamfered (octagon) rectangle: box cut by a diamond; c is the leg of each 45 degree corner cut
float sdChamfer(vec2 p, vec2 h, float c, float r) {
  vec2 hh = h - r;
  return max(sdBox(p, hh), (abs(p.x) + abs(p.y) - (hh.x + hh.y - c)) * 0.70710678) - r;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float sdEll(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-4);
}
float sdTri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
float sdRhomb(vec2 p, vec2 h) { return (abs(p.x) / h.x + abs(p.y) / h.y - 1.0) * min(h.x, h.y) * 0.9; }

float plusMark(vec2 p, float arm) {
  return max(strokeAA(sdSeg(p, vec2(-arm, 0.0), vec2(arm, 0.0)), 1.5), strokeAA(sdSeg(p, vec2(0.0, -arm), vec2(0.0, arm)), 1.5));
}
// radial lines between r0 and r1, n of them; spin rotates the whole burst, twist curls them
float burst(vec2 p, float r0, float r1, float n, float w, float spin, float twist) {
  float r = length(p);
  float a = atan(p.y, p.x) + spin + twist * r / max(r1, 1.0);
  float sec = TAU / n;
  float da = mod(a + 0.5 * sec, sec) - 0.5 * sec;
  return strokeAA(r * sin(da), w) * step(r0, r) * step(r, r1);
}

// pixel-snapped origin, so the pixel fonts stay crisp
vec2 snapPx(vec2 o) { return floor(o * U + 0.5) / U; }
float cellPx(float cell) { return max(1.0, floor(cell * U + 0.5)) / U; }

// 3x5 digit font: 0-9, '-' (10), '.' (11); rows top to bottom, 3 bits per row
const int F3[12] = int[12](0x7B6F, 0x2C97, 0x73E7, 0x73CF, 0x5BC9, 0x79CF, 0x79EF, 0x7292, 0x7BEF, 0x7BCF, 0x01C0, 0x0002);
float glyph3(vec2 p, int g, float cell) {
  ivec2 c = ivec2(floor(p / cell));
  if (c.x < 0 || c.x > 2 || c.y < 0 || c.y > 4) return 0.0;
  return float((F3[g] >> ((4 - c.y) * 3 + (2 - c.x))) & 1);
}
int digitOf(float a, int power) { return int(mod(floor(a * pow(10.0, -float(power))), 10.0)); }
// fixed-width number: sign slot, nInt integer digits, then '.' and nDec decimals; p from the top-left
float printNum(vec2 p, float v, int nInt, int nDec, float cell) {
  float adv = 4.0 * cell;
  int total = 1 + nInt + (nDec > 0 ? 1 + nDec : 0);
  if (p.x < 0.0 || p.x >= float(total) * adv || p.y < 0.0 || p.y >= 5.0 * cell) return 0.0;
  int idx = int(floor(p.x / adv));
  vec2 q = vec2(p.x - float(idx) * adv, p.y);
  int g = 11;
  if (idx == 0) {
    if (v >= 0.0) return 0.0;
    g = 10;
  } else if (idx <= nInt) {
    g = digitOf(abs(v), nInt - idx);
  } else if (idx > nInt + 1) {
    g = digitOf(abs(v), -(idx - nInt - 1));
  }
  return glyph3(q, g, cell);
}
float numWidth(int nInt, int nDec, float cell) { return float(1 + nInt + (nDec > 0 ? 1 + nDec : 0)) * 4.0 * cell; }

// 8x8 Bayer threshold 0..1 for an integer pixel cell
float bayer8(vec2 cell) {
  ivec2 i = ivec2(mod(floor(cell), 8.0));
  int x = i.x;
  int xy = i.x ^ i.y;
  int v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}

float beatPulse(float rate) { return AUDIO_BPM > 1.0 ? exp(-AUDIO_BEATPHASE * rate) : 0.0; }

// cover-fit UV into inputImage for a design-space point p inside a box (centre c, full size s)
vec2 coverUV(vec2 p, vec2 c, vec2 s) {
  vec2 tex = IMG_SIZE(inputImage);
  float ta = tex.x / tex.y;
  float wa = s.x / s.y;
  vec2 q = (p - c) / s;
  q.y = -q.y;
  vec2 vis = wa > ta ? vec2(1.0, ta / wa) : vec2(wa / ta, 1.0);
  return 0.5 + q * vis;
}
vec3 mediaRaw(vec2 uv) {
  if (HAS_INPUT) return texture(inputImage, uv).rgb;
  float n = fbm(uv * 3.6 + vec2(TIME * 0.06, 0.0), 4);
  float m = fbm(uv * 7.0 - vec2(0.0, TIME * 0.05) + 3.1, 3);
  return vec3(smoothstep(0.3, 0.75, n) * (0.35 + 0.65 * m)) * vec3(1.0, 0.9, 0.78);
}
