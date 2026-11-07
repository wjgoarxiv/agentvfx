// halftone-field: footage as one-tone dot matrix (dot screen, ordered dither or ASCII cells) on a full solid
// field, framed by a hairline with pink / cyan micro bars on the image edges and a tall thin headline.
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
vec2 gC;
vec2 gH;

// beat tears: rows of the image slide sideways for a couple of frames after a beat
vec2 tearP(vec2 p) {
  float on = step(0.3, beatPulse(8.0)) * tearAmount;
  if (on <= 0.0) return p;
  float row = floor(p.y / 18.0);
  float f = float(FRAMEINDEX / 2);
  p.x += (hash12(vec2(row, f)) - 0.5) * 2.0 * on * 120.0 * step(0.6, hash12(vec2(row, f + 2.3)));
  return p;
}
float lumAt(vec2 p) {
  vec2 uv = coverUV(tearP(p), gC, gH * 2.0);
  float L = pow(clamp(luma(mediaRaw(uv)), 0.0, 1.0), 0.4545);
  L = clamp((L - 0.5) * imgContrast + 0.5 + imgBias, 0.0, 1.0);
  return invert ? 1.0 - L : L;
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
// edge bars: short horizontal ticks hung inward from the left / right image edges, lengths ride the bands
float edgeBars(vec2 p, vec2 lo, vec2 hi, out vec3 tint) {
  tint = vec3(0.0);
  float m = 0.0;
  float slotH = 7.0;
  float y = p.y - lo.y;
  if (y < 0.0 || p.y > hi.y) return 0.0;
  float slot = floor(y / slotH);
  float fy = fract(y / slotH);
  for (int side = 0; side < 2; side++) {
    float sid = slot * 2.0 + float(side);
    float h1 = hash12(vec2(sid, 4.0));
    float h2 = hash12(vec2(sid, 9.0));
    float band = AUDIO_BANDS[int(mod(slot * 3.0 + float(side) * 7.0, 28.0))];
    float len = (6.0 + 70.0 * h2 * h2) * (0.45 + 1.1 * band * reactivity);
    float edge = side == 0 ? p.x - lo.x : hi.x - p.x;
    float on = step(0.0, edge) * step(edge, len) * step(0.1, fy) * step(fy, 0.62) * step(1.0 - barDensity, h1);
    if (on > m) tint = h2 > 0.5 ? barA.rgb : barB.rgb;
    m = max(m, on);
  }
  return m;
}

void main() {
  initDesign();
  float W = designWidth();
  gC = vec2(imgX * W, imgY * 1080.0);
  gH = vec2(imgW * W, imgH * 1080.0) * 0.5;
  float kick = clamp((AUDIO_BASS - 1.0) / 3.0, 0.0, 1.0);
  vec3 col = fieldColor.rgb;
  vec2 lo = gC - gH;
  vec2 hi = gC + gH;
  float inRect = step(lo.x, D.x) * step(D.x, hi.x) * step(lo.y, D.y) * step(D.y, hi.y);

  vec4 tm = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  float halo = 0.0;
  if (HAS_TEXT && inRect > 0.0) {
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      halo = max(halo, texture(TEXTMASK, vUv + vec2(cos(a), sin(a)) * 4.0 / RENDERSIZE).r);
    }
  }

  float dots = 0.0;
  if (inRect > 0.0) {
    float gain = dotGain * (1.0 + kickGain * kick * 0.3);
    if (screenMode == 0) dots = dotScreen(D, cell, dotAngle, gain, 1.0);
    else if (screenMode == 1) dots = orderedDither(D, max(2.0, cell * 0.36));
    else dots = asciiScreen(D, cell * 1.5);
    dots *= 1.0 - halo * textKnock;
  }
  col = mix(col, dotColor.rgb, dots);

  vec2 fc = 0.5 * (lo + hi);
  float ink = strokeAA(sdBox(D - fc, gH + 10.0), 1.5) * frameAmount;
  ink = max(ink, strokeAA(sdBox(D - fc, gH), 1.0) * frameAmount * 0.5);
  if (marks) {
    for (int i = 0; i < 4; i++) {
      vec2 corner = vec2(i % 2 == 0 ? lo.x : hi.x, i < 2 ? lo.y : hi.y);
      ink = max(ink, plusMark(D - (corner + (corner - fc) / gH * 28.0), 9.0));
    }
  }
  vec3 tint;
  float bars = edgeBars(D, lo, hi, tint) * clamp((TIME * 1000.0 - introMs * 0.4) / 160.0, 0.0, 1.0) * barAmount;
  col = mix(col, tint, bars);
  col = mix(col, inkColor.rgb, clamp(ink, 0.0, 1.0));
  float t = tm.r * clamp((TIME * 1000.0 - introMs * 0.1) / 120.0, 0.0, 1.0);
  col = mix(col, textColor.rgb, clamp(t, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}
