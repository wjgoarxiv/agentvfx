// hud-deck: central media window (rect / rounded / chamfered octagon) with instrument columns drawn
// in GLSL hairlines, plus engine text for labels. Pass 0 (specState) holds the smoothed spectrum.
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
// Procedural outline glyphs (original shapes). p is relative to the glyph centre, R is its radius in design units.
float iconCylinder(vec2 p, float R) {
  float w = R * 0.62;
  float h = R * 0.78;
  float e = R * 0.27;
  float d = min(sdSeg(p, vec2(-w, -h), vec2(-w, h)), sdSeg(p, vec2(w, -h), vec2(w, h)));
  d = min(d, abs(sdEll(p - vec2(0.0, -h), vec2(w, e))));
  if (p.y > h) d = min(d, abs(sdEll(p - vec2(0.0, h), vec2(w, e))));
  return strokeAA(d, 1.5);
}
float iconFolder(vec2 p, float R) {
  float d = abs(sdRound(p - vec2(0.0, R * 0.14), vec2(R * 0.95, R * 0.62), 2.0));
  d = min(d, sdSeg(p, vec2(-R * 0.95, -R * 0.48), vec2(-R * 0.95, -R * 0.76)));
  d = min(d, sdSeg(p, vec2(-R * 0.95, -R * 0.76), vec2(-R * 0.25, -R * 0.76)));
  d = min(d, sdSeg(p, vec2(-R * 0.25, -R * 0.76), vec2(R * 0.02, -R * 0.48)));
  return strokeAA(d, 1.5);
}
float iconSwirl(vec2 p, float R) {
  float r = length(p);
  return max(burst(p, R * 0.2, R, 14.0, 1.2, 0.0, 1.7), fillAA(r - R * 0.11));
}
float iconLayers(vec2 p, float R) {
  float d = abs(sdRhomb(p - vec2(0.0, -R * 0.38), vec2(R, R * 0.46)));
  vec2 a = vec2(-R, R * 0.04);
  vec2 b = vec2(0.0, R * 0.5);
  vec2 c = vec2(R, R * 0.04);
  d = min(d, min(sdSeg(p, a, b), sdSeg(p, b, c)));
  d = min(d, min(sdSeg(p, a + vec2(0.0, R * 0.42), b + vec2(0.0, R * 0.42)), sdSeg(p, b + vec2(0.0, R * 0.42), c + vec2(0.0, R * 0.42))));
  return strokeAA(d, 1.5);
}
float iconMoon(vec2 p, float R) {
  return fillAA(max(length(p) - R * 0.88, -(length(p - vec2(R * 0.46, -R * 0.14)) - R * 0.74)));
}
float iconSnow(vec2 p, float R) {
  float m = max(burst(p, R * 0.3, R, 8.0, 1.3, 0.3927, 0.0), burst(p, R * 0.3, R * 0.62, 8.0, 1.3, 0.0, 0.0));
  return max(m, strokeAA(length(p) - R * 0.22, 1.4));
}
float iconTrefoil(vec2 p, float R) {
  float r = R * 0.34;
  float d = abs(sdTri(vec2(p.x, -(p.y + R * 0.5)), r));
  d = min(d, abs(sdTri(vec2(p.x + R * 0.5, -(p.y - R * 0.36)), r)));
  d = min(d, abs(sdTri(vec2(p.x - R * 0.5, -(p.y - R * 0.36)), r)));
  return max(strokeAA(d, 1.4), fillAA(length(p - vec2(0.0, R * 0.12)) - R * 0.07));
}
float iconDots(vec2 p, float R) {
  float d = abs(sdEll(p, vec2(R, R * 0.78)));
  d = min(d, abs(length(p - vec2(-R * 0.3, 0.0)) - R * 0.2));
  d = min(d, abs(length(p - vec2(R * 0.3, 0.0)) - R * 0.2));
  return strokeAA(d, 1.4);
}
float iconCube(vec2 p, float R) {
  float d = 1e3;
  vec2 prev = R * vec2(cos(0.5236), sin(0.5236));
  for (int i = 1; i <= 6; i++) {
    float a = 0.5236 + float(i) * 1.0472;
    vec2 cur = R * vec2(cos(a), sin(a));
    d = min(d, sdSeg(p, prev, cur));
    prev = cur;
  }
  d = min(d, sdSeg(p, vec2(0.0), R * vec2(cos(0.5236), sin(0.5236))));
  d = min(d, sdSeg(p, vec2(0.0), R * vec2(cos(2.618), sin(2.618))));
  d = min(d, sdSeg(p, vec2(0.0), R * vec2(0.0, -1.0)));
  float grid = step(0.5, mod(floor(p.x / 3.0) + floor(p.y / 3.0), 2.0)) * fillAA(sdBox(p - R * vec2(0.28, 0.2), R * vec2(0.22, 0.28)));
  return max(strokeAA(d, 1.5), grid);
}
float iconCircleCross(vec2 p, float R) {
  return max(strokeAA(length(p) - R, 1.3), plusMark(p, R * 1.2));
}
float iconOverlap(vec2 p, float R) {
  float d = min(abs(length(p - vec2(-R * 0.25, -R * 0.2)) - R * 0.62), abs(sdBox(p - vec2(R * 0.28, R * 0.25), vec2(R * 0.5))));
  return strokeAA(d, 1.3);
}
// staggered power-on: panel k (0..1) flickers in between k*introMs and k*introMs + 140 ms
float rev(float k) {
  float a = (TIME * 1000.0 - introMs * k) / 140.0;
  if (a >= 1.0) return 1.0;
  if (a <= 0.0) return 0.0;
  return step(0.45, hash12(vec2(k * 37.0, float(FRAMEINDEX))));
}

vec2 gWC;
vec2 gWH;

// beat tears: blocks of rows slide sideways for a couple of frames after each beat
vec2 tearP(vec2 p) {
  float on = step(0.3, beatPulse(8.0)) * tearAmount;
  if (on <= 0.0) return p;
  float row = floor(p.y / 20.0);
  float f = float(FRAMEINDEX / 2);
  p.x += (hash12(vec2(row, f)) - 0.5) * 2.0 * on * 150.0 * step(0.55, hash12(vec2(row, f + 1.7)));
  return p;
}
float lumAt(vec2 p) {
  vec2 uv = coverUV(tearP(p), gWC, gWH * 2.0);
  float L = pow(clamp(luma(mediaRaw(uv)), 0.0, 1.0), 0.4545);
  return clamp((L - 0.5) * mediaContrast + 0.5 + mediaBias, 0.0, 1.0);
}
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
float winSD(vec2 p) {
  vec2 q = p - gWC;
  if (winShape == 0) return sdRound(q, gWH, 8.0);
  if (winShape == 1) return sdRound(q, gWH, min(gWH.x, gWH.y) * 0.12);
  return sdChamfer(q, gWH, chamfer, 14.0);
}

vec3 windowColor(vec2 p) {
  if (mediaMode == 2) return mix(winBg.rgb, tone.rgb, dotScreen(p, dotSize, dotAngle, 1.18, 1.0));
  if (mediaMode == 3) return mix(winBg.rgb, tone.rgb, smoothstep(0.06, 0.94, lumAt(p)));
  vec3 c = mediaRaw(coverUV(tearP(p), gWC, gWH * 2.0));
  c = max((c - 0.18) * mediaContrast + 0.18 + (mediaBias * 0.2), 0.0);
  return mediaMode == 1 ? vec3(luma(c)) : c;
}

// white-hot horizontal light bar (eye flare) that breathes with the beat
vec3 flareAdd(vec2 p) {
  float amt = flare * (0.5 + 0.5 * mix(1.0, beatPulse(5.0), flareBeat));
  vec2 c = gWC + (vec2(flareX, flareY) - 0.5) * gWH * 2.0;
  float len = flareW * gWH.x * 2.0;
  float dx = (p.x - c.x) / len;
  float dy = p.y - c.y;
  float tap = clamp(1.0 - dx * dx, 0.0, 1.0);
  float s1 = 4.5 * tap + 0.8;
  float s2 = 28.0 * tap + 2.0;
  float core = exp(-dy * dy / (2.0 * s1 * s1)) * tap;
  float halo = exp(-dy * dy / (2.0 * s2 * s2)) * tap * 0.4;
  return (core * vec3(2.4) + halo * vec3(1.0, 0.78, 0.45)) * amt;
}

// Tile layout (octagon window, off-centre): dial gauge, segment meter, readout column, pad matrix,
// bar meters, scan ruler, timeline with a barcode strip, nested rhombus target and crop brackets.
// four-point astroid star (also used by the night layout's icon rows)
float dkAstroid(vec2 p, float R) {
  float f = sqrt(abs(p.x)) + sqrt(abs(p.y)) - sqrt(R);
  return strokeAA(f * R * 0.22, 1.4);
}
float dkOutlineRect(vec2 p, vec2 lo, vec2 hi) { return strokeAA(sdRound(p - 0.5 * (lo + hi), 0.5 * (hi - lo), 2.0), 1.5); }
float dkBand(int i) { return clamp(AUDIO_BANDS[clamp(i, 0, 31)] * reactivity, 0.0, 1.0); }

// upper half dial: two arcs, 40 ticks (every 5th long), a lit level band and a needle at value v
vec2 dkDial(vec2 p, vec2 c, float R, float v) {
  vec2 q = p - c;
  if (q.y > 2.0 || length(q) > R + 4.0) return vec2(0.0);
  float r = length(q);
  float a = atan(-q.y, q.x);
  float up = step(q.y, 0.0);
  float ink = up * max(strokeAA(r - R, 1.5), strokeAA(r - R * 0.6, 1.2));
  float sec = 3.14159265 / 40.0;
  float idx = floor((a + 0.5 * sec) / sec);
  float da = a - idx * sec;
  bool major = mod(idx, 5.0) < 0.5;
  float rin = R - (major ? 26.0 : 12.0);
  ink = max(ink, up * strokeAA(r * sin(da), major ? 2.0 : 1.2) * step(rin, r) * step(r, R - 4.0));
  float seg = up * step(R * 0.64, r) * step(r, R * 0.74) * step(abs(da), sec * 0.32);
  float lit = step(1.0 - idx / 40.0, v);
  float an = 3.14159265 * (1.0 - v);
  vec2 tip = c + R * 0.9 * vec2(cos(an), -sin(an));
  ink = max(ink, max(seg * lit, strokeAA(sdSeg(p, c, tip), 2.0)));
  ink = max(ink, max(fillAA(r - 6.0), strokeAA(r - 14.0, 1.2) * up));
  ink = max(ink, strokeAA(sdSeg(p, c - vec2(R, 0.0), c + vec2(R, 0.0)), 1.2));
  return vec2(ink, seg * (1.0 - lit));
}

// L-shaped crop mark just outside a window corner; sx, sy = -1 or 1 point away from the window
float dkBracket(vec2 p, vec2 corner, float sx, float sy) {
  vec2 a = corner + vec2(sx, sy) * 16.0;
  return strokeAA(min(sdSeg(p, a, a - vec2(sx * 44.0, 0.0)), sdSeg(p, a, a - vec2(0.0, sy * 44.0))), 2.0);
}

vec2 deckTiles(vec2 p, float drive) {
  float ink = 0.0;
  float dim = 0.0;
  float W = designWidth();
  vec2 lo = gWC - gWH;
  vec2 hi = gWC + gWH;
  float lv = clamp(drive, 0.0, 1.0);

  // top: header rule with tabs and a running time readout
  float k = rev(0.15);
  ink = max(ink, k * strokeAA(p.y - 96.0, 1.2) * step(lo.x, p.x) * step(p.x, hi.x));
  ink = max(ink, k * dkOutlineRect(p, vec2(lo.x, 52.0), vec2(lo.x + 224.0, 84.0)));
  ink = max(ink, k * dkOutlineRect(p, vec2(lo.x + 244.0, 52.0), vec2(lo.x + 304.0, 84.0)));
  ink = max(ink, k * dkOutlineRect(p, vec2(hi.x - 100.0, 52.0), vec2(hi.x, 84.0)));
  ink = max(ink, k * printNum(p - snapPx(vec2(lo.x + 14.0, 58.0)), mod(TIME, 1000.0), 3, 2, 4.0));
  ink = max(ink, k * plusMark(p - vec2(lo.x - 30.0, 96.0), 8.0));
  ink = max(ink, k * plusMark(p - vec2(hi.x + 30.0, 96.0), 8.0));
  ink = max(ink, k * dkBracket(p, lo, -1.0, -1.0));
  ink = max(ink, k * dkBracket(p, vec2(hi.x, lo.y), 1.0, -1.0));
  ink = max(ink, k * dkBracket(p, vec2(lo.x, hi.y), -1.0, 1.0));
  ink = max(ink, k * dkBracket(p, hi, 1.0, 1.0));

  // left: dial, segment meter, readout column, pad matrix
  k = rev(0.3);
  if (p.x < 420.0 && p.y < 270.0) {
    vec2 d = dkDial(p, vec2(214.0, 250.0), 180.0, lv);
    ink = max(ink, k * d.x);
    dim = max(dim, k * d.y);
  }
  if (p.y > 290.0 && p.y < 340.0 && p.x < 420.0) {
    float i = floor((p.x - 28.0) / 16.0);
    vec2 cc = vec2(28.0 + i * 16.0 + 6.5, 314.0);
    float box = sdBox(p - cc, vec2(6.5, 18.0));
    float inRow = step(0.0, i) * step(i, 23.0);
    float lit = step(i / 24.0, lv - 0.02);
    ink = max(ink, k * inRow * max(strokeAA(box, 1.2), fillAA(box) * lit));
    dim = max(dim, k * inRow * fillAA(box) * (1.0 - lit));
  }
  k = rev(0.45);
  if (p.x > 290.0 && p.x < 440.0 && p.y > 400.0 && p.y < 720.0) {
    for (int i = 0; i < 5; i++) {
      float y = 412.0 + float(i) * 62.0;
      float v = dkBand(2 + i * 6);
      ink = max(ink, k * printNum(p - snapPx(vec2(304.0, y)), v, 1, 2, 4.0));
      ink = max(ink, k * strokeAA(p.y - (y + 30.0), 2.0) * step(304.0, p.x) * step(p.x, 304.0 + 120.0 * v));
      dim = max(dim, k * strokeAA(p.y - (y + 30.0), 2.0) * step(304.0, p.x) * step(p.x, 424.0));
      ink = max(ink, k * strokeAA(sdSeg(p, vec2(294.0, y), vec2(294.0, y + 30.0)), 1.2));
    }
  }
  if (p.x < 320.0 && p.y > 766.0) {
    vec2 g = floor((p - vec2(28.0, 776.0)) / 70.0);
    if (g.x >= 0.0 && g.x < 4.0 && g.y >= 0.0 && g.y < 4.0) {
      vec2 cc = vec2(28.0, 776.0) + g * 70.0 + 29.0;
      float cell = sdRound(p - cc, vec2(29.0), 6.0);
      float lit = step(0.5, dkBand(int(g.y * 4.0 + g.x) * 2));
      ink = max(ink, k * max(strokeAA(cell, 1.4), fillAA(cell + 9.0) * lit));
      dim = max(dim, k * fillAA(cell + 9.0) * (1.0 - lit));
    }
  }

  // right: scan ruler beside the window, bar meters, BPM and frame readouts, rhombus target
  k = rev(0.6);
  float rx = hi.x + 16.0;
  if (p.x > rx - 14.0 && p.x < rx + 18.0 && p.y > lo.y - 2.0 && p.y < hi.y + 2.0) {
    float t = mod(p.y - lo.y, 12.0);
    float major = step(mod(p.y - lo.y, 60.0), 1.0);
    ink = max(ink, k * strokeAA(p.x - rx, 1.2));
    ink = max(ink, k * step(min(t, 12.0 - t), 0.6) * step(rx, p.x) * step(p.x, rx + mix(6.0, 14.0, major)));
    float sy = lo.y + fract(TIME * 0.125) * (hi.y - lo.y);
    ink = max(ink, k * max(fillAA(sdRhomb(p - vec2(rx, sy), vec2(7.0, 9.0))), strokeAA(p.y - sy, 1.2) * step(rx - 14.0, p.x)));
  }
  if (p.x > W - 262.0 && p.y > 130.0 && p.y < 346.0) {
    float i = floor((p.x - (W - 260.0)) / 29.0);
    if (i >= 0.0 && i < 8.0) {
      vec2 cc = vec2(W - 260.0 + i * 29.0 + 10.0, 240.0);
      float box = sdBox(p - cc, vec2(10.0, 100.0));
      float h = dkBand(2 + int(i) * 3);
      ink = max(ink, k * max(strokeAA(box, 1.2), fillAA(box + 3.0) * step(340.0 - h * 200.0, p.y)));
    }
  }
  k = rev(0.75);
  ink = max(ink, k * printNum(p - snapPx(vec2(W - 268.0, 770.0)), AUDIO_BPM, 3, 0, 7.0));
  ink = max(ink, k * printNum(p - snapPx(vec2(W - 268.0, 822.0)), float(FRAMEINDEX % 10000), 4, 0, 4.0));
  ink = max(ink, k * strokeAA(sdSeg(p, vec2(W - 268.0, 812.0), vec2(W - 28.0, 812.0)), 1.2));
  if (p.x > W - 250.0 && p.y > 890.0) {
    vec2 q = p - vec2(W - 150.0, 975.0);
    float an = TIME * 0.2 + drive * 0.4;
    q = mat2(cos(an), -sin(an), sin(an), cos(an)) * q;
    float rh = min(abs(sdRhomb(q, vec2(66.0))), min(abs(sdRhomb(q, vec2(44.0))), abs(sdRhomb(q, vec2(22.0)))));
    ink = max(ink, k * max(strokeAA(rh, 1.4), fillAA(length(q) - 4.0)));
  }

  // bottom: timeline with ticks and a playhead over a barcode strip that follows the bands
  k = rev(0.85);
  if (p.y > 900.0 && p.x > lo.x - 2.0 && p.x < hi.x + 2.0) {
    float span = hi.x - lo.x;
    float step48 = span / 48.0;
    float lx = p.x - lo.x;
    float tk = mod(lx + 0.5 * step48, step48) - 0.5 * step48;
    float major = step(mod(floor((lx + 0.5 * step48) / step48), 8.0), 0.5);
    ink = max(ink, k * strokeAA(p.y - 930.0, 1.4));
    ink = max(ink, k * strokeAA(tk, 1.2) * step(930.0 - mix(8.0, 18.0, major), p.y) * step(p.y, 930.0));
    float ph = lo.x + fract(TIME / 8.0) * span;
    ink = max(ink, k * max(fillAA(sdRhomb(p - vec2(ph, 914.0), vec2(7.0, 9.0))), strokeAA(p.x - ph, 1.2) * step(930.0, p.y) * step(p.y, 1048.0)));
    float col = floor(lx / 7.0);
    float on = step(fract(lx / 7.0), 0.58) * step(hash12(vec2(col, 31.0)), 0.82);
    float h = 90.0 * clamp(0.12 + 0.85 * dkBand(int(mod(col, 32.0))), 0.0, 1.0);
    float bar = on * step(1040.0 - h, p.y) * step(p.y, 1040.0) * step(946.0, p.y);
    ink = max(ink, k * bar);
    dim = max(dim, k * on * (1.0 - bar) * step(946.0, p.y) * step(p.y, 1040.0) * 0.5);
  }
  return vec2(ink, dim);
}
// Night deck, bottom desk (design units): desk rules, label rules, waveform strip and a hatched spectrum area.
float boxLine(vec2 p, vec2 lo, vec2 hi, float r) { return strokeAA(sdRound(p - 0.5 * (lo + hi), 0.5 * (hi - lo), r), 1.5); }

// Seeded point cloud that drifts as an elongated blob; density follows the music.
float dkCloud(vec2 p, vec2 size, float drive) {
  float t = TIME * driftSpeed;
  vec2 c = size * 0.5 + vec2(sin(t * 0.37) * size.x * 0.1, sin(t * 0.23 + 1.0) * size.y * 0.07);
  float ang = 0.8 + 0.6 * sin(t * 0.17);
  mat2 R = rot(ang);
  vec2 axes = vec2(size.x * (0.22 + 0.1 * drive), size.y * (0.09 + 0.13 * drive));
  float cell = 6.0;
  vec2 g = floor(p / cell);
  float m = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = g + vec2(float(i), float(j));
      vec2 h = hash22(id);
      vec2 pt = (id + 0.1 + 0.8 * h) * cell;
      pt += vec2(sin(t * (0.7 + h.x) + h.y * TAU), cos(t * (0.6 + h.y) + h.x * TAU)) * (1.2 + 2.5 * drive);
      vec2 q = R * (pt - c) / axes;
      float w = exp(-dot(q, q) * 1.15) * (0.7 + 1.6 * drive) * particleDensity;
      float keep = step(hash12(id + 7.7), w);
      m = max(m, keep * fillAA(length(p - pt) - 1.15));
    }
  }
  return m;
}

// vertical hairlines min..max of the waveform per pixel column (trigger-aligned wave texture, row 0)
float dkWave(vec2 p, float w, float amp) {
  float x0 = clamp((p.x - 0.5) / w, 0.0, 1.0);
  float x1 = clamp((p.x + 0.5) / w, 0.0, 1.0);
  float lo = 1e3;
  float hi = -1e3;
  for (int k = 0; k < 3; k++) {
    float s = (texture(audio, vec2(mix(x0, x1, float(k) * 0.5), 0.25)).r - 0.5) * 2.0 * amp * waveGain;
    lo = min(lo, s);
    hi = max(hi, s);
  }
  lo = min(lo, -0.4);
  hi = max(hi, 0.4);
  return clamp(min(p.y - lo + 0.5, hi - p.y + 0.5) * U, 0.0, 1.0);
}

float dkSpecValue(float xd, vec2 lo, float w) {
  float u = clamp((xd - lo.x) / w, 0.0, 1.0);
  return texture(specState, vec2(u * 256.0 / RENDERSIZE.x, 0.5 / RENDERSIZE.y)).r;
}

// spectrum as an area: a solid top edge over a vertical hatch down to the floor
vec2 dkSpecArea(vec2 p, vec2 lo, vec2 hi) {
  float w = hi.x - lo.x;
  float y0 = hi.y - 2.0;
  float span = (hi.y - lo.y - 8.0) * spectrumGain;
  float a = y0 - dkSpecValue(p.x - 0.5, lo, w) * span;
  float b = y0 - dkSpecValue(p.x + 0.5, lo, w) * span;
  float c = y0 - dkSpecValue(p.x, lo, w) * span;
  float top = min(c, min(a, b)) - 0.8;
  float bot = max(c, max(a, b)) + 0.8;
  float inX = step(lo.x + 1.0, p.x) * step(p.x, hi.x - 1.0);
  float edge = clamp(min(p.y - top, bot - p.y) * U + 0.5, 0.0, 1.0);
  float hatch = step(c, p.y) * step(p.y, y0) * step(fract(p.x / 4.0), 0.4);
  return vec2(max(edge * step(p.y, y0 + 0.6), hatch) * inX, 0.0);
}

vec2 deckLeft(vec2 p, float drive) {
  float ink = 0.0;
  float dim = 0.0;
  if (p.y < 776.0 || p.x > 1352.0) return vec2(0.0);
  float k = rev(0.3);
  // desk rule, label rules, column dividers
  ink = max(ink, k * strokeAA(p.y - 780.0, 1.2) * step(30.0, p.x));
  ink = max(ink, k * strokeAA(p.y - 890.0, 1.2) * step(30.0, p.x) * step(p.x, 520.0));
  dim = max(dim, k * strokeAA(p.x - 540.0, 1.2) * step(796.0, p.y) * step(p.y, 1046.0));
  dim = max(dim, k * strokeAA(p.x - 1350.0, 1.2) * step(796.0, p.y) * step(p.y, 1046.0));
  ink = max(ink, k * fillAA(sdBox(p - vec2(512.0, 798.0), vec2(8.0, 4.0))));
  ink = max(ink, k * fillAA(sdBox(p - vec2(512.0, 900.0), vec2(8.0, 4.0))));
  // waveform strip with a dotted baseline
  if (p.y > 994.0 && p.x < 530.0) {
    float k2 = rev(0.7);
    float x0 = 30.0;
    float w = 490.0;
    ink = max(ink, k2 * dkWave(vec2(p.x - x0, p.y - 1022.0), w, 20.0) * step(x0, p.x) * step(p.x, x0 + w));
    dim = max(dim, k2 * strokeAA(p.y - 1046.0, 1.2) * step(0.5, fract(p.x / 6.0)) * step(x0, p.x) * step(p.x, x0 + w));
  }
  // hatched spectrum area with dashed guides at the label columns
  vec2 sLo = vec2(560.0, 800.0);
  vec2 sHi = vec2(1330.0, 1000.0);
  if (p.x > 550.0 && p.y < 1004.0) {
    float k2 = rev(0.45);
    vec2 s = dkSpecArea(p, sLo, sHi);
    ink = max(ink, k2 * s.x);
    ink = max(ink, k2 * strokeAA(p.y - (sHi.y - 2.0), 1.4) * step(sLo.x, p.x) * step(p.x, sHi.x));
    for (int i = 0; i < 5; i++) {
      float xi = sLo.x + float(i) * (sHi.x - sLo.x) / 4.0;
      dim = max(dim, k2 * strokeAA(p.x - xi, 1.2) * step(0.5, fract(p.y / 8.0)) * step(sLo.y, p.y) * step(p.y, sHi.y));
    }
  }
  return vec2(ink, dim);
}
// Night deck, right rail: contour map with readouts, chamfered particle box, 16-step beat sequencer.
// iso-lines of fbm: a line wherever the field crosses a level, anti-aliased with the screen derivative
float dkField(vec2 p, vec2 lo, float drive) {
  float t = TIME * driftSpeed * 0.035;
  return fbm((p - lo) / 150.0 * contourScale + vec2(t, -t * 0.6) + drive * 0.12, 4) * contourLevels;
}
float dkContour(vec2 p, vec2 lo, float drive) {
  float s = dkField(p, lo, drive);
  float gx = dkField(p + vec2(1.0, 0.0), lo, drive) - s;
  float gy = dkField(p + vec2(0.0, 1.0), lo, drive) - s;
  float fw = max(length(vec2(gx, gy)) / U, 0.006);
  float dist = (0.5 - abs(fract(s) - 0.5)) / fw;
  return clamp(1.15 - dist, 0.0, 1.0);
}

vec2 deckRight(vec2 p, float drive) {
  float ink = 0.0;
  float dim = 0.0;
  if (p.x < 1360.0) return vec2(0.0);
  // contour map: frame, corner ticks, a dashed mid line, readouts beneath
  vec2 cLo = vec2(1370.0, 30.0);
  vec2 cHi = vec2(1890.0, 330.0);
  if (p.y < 370.0) {
    float k = rev(0.2);
    ink = max(ink, k * boxLine(p, cLo, cHi, 0.0));
    float inside = step(cLo.x + 1.0, p.x) * step(p.x, cHi.x - 1.0) * step(cLo.y + 1.0, p.y) * step(p.y, cHi.y - 1.0);
    ink = max(ink, k * inside * dkContour(p, cLo, drive));
    dim = max(dim, k * inside * strokeAA(p.y - 0.5 * (cLo.y + cHi.y), 1.2) * step(0.5, fract(p.x / 10.0)));
    vec2 q = abs(p - 0.5 * (cLo + cHi)) - (0.5 * (cHi - cLo) - 14.0);
    ink = max(ink, k * step(0.0, q.x) * step(0.0, q.y) * max(strokeAA(q.x, 3.0), strokeAA(q.y, 3.0)) * inside);
    float cell = cellPx(2.8);
    float va = 212.4 + 90.0 * sin(TIME * 0.9) + 60.0 * drive;
    float vb = 3.71 + 2.0 * sin(TIME * 1.7 + 1.0) + 4.0 * AUDIO_PEAK;
    ink = max(ink, k * printNum(p - snapPx(vec2(1366.0, 344.0)), va, 3, 1, cell));
    ink = max(ink, k * printNum(p - snapPx(vec2(1890.0 - numWidth(1, 3, cell), 344.0)), vb, 1, 3, cell));
  }
  // particle box with cut corners
  vec2 bLo = vec2(1370.0, 400.0);
  vec2 bHi = vec2(1890.0, 750.0);
  if (p.y > 394.0 && p.y < 756.0) {
    float k = rev(0.5);
    float sd = sdChamfer(p - 0.5 * (bLo + bHi), 0.5 * (bHi - bLo), 22.0, 0.0);
    ink = max(ink, k * strokeAA(sd, 1.5));
    ink = max(ink, k * dkCloud(p - bLo, bHi - bLo, drive) * step(sd, -4.0));
  }
  // beat sequencer: 16 cells, the current step filled, every fourth cell heavier
  if (p.y > 796.0 && p.y < 834.0) {
    float k = rev(0.65);
    float cw = (1890.0 - 1370.0) / 16.0;
    float i = floor((p.x - 1370.0) / cw);
    if (i >= 0.0 && i < 16.0) {
      vec2 cc = vec2(1370.0 + (i + 0.5) * cw, 815.0);
      float box = sdBox(p - cc, vec2(cw * 0.5 - 4.0, 15.0));
      float beats = AUDIO_BPM > 1.0 ? TIME * AUDIO_BPM / 60.0 : TIME * 2.0;
      float cur = mod(floor(beats), 16.0);
      float heavy = step(mod(i, 4.0), 0.5);
      ink = max(ink, k * max(strokeAA(box, mix(1.2, 2.4, heavy)), fillAA(box + 3.0) * step(abs(i - cur), 0.5)));
    }
  }
  return vec2(ink, dim);
}
void main() {
  initDesign();
  float W = designWidth();
  gWC = vec2(winX * W, winY * 1080.0);
  gWH = vec2(winW * W, winH * 1080.0) * 0.5;
  float kick = clamp((AUDIO_BASS - 1.0) / 3.0, 0.0, 1.0);
  float drive = clamp(0.5 * AUDIO_BANDS[1] + 0.4 * AUDIO_BANDS[3] + 0.4 * kick, 0.0, 1.3) * reactivity;

  vec3 col = groundColor.rgb;
  float wd = winSD(D);
  float inside = fillAA(wd);
  if (inside > 0.0) {
    vec3 m = windowColor(D);
    if (flare > 0.0) m += flareAdd(D);
    col = mix(col, m, inside);
  }
  float ink = strokeAA(wd, 1.5 + 2.0 * beatPulse(10.0) * reactivity) * rev(0.1);
  float dim = 0.0;

  vec2 pan = vec2(0.0);
  if (deckLayout == 0) {
    pan = max(deckLeft(D, drive), deckRight(D, drive));
    if (marks) {
      vec2 o = gWH + 12.0;
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(-1.0, -1.0)), 6.0));
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(1.0, -1.0)), 6.0));
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(-1.0, 1.0)), 6.0));
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(1.0, 1.0)), 6.0));
    }
  } else {
    pan = deckTiles(D, drive);
  }
  ink = max(ink, pan.x);
  dim = max(dim, pan.y);

  vec4 tm = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  bool micro = D.y > 395.0 && D.y < 720.0 && (D.x < 276.0 || D.x > W - 276.0);
  float gate = (deckLayout == 0) != micro ? 1.0 : 0.0;
  ink = max(ink, tm.r * gate * rev(0.25));

  col = mix(col, inkColor.rgb, clamp(dim, 0.0, 1.0) * dimAmount);
  col = mix(col, inkColor.rgb, clamp(ink, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}
