// boot-log: monospace boot log typing over a field, dot-matrix emblem, corner + marks, side readouts,
// progress bar, then a decode headline. Scanlines, slight bloom, phosphor flicker and beat tears.
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
// dot-matrix emblem: a mirrored 13x13 cell pattern that re-rolls on beats, inside a bracket frame
float emblem(vec2 p, vec2 o, float pitch, float rollSeed) {
  vec2 q = (p - o) / pitch;
  vec2 id = floor(q);
  if (id.x < 0.0 || id.y < 0.0 || id.x > 12.0 || id.y > 12.0) return 0.0;
  vec2 m = vec2(abs(id.x - 6.0), id.y);
  float reach = max(abs(id.x - 6.0), abs(id.y - 6.0));
  float body = step(0.5, hash12(m + vec2(rollSeed * 1.7, 3.0)));
  float rim = step(0.35, hash12(m + vec2(1.0, rollSeed)));
  float on = mix(body, rim, step(5.5, reach));
  on = max(on, step(reach, 1.5) * step(0.4, hash12(m + 9.0)));
  vec2 f = fract(q) - 0.5;
  return on * fillAA((length(f) - 0.34) * pitch);
}

// side readout column: rows of 4-digit codes that scroll and re-roll
float sideColumn(vec2 p, float x0, float y0, float seed, float cell) {
  float rowH = 7.4 * cell;
  float r = floor((p.y - y0) / rowH);
  if (r < 0.0 || r > 38.0) return 0.0;
  float scroll = floor(TIME * 6.0 + seed);
  float v = floor(hash12(vec2(r + scroll, seed)) * 9999.0);
  vec2 o = snapPx(vec2(x0, y0 + r * rowH));
  float fade = step(0.18, hash12(vec2(r, seed + 4.0)));
  return printNum(p - o, v, 4, 0, cell) * fade;
}

float bloomTaps(vec2 uv, float rad) {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236 + rad;
    s += texture(TEXTMASK, uv + vec2(cos(a), sin(a)) * rad * U / RENDERSIZE).r;
  }
  return s * 0.0833;
}

void main() {
  initDesign();
  float W = designWidth();
  float pulse = beatPulse(9.0);
  float beatOn = step(0.3, pulse);
  vec2 uv = vUv;
  // beat tear: row blocks slide
  float row = floor(D.y / 16.0);
  float f2 = float(FRAMEINDEX / 2);
  uv.x += beatOn * tearAmount * (hash12(vec2(row, f2)) - 0.5) * 0.06 * step(0.7, hash12(vec2(row, f2 + 5.0)));

  vec4 tm = HAS_TEXT ? texture(TEXTMASK, uv) : vec4(0.0);
  float bloom = HAS_TEXT ? 0.4 * bloomTaps(uv, 3.0) + 0.35 * bloomTaps(uv, 8.0) + 0.25 * bloomTaps(uv, 16.0) : 0.0;
  float tInk = tm.r;
  bool headlineZone = D.y > 740.0 && D.y < 930.0;

  vec3 col = fieldColor.rgb;
  float ink = 0.0;
  float dim = 0.0;

  // pixel dust (clustered) and glowing data streaks
  vec2 dc = floor(D / 8.0);
  float cluster = smoothstep(0.55, 0.8, fbm(dc * 0.07 + vec2(TIME * 0.05, 0.0), 3));
  dim = max(dim, cluster * step(0.955, hash12(dc + floor(TIME * 8.0))) * dustAmount);
  for (int k = 0; k < 3; k++) {
    float seedK = floor(TIME * 9.0) + float(k) * 13.0;
    float yS = 240.0 + 640.0 * hash12(vec2(seedK, 1.0));
    float x0 = W * hash12(vec2(seedK, 2.0));
    float len = 120.0 + 520.0 * hash12(vec2(seedK, 3.0));
    float on = step(0.45, hash12(vec2(seedK, 4.0))) * step(x0, D.x) * step(D.x, x0 + len);
    float core = strokeAA(D.y - yS, 1.6) * on;
    dim = max(dim, core * streakAmount);
    col += inkColor.rgb * exp(-abs(D.y - yS) * 0.12) * on * streakAmount * 0.18 * (1.0 + pulse);
  }

  // emblem + brackets
  float rv = clamp((TIME * 1000.0 - introMs * 0.2) / 140.0, 0.0, 1.0);
  float roll = floor(TIME * 2.0) + float(FRAMEINDEX / 8) * beatOn;
  ink = max(ink, emblem(D, vec2(64.0, 64.0), 10.0, roll) * rv);
  vec2 ec = vec2(64.0 + 65.0, 64.0 + 65.0);
  vec2 eq = abs(D - ec) / 74.0;
  ink = max(ink, strokeAA(sdBox(D - ec, vec2(74.0)), 1.5) * step(0.62, min(eq.x, eq.y)) * rv);

  // corner + marks
  for (int i = 0; i < 4; i++) {
    vec2 c = vec2(i % 2 == 0 ? 36.0 : W - 36.0, i < 2 ? 74.0 : 1006.0);
    ink = max(ink, plusMark(D - c, 10.0));
  }
  // side readouts (right and a thin left tick column)
  float cell = cellPx(2.6);
  dim = max(dim, sideColumn(D, W - 150.0, 262.0, 3.0, cell) * rv);
  dim = max(dim, sideColumn(D, W - 90.0, 262.0, 11.0, cell) * rv * 0.7);
  for (int i = 0; i < 24; i++) {
    float yT = 262.0 + float(i) * 29.6;
    dim = max(dim, strokeAA(sdSeg(D, vec2(W - 170.0, yT), vec2(W - 170.0 + (i % 4 == 0 ? 14.0 : 7.0), yT)), 1.2));
  }

  // progress bar: dot-matrix blocks, completes with the log
  float prog = clamp((TIME - 0.2) / max(logDone - 0.2, 0.1), 0.0, 1.0);
  vec2 bo = vec2(64.0, 936.0);
  vec2 bp = D - bo;
  float blocks = step(0.0, bp.x) * step(bp.x, 640.0) * step(0.0, bp.y) * step(bp.y, 16.0);
  float bi = floor(bp.x / 10.0);
  float full = step(bi, prog * 64.0 - 1.0);
  float cellIn = step(fract(bp.x / 10.0), 0.78) * step(2.0, bp.y) * step(bp.y, 14.0);
  ink = max(ink, blocks * cellIn * full);
  dim = max(dim, blocks * cellIn * (1.0 - full) * 0.6);
  ink = max(ink, strokeAA(sdBox(bp - vec2(320.0, 8.0), vec2(324.0, 12.0)), 1.3));
  ink = max(ink, printNum(D - snapPx(vec2(700.0, 936.0)), floor(prog * 100.0), 2, 0, cellPx(3.2)) * 1.0);

  col = mix(col, inkColor.rgb, clamp(dim, 0.0, 1.0) * 0.55);
  float t = tInk * clamp((TIME * 1000.0 - introMs * 0.05) / 100.0, 0.0, 1.0);
  vec3 textCol = headlineZone ? hotColor.rgb : inkColor.rgb;
  col = mix(col, inkColor.rgb, clamp(ink, 0.0, 1.0));
  col = mix(col, textCol, clamp(t, 0.0, 1.0));
  col = mix(col, inkColor.rgb, clamp(bloom * bloomAmount, 0.0, 1.0) * (1.0 - t) * 0.6);

  // CRT: scanlines, flicker, vignette, curved letterbox
  float scan = 1.0 - scanAmount * 0.5 * (1.0 + sin(gl_FragCoord.y * 3.14159));
  float flick = 1.0 - flickerAmount * hash12(vec2(float(FRAMEINDEX), 3.0)) * (0.4 + pulse);
  vec2 vq = vUv * 2.0 - 1.0;
  float vig = 1.0 - vignette * dot(vq * vec2(0.7, 0.9), vq * vec2(0.7, 0.9));
  col *= scan * flick * vig;
  float u2 = pow(2.0 * vUv.x - 1.0, 2.0);
  float edge = letterbox * (1.0 - 0.5 * (1.0 - u2));
  float yd = min(D.y, 1080.0 - D.y);
  col = mix(vec3(0.0), col, clamp((yd - edge) * U + 0.5, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}
