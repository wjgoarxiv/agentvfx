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
const int FONT[42] = int[42](0x7B6F, 0x2C97, 0x73E7, 0x73CF, 0x5BC9, 0x79CF, 0x79EF, 0x7249, 0x7BEF, 0x7BCF, 0x2BED, 0x6BAE, 0x3923, 0x6B6E, 0x79A7, 0x79A4, 0x396B, 0x5BED, 0x7497, 0x126A, 0x5BAD, 0x4927, 0x5FED, 0x6B6D, 0x2B6A, 0x6BA4, 0x2B73, 0x6BAD, 0x388E, 0x7492, 0x5B6F, 0x5B6A, 0x5BFD, 0x5AAD, 0x5A92, 0x72A7, 0x2, 0x1C0, 0x5D0, 0x12A4, 0x410, 0x52A5);
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

// Panels return vec3(ink, accent, negative) coverage; q is in pixels from the panel's top-left, S its size.

// spectrum steps: columns of dashes that light in whole rows, accent on the top row of each column
vec3 pSpectrum(vec2 q, vec2 S) {
  float pad = 10.0 * U;
  vec2 lo = vec2(pad, HEAD * U + pad);
  vec2 hi = vec2(S.x - pad, S.y - pad - 14.0 * U);
  vec2 sz = hi - lo;
  float ink = 0.0;
  float acc = 0.0;
  float xr = step(lo.x, q.x) * step(q.x, hi.x);
  for (int r = 1; r < 4; r++) {
    float yr = hi.y - sz.y * float(r) / 4.0;
    ink = max(ink, hl(q.y - yr) * dashed(q.x, 6.0, 0.35) * xr * 0.4);
  }
  ink = max(ink, hl(q.y - hi.y) * xr);
  float pitch = sz.x / float(bands);
  float cx = q.x - lo.x;
  int b = int(floor(cx / pitch));
  if (cx >= 0.0 && b < bands) {
    float rows = max(floor(sz.y / (6.0 * U)), 4.0);
    float rowH = sz.y / rows;
    float lit = floor(stBand(b) * rows + 0.5);
    float y = hi.y - q.y;
    float xin = mod(cx, pitch);
    float on = step(0.0, y) * step(floor(y / rowH), lit - 1.0) * step(U, xin) * step(xin, pitch - U) * step(fract(y / rowH), 0.7) * step(0.5, lit);
    ink = max(ink, on * 0.6);
    acc = max(acc, on * step(lit - 1.5, floor(y / rowH)));
  }
  float span = log(endFreq / startFreq);
  for (int k = 0; k < 3; k++) {
    float f = k == 0 ? 100.0 : (k == 1 ? 1000.0 : 10000.0);
    float tx = log(f / startFreq) / span;
    if (tx <= 0.0 || tx >= 1.0) { continue; }
    float x = lo.x + tx * sz.x;
    ink = max(ink, hl(q.x - x) * step(hi.y, q.y) * step(q.y, hi.y + 5.0 * U));
    float c = cellPx(2.0 * U);
    ink = max(ink, k == 0 ? txt4(q, vec2(x + 3.0 * U, hi.y + 5.0 * U), c, 49, 48, 48, 0) : (k == 1 ? txt4(q, vec2(x + 3.0 * U, hi.y + 5.0 * U), c, 49, 75, 0, 0) : txt4(q, vec2(x + 3.0 * U, hi.y + 5.0 * U), c, 49, 48, 75, 0)));
  }
  return vec3(ink, acc, 0.0);
}

float waveAt(float i) { return texture(audio, vec2((clamp(i, 0.0, 511.0) + 0.5) / 512.0, 0.25)).r - 0.5; }
float waveI(float i) {
  float f = floor(i);
  return mix(waveAt(f), waveAt(f + 1.0), i - f);
}

// scope trace: dashed graticule, centre axis with ticks, a trigger-aligned trace drawn as the vertical
// extent of the wave across each pixel column so steep edges stay solid
vec3 pScope(vec2 q, vec2 S) {
  float pad = 10.0 * U;
  vec2 lo = vec2(pad, HEAD * U + pad);
  vec2 hi = S - vec2(pad);
  vec2 sz = hi - lo;
  float yc = (lo.y + hi.y) * 0.5;
  float inb = inBox(q, lo, hi);
  float ink = 0.0;
  for (int k = 1; k < 8; k++) { ink = max(ink, hl(q.x - (lo.x + sz.x * float(k) / 8.0)) * dashed(q.y, 6.0, 0.3) * inb * 0.35); }
  for (int k = 1; k < 4; k++) { ink = max(ink, hl(q.y - (lo.y + sz.y * float(k) / 4.0)) * dashed(q.x, 6.0, 0.3) * inb * 0.35); }
  float tick = step(abs(q.y - yc), (fract((q.x - lo.x) / (sz.x / 40.0) + 0.5) < 0.1 ? 3.0 : 0.0) * U) * inb;
  ink = max(ink, max(hl(q.y - yc) * inb * 0.7, tick * 0.7));
  ink = max(ink, max(hl(q.x - lo.x + 5.0 * U), 0.0) * step(abs(q.y - yc), 4.0 * U) * step(q.x, lo.x));
  float dx = 0.5 / sz.x * 511.0;
  float t = (q.x - lo.x) / sz.x * 511.0;
  float yA = yc - waveI(t - dx) * scopeGain * sz.y;
  float yB = yc - waveI(t + dx) * scopeGain * sz.y;
  float yMin = clamp(min(yA, yB), lo.y, hi.y);
  float yMax = clamp(max(yA, yB), lo.y, hi.y);
  float d = max(max(yMin - q.y, q.y - yMax), 0.0);
  float acc = hlw(d, HW * 1.15) * step(lo.x, q.x) * step(q.x, hi.x);
  return vec3(ink, acc, 0.0);
}

// level meter: four segmented channels (bass, mid, treble, rms) that fill in whole segments, accent on the
// top lit segment and the clip zone; the long side of the panel is the scale
vec3 pMeter(vec2 q, vec2 S) {
  vec4 lv = stLevel();
  float pad = 10.0 * U;
  vec2 lo = vec2(pad, HEAD * U + pad);
  vec2 hi = vec2(S.x - pad, S.y - pad - 12.0 * U);
  vec2 a = q - lo;
  vec2 sz = hi - lo;
  bool vert = S.y >= S.x * 0.75;
  float len = vert ? sz.y : sz.x;
  float wid = vert ? sz.x : sz.y;
  float along = vert ? sz.y - a.y : a.x;
  float across = vert ? a.x : a.y;
  float chW = wid / 4.0;
  float c = cellPx(2.0 * U);
  vec2 lp = q - vec2(lo.x, hi.y + 4.0 * U);
  int lc = int(clamp(floor(lp.x / chW), 0.0, 3.0));
  vec2 lo_ = vec2(lp.x - float(lc) * chW - (chW * 0.5 - 6.0 * c), lp.y);
  float labels = !vert || lp.x < 0.0 ? 0.0 : (lc == 0 ? txt4(lo_, vec2(0.0), c, 66, 83, 83, 0) : (lc == 1 ? txt4(lo_, vec2(0.0), c, 77, 73, 68, 0) : (lc == 2 ? txt4(lo_, vec2(0.0), c, 84, 82, 66, 0) : txt4(lo_, vec2(0.0), c, 82, 77, 83, 0))));
  if (along < 0.0 || across < 0.0 || along >= len || across >= wid) { return vec3(labels, 0.0, 0.0); }
  int ch = int(floor(across / chW));
  float within = fract(across / chW);
  float nseg = max(floor(len / (6.0 * U)), 8.0);
  float segLen = len / nseg;
  float seg = floor(along / segLen);
  float lit = floor(lv[ch] * nseg + 0.5);
  float shape = step(fract(along / segLen), 0.68) * step(0.16, within) * step(within, 0.84);
  float on = shape * step(seg, lit - 1.0) * step(0.5, lit);
  float off = shape * (1.0 - on) * 0.16;
  float clip = step(nseg * 0.8, seg);
  float top = step(lit - 1.5, seg);
  float acc = on * max(clip, top);
  float ink = max(on * (1.0 - acc) * 0.85, off);
  return vec3(max(ink, labels), acc, 0.0);
}

// readout: one large three digit number (rms x 999), then smaller rows for tempo, cut index and frame
vec3 pReadout(vec2 q, vec2 S, vec4 clk) {
  vec4 lv = stLevel();
  float pad = 10.0 * U;
  float top = HEAD * U + pad;
  float big = cellPx(min((S.x - 2.0 * pad) / 11.0, (S.y - top) * 0.42 / 5.0));
  float ink = numTxt(q, vec2(pad, top), big, floor(lv.a * 999.0), 3);
  float small = cellPx(min(4.0 * U, big * 0.5));
  float rowStep = 5.0 * small + 8.0 * U;
  float y0 = S.y - pad - 5.0 * small - 2.0 * rowStep;
  ink = max(ink, hl(q.y - (y0 - 6.0 * U)) * step(pad, q.x) * step(q.x, S.x - pad) * 0.6);
  float valX = pad + 16.0 * small;
  ink = max(ink, txt4(q, vec2(pad, y0), small, 66, 80, 77, 0) + numTxt(q, vec2(valX, y0), small, floor(AUDIO_BPM), 3));
  ink = max(ink, txt4(q, vec2(pad, y0 + rowStep), small, 67, 85, 84, 0) + numTxt(q, vec2(valX, y0 + rowStep), small, mod(clk.x, 1000.0), 3));
  ink = max(ink, txt4(q, vec2(pad, y0 + 2.0 * rowStep), small, 70, 82, 77, 0) + numTxt(q, vec2(valX, y0 + 2.0 * rowStep), small, mod(float(FRAMEINDEX), 1000.0), 3));
  float pulse = step(float(FRAMEINDEX) - clk.w, 1.5) * step(0.5, clk.z);
  float lamp = inBox(q, vec2(S.x - pad - 10.0 * U, top), vec2(S.x - pad, top + 10.0 * U));
  return vec3(min(ink, 1.0), lamp * pulse, 0.0);
}

// crosshair: hairlines through a target that follows the spectral balance (x) and loudness (y), tick
// scales, a ring that tracks rms and a second ring that steps outward for three frames after each onset
vec3 pCross(vec2 q, vec2 S, vec4 clk) {
  vec4 lv = stLevel();
  float pad = 10.0 * U;
  vec2 lo = vec2(pad, HEAD * U + pad);
  vec2 hi = S - vec2(pad);
  vec2 ctr = (lo + hi) * 0.5;
  vec2 half_ = (hi - lo) * 0.5;
  vec2 tp = ctr + half_ * vec2(0.6 * (lv.b - lv.r), -0.7 * (lv.a * 1.8 - 0.7));
  tp = clamp(tp, lo + 8.0 * U, hi - 8.0 * U);
  float inb = inBox(q, lo, hi);
  vec2 d = q - tp;
  float ink = max(hl(d.y) * inb, hl(d.x) * inb) * 0.8;
  float tickX = step(abs(d.y), (fract(d.x / (8.0 * U) + 0.5) < 0.12 ? (fract(d.x / (40.0 * U) + 0.5) < 0.12 ? 7.0 : 3.5) : 0.0) * U);
  float tickY = step(abs(d.x), (fract(d.y / (8.0 * U) + 0.5) < 0.12 ? (fract(d.y / (40.0 * U) + 0.5) < 0.12 ? 7.0 : 3.5) : 0.0) * U);
  ink = max(ink, max(tickX, tickY) * inb);
  float r = length(d);
  float base = min(half_.x, half_.y);
  float ringA = hl(r - base * (0.2 + 0.45 * lv.a));
  float hitF = float(FRAMEINDEX) - clk.w;
  float ringB = hitF < 3.0 && clk.z > 0.5 ? hl(r - base * (0.8 + 0.3 * hitF)) : 0.0;
  float dot_ = inBox(d, vec2(-3.0 * U), vec2(3.0 * U));
  float mid = hl(length(q - ctr) - base * 0.75) * dashed(atan(q.y - ctr.y, q.x - ctr.x) * base * 0.75, 7.0, 0.35) * 0.4;
  float acc = max(max(ringA, ringB), dot_) * inb;
  float c = cellPx(2.0 * U);
  float xy = numTxt(q, vec2(lo.x + 4.0 * U, hi.y - 12.0 * U), c, floor(clamp((tp.x - lo.x) / (hi.x - lo.x), 0.0, 1.0) * 999.0), 3)
           + numTxt(q, vec2(hi.x - numW(3, c) - 4.0 * U, hi.y - 12.0 * U), c, floor(clamp(1.0 - (tp.y - lo.y) / (hi.y - lo.y), 0.0, 1.0) * 999.0), 3);
  return vec3(min(max(ink, max(mid, xy)), 1.0), acc, 0.0);
}

// footage: cover-fit into the cell below `top` (the tile header height, 0 for editorial cells), contrast curve,
// optional single-tone mix, saturation and dim, scanlines. Variants 1..4 lay a dark scrim over it (bottom, top,
// left, vignette, bottom plus vignette) so type reads on top. Without an input the cell shows a crossed empty-media mark.
vec3 footageBody(vec2 q, vec2 S, float top, int variant) {
  vec2 lo = vec2(0.0, top);
  vec2 sz = S - lo;
  vec2 d = (q - (lo + S) * 0.5) / sz;
  vec2 tex = IMG_SIZE(inputImage);
  float ta = tex.x / tex.y;
  float wa = sz.x / sz.y;
  vec2 vis = wa > ta ? vec2(1.0, ta / wa) : vec2(wa / ta, 1.0);
  vec3 c = texture(inputImage, vec2(0.5 + d.x * vis.x, 0.5 - d.y * vis.y)).rgb;
  c = max((c - 0.18) * footageContrast + 0.18, 0.0);
  vec3 duo = mix(groundColor.rgb, inkColor.rgb, smoothstep(0.02, 0.6, luma(c)));
  c = mix(c, duo, footageTone);
  c = mix(vec3(luma(c)), c, footageSat) * (1.0 - footageDim);
  vec2 u = (q - lo) / sz;
  float scrim = 1.0;
  if (variant == 1) { scrim = smoothstep(0.32, 1.0, u.y); }
  if (variant == 2) { scrim = smoothstep(0.68, 0.0, u.y); }
  if (variant == 3) { scrim = smoothstep(0.7, 0.0, u.x); }
  if (variant == 4) { scrim = smoothstep(0.35, 1.0, length((u - 0.5) * vec2(1.0, 1.15)) * 1.6); }
  if (variant == 5) { scrim = max(smoothstep(0.3, 0.95, u.y), smoothstep(0.3, 1.0, length((u - 0.5) * vec2(1.0, 1.25)) * 1.5) * 0.85); }
  if (variant == 6) { scrim = 0.93; }
  if (variant == 7) { scrim = 0.55; }
  c *= mix(1.0, 0.1, scrim * step(0.5, float(variant)));
  return c * (1.0 - footageScan * step(0.5, fract(q.y / (3.0 * U))));
}

float hatch(vec2 q, float pitch) { return hl(mod(q.x + q.y, pitch * U) - pitch * 0.5 * U); }

// fillers: 7 = ruler or pixel cluster, 8 = accent plate with the cut number or hatching, 9 = sparse hatch
vec3 pFiller(int role, vec2 q, vec2 S, float hs, vec4 clk) {
  float pad = 10.0 * U;
  float top = HEAD * U;
  bool wide = S.x >= S.y;
  if (role == 7 && hs < 0.5) {
    float along = wide ? q.x : S.y - q.y;
    float across = wide ? S.y - q.y : q.x;
    float k = floor(along / (8.0 * U) + 0.5);
    float len = (mod(k, 5.0) < 0.5 ? 14.0 : 6.0) * U;
    float tk = step(abs(along - k * 8.0 * U), HW * 0.5 + 0.5) * step(across, len) * step(top, q.y) * step(pad * 0.5, along);
    float base = hl(across) * step(top, q.y);
    float c = cellPx(2.0 * U);
    float mj = floor((along - 3.0 * U) / (40.0 * U));
    vec2 o = wide ? vec2(mj * 40.0 * U + 3.0 * U, S.y - 18.0 * U - 5.0 * c) : vec2(18.0 * U, S.y - (mj * 40.0 * U + 3.0 * U) - 5.0 * c);
    float nTxt = mj >= 0.0 ? numTxt(q, o, c, mod(mj, 100.0), 2) * step(top + 3.0 * U, q.y) : 0.0;
    return vec3(max(max(tk, base) * 0.8, nTxt), 0.0, 0.0);
  }
  if (role == 7) {
    vec2 g = (q - vec2(pad, top + pad)) / (11.0 * U);
    vec2 id = floor(g + 0.5);
    float lit = step(0.72, fract(sin(dot(id + clk.x * 1.7, vec2(12.9898, 78.233))) * 43758.5453));
    float dotc = cov(length((g - id) * 11.0 * U) - (1.2 + 1.3 * lit) * U) * inBox(q, vec2(pad, top + pad), S - vec2(pad));
    return vec3(dotc * (1.0 - lit) * 0.7, dotc * lit, 0.0);
  }
  if (role == 8 && hs < 0.6 && plateAmount > 0.5) {
    float cn = cellPx(min(S.x * 0.78 / 11.0, S.y * 0.5 / 5.0));
    vec2 o = vec2(pad, S.y - pad - 5.0 * cn);
    return vec3(0.0, 1.0, numTxt(q, o, cn, mod(clk.x, 1000.0), 3));
  }
  float hp = role == 8 ? 9.0 : 16.0;
  float amt = role == 8 ? 0.5 : 0.28;
  float h = hatch(q, hp) * step(top, q.y) * amt;
  float cr = role == 9 ? plusAt(q, (vec2(0.0, top) + S) * 0.5, min(S.x, S.y) * 0.12) : 0.0;
  return vec3(max(h, cr), 0.0, 0.0);
}

// header strip: frame, rule under the label, role tag, and the cut number (or timecode for the footage panel)
vec3 panelHead(int role, float hs, vec2 q, vec2 S, vec4 clk, float snap) {
  float w = snap > 0.5 ? HW * 3.0 : HW;
  float frame = boxLnW(q, vec2(0.0), S, w);
  float rule = hl(q.y - HEAD * U) * step(0.0, q.x) * step(q.x, S.x);
  float c = cellPx(2.5 * U);
  vec2 o = vec2(8.0 * U, (HEAD * U - 5.0 * c) * 0.5);
  float tag = role == 1 ? txt4(q, o, c, 83, 82, 67, 0) : (role == 2 ? txt4(q, o, c, 70, 70, 84, 0) : (role == 3 ? txt4(q, o, c, 79, 83, 67, 0)
    : (role == 4 ? txt4(q, o, c, 76, 86, 76, 0) : (role == 5 ? txt4(q, o, c, 78, 85, 77, 0) : (role == 6 ? txt4(q, o, c, 88, 72, 82, 0)
    : (role == 7 ? (hs < 0.5 ? txt4(q, o, c, 82, 85, 76, 0) : txt4(q, o, c, 80, 73, 88, 0)) : txt4(q, o, c, 72, 67, 72, 0)))))));
  float right = 0.0;
  if (role == 1) {
    float tc = TIME;
    float x0 = S.x - 8.0 * U - 31.0 * c;
    vec2 p = vec2(x0, o.y);
    right = numTxt(q, p, c, floor(tc / 60.0), 2) + glyphAt(q - p - vec2(8.0 * c, 0.0), 58, c)
          + numTxt(q, p + vec2(12.0 * c, 0.0), c, mod(floor(tc), 60.0), 2) + glyphAt(q - p - vec2(20.0 * c, 0.0), 58, c)
          + numTxt(q, p + vec2(24.0 * c, 0.0), c, mod(float(FRAMEINDEX), 30.0), 2);
  } else {
    right = numTxt(q, vec2(S.x - 8.0 * U - numW(3, c), o.y), c, mod(clk.x, 1000.0), 3);
  }
  float ink = max(max(frame, rule * (role == 8 ? 0.0 : 1.0)), max(tag, min(right, 1.0)));
  return vec3(ink, snap > 0.5 ? frame : 0.0, 0.0);
}

// Editorial roles. The engine text layer (TEXTMASK) is a "sheet" of type slots (see fx.json X_AGENTVFX.text);
// a type cell shows a window of that sheet, scaled and optionally turned 90 degrees, and the shader only
// colours it. Live numbers and labels come from the mono "atlas" row of the sheet (digits, colon, A..Z).
// Every role below returns vec3(ink, hot, 0) coverage in the cell's own pixel space (q from its top-left).
const float ATLAS_X = 0.35938;
const float ATLAS_Y = 0.93333;
const float ATLAS_PX = 0.05;
const float MONO_ADV = 0.602;
vec2 UN;

// one text-sheet channel (0 R the editorial sheet, 1 G, 2 B) at sheet pixel sp (origin top left)
float sheetC(vec2 sp, int ch) {
  vec2 res = RENDERSIZE;
  if (!HAS_TEXT || sp.x < 0.0 || sp.y < 0.0 || sp.x >= res.x || sp.y >= res.y) { return 0.0; }
  vec3 t = texture(TEXTMASK, vec2(sp.x, res.y - sp.y) / res).rgb;
  return ch == 1 ? t.g : (ch == 2 ? t.b : t.r);
}
float sheetAt(vec2 sp) { return sheetC(sp, 0); }

int aIdx(int ch) {
  if (ch >= 48 && ch <= 57) { return ch - 48; }
  if (ch == 58) { return 10; }
  if (ch >= 65 && ch <= 90) { return ch - 54; }
  return -1;
}
// one atlas glyph; p is in pixels from the top-left of its character box (MONO_ADV * fs wide, fs high)
float aGlyph(vec2 p, int ch, float fs) {
  int idx = aIdx(ch);
  if (idx < 0 || p.x < 0.0 || p.y < 0.0 || p.x >= MONO_ADV * fs || p.y >= fs) { return 0.0; }
  float apx = ATLAS_PX * RENDERSIZE.y;
  vec2 o = vec2(ATLAS_X * RENDERSIZE.x + float(idx) * MONO_ADV * apx, ATLAS_Y * RENDERSIZE.y);
  return sheetAt(o + p * (apx / fs));
}
float aTxt(vec2 p, float fs, int a, int b, int c, int d) {
  if (p.x < 0.0) { return 0.0; }
  float adv = MONO_ADV * fs;
  int i = int(floor(p.x / adv));
  if (i > 3) { return 0.0; }
  int ch = i == 0 ? a : (i == 1 ? b : (i == 2 ? c : d));
  return aGlyph(vec2(p.x - float(i) * adv, p.y), ch, fs);
}
float aNum(vec2 p, float fs, float v, int nd) {
  if (p.x < 0.0) { return 0.0; }
  float adv = MONO_ADV * fs;
  int i = int(floor(p.x / adv));
  if (i >= nd) { return 0.0; }
  int dg = int(mod(floor(v / pow(10.0, float(nd - 1 - i)) + 0.001), 10.0));
  return aGlyph(vec2(p.x - float(i) * adv, p.y), 48 + dg, fs);
}

float bandAt(float x) {
  float f = x * float(bands) - 0.5;
  float i0 = floor(f);
  return mix(stBand(clamp(int(i0), 0, bands - 1)), stBand(clamp(int(i0) + 1, 0, bands - 1)), f - i0);
}

// spectrum, hairline family. 1: one line over the bands; 2: comb of single-pixel bars. Both stand on a
// baseline with a tick scale under it and an accent dot on the loudest band.
vec3 pSpecHair(vec2 q, vec2 S, int v) {
  float y0 = S.y - 14.0 * U;
  float amp = y0 - 2.0 * U;
  float inx = step(0.0, q.x) * step(q.x, S.x);
  float pitch = S.x / float(bands);
  float ink = hl(q.y - y0) * inx * 0.85;
  float tk = floor(q.x / pitch + 0.5);
  float isMaj = mod(tk, 5.0) < 0.5 ? 1.0 : 0.0;
  ink = max(ink, step(abs(q.x - tk * pitch), HW * 0.5 + 0.25) * step(y0, q.y) * step(q.y, y0 + (3.0 + 3.5 * isMaj) * U) * 0.8);
  float hot = 0.0;
  if (v == 2) {
    int b = int(clamp(floor(q.x / pitch), 0.0, float(bands - 1)));
    float top = y0 - stBand(b) * amp;
    float bar = hl(q.x - (float(b) + 0.5) * pitch) * step(top, q.y) * step(q.y, y0) * inx;
    ink = max(ink, bar * 0.8);
    hot = max(hot, bar * step(q.y, top + 3.0 * U));
  } else {
    float yA = y0 - bandAt((q.x - 0.5) / S.x) * amp;
    float yB = y0 - bandAt((q.x + 0.5) / S.x) * amp;
    float d = max(max(min(yA, yB) - q.y, q.y - max(yA, yB)), 0.0);
    ink = max(ink, hlw(d, HW * 1.15) * inx);
  }
  vec4 pk = texelFetch(state, ivec2(2, 0), 0);
  vec2 pp = vec2((pk.x + 0.5) * pitch, y0 - pk.y * amp);
  float lit = step(0.06, pk.y);
  hot = max(hot, lit * max(inBox(q - pp, vec2(-3.0 * U), vec2(3.0 * U)), hl(q.x - pp.x) * step(q.y, pp.y - 3.0 * U) * step(pp.y - 12.0 * U, q.y)));
  return vec3(ink, hot, 0.0);
}

// scope as one line crossing the cell: faint axis, trigger-free wave trace. 1: trace hot; 2: trace ink
vec3 pScopeLine(vec2 q, vec2 S, int v) {
  float yc = S.y * 0.5;
  float inx = step(0.0, q.x) * step(q.x, S.x);
  float dx = 0.5 / S.x * 511.0;
  float t = q.x / S.x * 511.0;
  float yA = yc - waveI(t - dx) * scopeGain * S.y;
  float yB = yc - waveI(t + dx) * scopeGain * S.y;
  float d = max(max(clamp(min(yA, yB), 0.0, S.y) - q.y, q.y - clamp(max(yA, yB), 0.0, S.y)), 0.0);
  float tr = hlw(d, HW * 1.15) * inx;
  float axis = hl(q.y - yc) * inx * 0.22;
  return vec3(max(axis, v == 2 ? tr : 0.0), v == 2 ? 0.0 : tr, 0.0);
}

// hairline track with a heavier fill up to the level and a cap tick, along the long side of the cell
vec3 levelBar(vec2 q, vec2 S, int ch) {
  float lv = stLevel()[ch];
  bool wide = S.x >= S.y;
  float len = wide ? S.x : S.y;
  float along = wide ? q.x : S.y - q.y;
  float across = wide ? q.y - S.y * 0.5 : q.x - S.x * 0.5;
  if (along < -1.0 || along > len + 1.0) { return vec3(0.0); }
  float track = hl(across) * 0.3;
  float fillv = hlw(across, HW * 2.4) * step(0.0, along) * step(along, lv * len);
  float cap = step(abs(along - lv * len), HW * 0.75 + 0.5) * step(abs(across), 5.0 * U) * step(0.04, lv);
  float ends = step(abs(along), HW * 0.5 + 0.25) * step(abs(across), 3.0 * U);
  return vec3(max(max(track, fillv), ends * 0.6), cap, 0.0);
}

// four thin level bars (bass, mid, treble, rms) with mono labels: rows in a wide cell, columns in a tall one
vec3 pMeterEd(vec2 q, vec2 S) {
  bool wide = S.x >= S.y * 1.2;
  if (wide) {
    float rh = S.y / 4.0;
    int ch = int(clamp(floor(q.y / rh), 0.0, 3.0));
    vec2 lq = vec2(q.x, q.y - float(ch) * rh);
    float fs = min(rh * 0.8, 15.0 * U);
    float lw = 4.2 * MONO_ADV * fs;
    vec2 gp = lq - vec2(0.0, (rh - fs) * 0.5);
    float lab = ch == 0 ? aTxt(gp, fs, 66, 83, 83, 0) : (ch == 1 ? aTxt(gp, fs, 77, 73, 68, 0) : (ch == 2 ? aTxt(gp, fs, 84, 82, 66, 0) : aTxt(gp, fs, 82, 77, 83, 0)));
    vec3 b = levelBar(lq - vec2(lw, 0.0), vec2(S.x - lw, rh), ch);
    return vec3(max(lab * 0.9, b.x), b.y, 0.0);
  }
  float cw = S.x / 4.0;
  int ch = int(clamp(floor(q.x / cw), 0.0, 3.0));
  float fs = min(cw * 0.7, 15.0 * U);
  float lh = fs * 1.5;
  vec2 lq = vec2(q.x - float(ch) * cw, q.y);
  vec2 gp = lq - vec2((cw - 3.0 * MONO_ADV * fs) * 0.5, S.y - lh);
  float lab = ch == 0 ? aTxt(gp, fs, 66, 83, 83, 0) : (ch == 1 ? aTxt(gp, fs, 77, 73, 68, 0) : (ch == 2 ? aTxt(gp, fs, 84, 82, 66, 0) : aTxt(gp, fs, 82, 77, 83, 0)));
  vec3 b = levelBar(lq, vec2(cw, S.y - lh), ch);
  return vec3(max(lab * 0.9, b.x), b.y, 0.0);
}

// live number, left aligned and sized to the cell width: 1 rms, 2 cut count (flashes hot for 4 frames), 3 frame, 4 timecode, 5 bpm
vec3 pReadEd(vec2 q, vec2 S, int v, vec4 clk) {
  int nch = v == 4 ? 8 : (v == 3 ? 4 : 3);
  float fs = min(S.x / (float(nch) * MONO_ADV), S.y / 0.86);
  vec2 p = q - vec2(0.0, S.y * 0.5 - fs * 0.455);
  float ink = 0.0;
  if (v == 1) { ink = aNum(p, fs, floor(stLevel().a * 999.0), 3); }
  if (v == 2) { ink = aNum(p, fs, mod(clk.x, 1000.0), 3); }
  if (v == 3) { ink = aNum(p, fs, mod(float(FRAMEINDEX), 10000.0), 4); }
  if (v == 5) { ink = aNum(p, fs, floor(AUDIO_BPM), 3); }
  if (v == 4) {
    float adv = MONO_ADV * fs;
    ink = aNum(p, fs, mod(floor(TIME / 60.0), 100.0), 2) + aGlyph(p - vec2(2.0 * adv, 0.0), 58, fs)
        + aNum(p - vec2(3.0 * adv, 0.0), fs, mod(floor(TIME), 60.0), 2) + aGlyph(p - vec2(5.0 * adv, 0.0), 58, fs)
        + aNum(p - vec2(6.0 * adv, 0.0), fs, mod(float(FRAMEINDEX), 30.0), 2);
  }
  ink = min(ink, 1.0);
  float pulse = v == 2 && clk.x > 0.5 && float(FRAMEINDEX) - clk.y < 3.5 ? 1.0 : 0.0;
  return vec3(ink, ink * pulse, 0.0);
}

// registration mark: ring, inner ring and a cross reaching past the ring; an accent dot follows the spectral
// balance (x) and loudness (y) and an onset throws a second ring for three frames
vec3 pRegMark(vec2 q, vec2 S, vec4 clk) {
  vec4 lv = stLevel();
  vec2 c = S * 0.5;
  float R = min(S.x, S.y) * 0.5;
  vec2 d = q - c;
  float r = length(d);
  float r0 = R * 0.6;
  float ink = max(hl(r - r0), hl(r - r0 * 0.28)) * 0.9;
  ink = max(ink, max(hl(d.y) * step(abs(d.x), R * 0.96), hl(d.x) * step(abs(d.y), R * 0.96)) * 0.9);
  vec2 tp = c + vec2(0.5 * r0 * (lv.b - lv.r), -0.6 * r0 * (lv.a * 1.8 - 0.7));
  float hitF = float(FRAMEINDEX) - clk.w;
  float ringB = hitF < 3.0 && clk.z > 0.5 ? hl(r - r0 * (1.0 + 0.22 * (hitF + 1.0))) : 0.0;
  float hot = max(inBox(q - tp, vec2(-3.5 * U), vec2(3.5 * U)), ringB);
  return vec3(ink, hot, 0.0);
}

// a type cell: window of the text sheet; 1..4 level fill (bass, mid, treble, rms) with a level hairline; 5 hot sweep per onset
vec3 pType(vec2 q, vec2 S, int v, int rot, vec3 src, int ch, vec4 clk) {
  vec2 tq = rot == 1 ? vec2(S.y - q.y, q.x) : (rot == 2 ? vec2(q.y, S.x - q.x) : q);
  float m = sheetC(src.xy * (RENDERSIZE / vec2(32.0, 18.0)) + tq / src.z, ch);
  float hot = 0.0;
  float line = 0.0;
  if (v >= 1 && v <= 4) {
    float lv = stLevel()[v - 1];
    float yl = S.y * (1.0 - lv);
    hot = m * step(yl, q.y);
    line = hl(q.y - yl) * 0.55 * step(0.03, lv);
  }
  if (v == 5) {
    float age = float(FRAMEINDEX) - clk.w;
    float x0 = S.x * (age / 7.0 - 0.18);
    hot = m * step(0.0, age) * step(age, 7.5) * step(x0, q.x) * step(q.x, x0 + S.x * 0.18) * step(0.5, clk.z);
  }
  return vec3(m, max(hot, line), 0.0);
}

// rules. 1: horizontal hairline; 2: vertical hairline; 3: baseline with a tick scale; 4..7: level bar (bass, mid, treble, rms);
// 8: ruled rows, one hairline per grid unit
vec3 pRule(vec2 q, vec2 S, int v) {
  float inx = step(-0.5, q.x) * step(q.x, S.x + 0.5);
  float iny = step(-0.5, q.y) * step(q.y, S.y + 0.5);
  if (v == 1) { return vec3(hl(q.y - S.y * 0.5) * inx, 0.0, 0.0); }
  if (v == 2) { return vec3(hl(q.x - S.x * 0.5) * iny, 0.0, 0.0); }
  if (v == 3) {
    float k = floor(q.x / (8.0 * U) + 0.5);
    float len = (mod(k, 5.0) < 0.5 ? 12.0 : 5.0) * U;
    float tk = step(abs(q.x - k * 8.0 * U), HW * 0.5 + 0.25) * step(S.y - len, q.y) * step(q.y, S.y);
    return vec3(max(hl(q.y - (S.y - HW * 0.5)) * inx, tk) * 0.85, 0.0, 0.0);
  }
  if (v >= 4 && v <= 7) { return levelBar(q, S, v - 4); }
  if (v == 8) {
    float rows = max(floor(S.y / UN.y + 0.5), 1.0);
    float k = floor(q.y / (S.y / rows) + 0.5);
    return vec3(hl(q.y - k * S.y / rows) * inx * 0.7, 0.0, 0.0);
  }
  return vec3(0.0);
}

float frameCov(int frame, vec2 q, vec2 S) {
  if (frame == 2) { return boxLnW(q, vec2(0.5 * HW), S - vec2(0.5 * HW), HW); }
  if (frame == 3) {
    vec2 a = min(q, S - q);
    float arm = 16.0 * U;
    float inb = step(-0.5, q.x) * step(q.x, S.x + 0.5) * step(-0.5, q.y) * step(q.y, S.y + 0.5);
    return max(hl(a.y - 0.5 * HW) * step(a.x, arm), hl(a.x - 0.5 * HW) * step(a.y, arm)) * inb;
  }
  return 0.0;
}

// Role 13, typefx: type that the shader warps every frame. The text sheet is a static mask, so every effect below samples
// it through a changed coordinate (slices, stretch, history shear, smear taps, echo copies, band-cut fills). The cell holds
// its place; the letters inside it move on the music. Variants: 1 micro-type field, 2 glyph window, 3 slit-scan word,
// 4 echo stack, 5 echo ripple, 6 type equalizer. A cell reads one text-sheet channel (0 R, 1 G, 2 B) through its src window.
// Hits (stHit): x is an onset pulse, y a beat pulse; both jump on the event frame and fall in `release` seconds.
// The input typeWarp scales every audio-driven warp below (0 holds the type still, 1 default, 1.5 harder).
vec2 gP;

float winM(vec2 tq, vec3 src, int ch) { return sheetC(src.xy * (RENDERSIZE / vec2(32.0, 18.0)) + tq / src.z, ch); }
// re-sharpen a magnified glyph edge back to about one pixel
float crisp(float m, float s) {
  float k = 0.5 / max(s, 1.0);
  return smoothstep(0.5 - k, 0.5 + k, m);
}
float edgeOf(float raw) { return clamp(4.0 * raw * (1.0 - raw), 0.0, 1.0); }
// history (x beat pulse signed per hit, y mid, z treble, w rms), delay in frames, linear between frames
vec4 stHist(float delay) {
  float d = clamp(delay, 0.0, 62.0);
  float i0 = floor(d);
  return mix(texelFetch(state, ivec2(63 - int(i0), 7), 0), texelFetch(state, ivec2(62 - int(i0), 7), 0), d - i0);
}
vec3 fxFootage(vec2 p) {
  if (!HAS_INPUT) { return inkColor.rgb * 0.4; }
  return footageBody(p, RENDERSIZE, 0.0, 0);
}

// micro-type lines live in the bottom band of the G sheet (5 lines from 84 percent of the height) and the B sheet (8 lines
// from 78 percent), one line per 2.5 percent of the height, as the text items microK and microM
vec3 microBand(int ch) { return ch == 1 ? vec3(0.84, 5.0, 0.025) : vec3(0.78, 8.0, 0.025); }

// rows of real text (system fonts through the sheet); each row is one spectrum band (bass at the bottom), lit up to its level,
// the front glyphs hot. Active rows pick another line and start on every onset. Returns (ink coverage, hot coverage).
vec2 microCov(vec2 q, vec2 S, vec4 clk, vec3 src, int ch) {
  if (ch == 0) { return vec2(0.0); }
  vec3 band = microBand(ch);
  float rowH = band.z * RENDERSIZE.y * src.z;
  float row = floor(q.y / rowH);
  float lvl = bandAt(clamp(1.0 - (row + 0.5) * rowH / S.y, 0.0, 1.0));
  float seed = row * 1.7 + step(0.3, lvl) * clk.z * 3.1;
  float line = floor(hash12(vec2(seed, 2.0)) * band.y);
  float xo = hash12(vec2(seed, 5.0)) * RENDERSIZE.x;
  vec2 sp = vec2(mod(q.x / src.z + xo, RENDERSIZE.x), band.x * RENDERSIZE.y + line * band.z * RENDERSIZE.y + (q.y - row * rowH) / src.z);
  float g = crisp(sheetC(sp, ch), src.z);
  float lit = step(q.x, lvl * S.x);
  float front = lit * step(lvl * S.x - q.x, 28.0 * U + 12.0) * step(0.25, lvl);
  return vec2(g * mix(0.2, 0.85, lit), g * front);
}

// 2: giant glyph window. Footage (or, with tone accent, a solid fill) shows through the letter with the micro-type running on
// over it; a hard extrusion (darker the deeper it goes) runs down-left behind it and grows on each onset; the letter stretches
// taller on the onset and tears into horizontal slices that jump sideways on every beat.
void fxGlyph(vec2 q, vec2 S, vec3 src, int ch, int tone, vec4 clk, vec3 cInk, vec3 cHot, inout vec3 col) {
  vec4 hit = stHit() * typeWarp;
  float band = floor(q.y / (S.y / 9.0));
  float h = hash12(vec2(band, clk.z * 1.37 + 5.0));
  float dx = (fract(h * 7.0) * 2.0 - 1.0) * step(0.4, h) * max(hit.y, hit.x * 0.45) * S.x * 0.13;
  vec2 qq = vec2(q.x - dx, S.y * 0.5 + (q.y - S.y * 0.5) / (1.0 + 0.2 * hit.x));
  float raw = winM(qq, src, ch);
  float m = crisp(raw, src.z);
  float reach = (30.0 + 90.0 * hit.x) * U;
  for (int i = 10; i >= 1; i--) {
    float t = float(i) / 10.0;
    float me = crisp(winM(qq - vec2(-0.8, 0.6) * reach * t, src, ch), src.z);
    col = mix(col, cHot * (1.0 - 0.6 * t), me);
  }
  bool solid = tone == 2;
  vec2 mc = microCov(gP, RENDERSIZE, clk, vec3(0.0, 0.0, 1.0), 2);
  vec3 f = solid ? cInk : mix(fxFootage(gP), groundColor.rgb, mc.x * 0.6);
  col = mix(col, f, m);
  col = mix(col, solid ? groundColor.rgb : cInk, edgeOf(raw) * 0.9);
}

// 3: slit-scan word. Every row reads the hit history (beat pulse, onsets at 0.4) at its own delay, so each hit enters at the
// bottom row and travels up the letters as a sideways shear (direction chosen per hit); rows inside a shear jitter; the word
// smears into a streak on the beat (onsets smear at 0.3). The footage stays still behind the moving letter window.
void fxSlit(vec2 q, vec2 S, vec3 src, int ch, vec4 clk, vec3 cInk, vec3 cHot, inout vec3 col) {
  vec4 hits = stHit() * typeWarp;
  float hp = max(hits.y, 0.3 * hits.x);
  float delay = (1.0 - clamp(q.y / S.y, 0.0, 1.0)) * 22.0;
  float sh = 0.0;
  for (int i = -2; i <= 2; i++) { sh += stHist(delay + float(i)).x * (i == 0 ? 0.32 : (abs(i) == 1 ? 0.22 : 0.12)); }
  sh *= typeWarp;
  float jit = (hash12(vec2(floor(q.y / max(U * 6.0, 2.0)), clk.z)) - 0.5) * abs(sh);
  float dx = sh * S.x * 0.075 + jit * S.x * 0.04;
  float dir = hash12(vec2(clk.z, 4.0)) < 0.5 ? 1.0 : -1.0;
  float len = S.x * 0.2 * hp;
  float streak = 0.0;
  for (int i = 1; i < 13; i++) {
    float t = float(i) / 12.0;
    streak = max(streak, crisp(winM(vec2(q.x - dx - dir * t * len, q.y), src, ch), src.z) * (1.0 - t));
  }
  float raw = winM(vec2(q.x - dx, q.y), src, ch);
  float m = crisp(raw, src.z);
  col = mix(col, cHot, streak * (1.0 - m));
  col = mix(col, fxFootage(gP), m);
  col = mix(col, cInk, edgeOf(raw) * 0.9);
}

// 4: echo stack. The word repeats 2..10 times (the count follows the rms and jumps by up to 4 on the beat frame, by 1.6 on
// an onset), each copy stepped up-right and a little larger, painted back to front: odd copies solid hot, even copies knocked
// out to the ground, every edge in ink, and the footage in the front copy.
void fxEcho(vec2 q, vec2 S, vec3 src, int ch, vec3 cInk, vec3 cHot, vec3 cGnd, inout vec3 col) {
  vec4 hits = stHit();
  int n = min(2 + int(floor(typeWarp * (4.0 * stLevel().a + 4.0 * max(hits.y, 0.4 * hits.x)) + 0.5)), 11);
  vec2 c = S * 0.5;
  vec2 stp = vec2(S.x * 0.017, -S.y * 0.034);
  for (int j = 0; j < 11; j++) {
    int k = n - 1 - j;
    if (k < 0) { break; }
    float sk = 1.0 + 0.05 * float(k);
    float raw = winM((q - c - stp * float(k)) / sk + c, src, ch);
    float m = crisp(raw, src.z * sk);
    bool odd = mod(float(k), 2.0) > 0.5;
    col = mix(col, odd ? cHot : cGnd, m);
    col = mix(col, cInk, edgeOf(raw) * (odd ? 0.95 : 0.8));
    if (k == 0) { col = mix(col, fxFootage(gP), m); }
  }
}

// 5: echo ripple. The word is ringed by 2..12 hairline outlines growing out of it from the centre of the cell (alternate rings
// hot, ink), the count following the rms and the beat as in the stack; the footage fills the word itself.
void fxRipple(vec2 q, vec2 S, vec3 src, int ch, vec3 cInk, vec3 cHot, inout vec3 col) {
  vec4 hits = stHit();
  int n = min(2 + int(floor(typeWarp * (5.0 * stLevel().a + 5.0 * max(hits.y, 0.4 * hits.x)) + 0.5)), 12);
  vec2 c = S * 0.5;
  for (int j = 0; j < 12; j++) {
    int k = n - 1 - j;
    if (k < 0) { break; }
    float raw = winM((q - c) / (1.0 + 0.11 * float(k)) + c, src, ch);
    if (k > 0) { col = mix(col, mod(float(k), 2.0) > 0.5 ? cHot : cInk, edgeOf(raw) * 0.9); continue; }
    col = mix(col, fxFootage(gP), crisp(raw, src.z));
    col = mix(col, cInk, edgeOf(raw) * 0.9);
  }
}

// 6: type equalizer. The word is the analyzer: every column of the letters is filled solid up to the level of the spectrum band
// under it (bass at the left); above the level the letters are only an outline over a dim footage ghost.
void fxEq(vec2 q, vec2 S, vec3 src, int ch, vec3 cInk, vec3 cHot, inout vec3 col) {
  float raw = winM(q, src, ch);
  float m = crisp(raw, src.z);
  float lv = clamp(bandAt(clamp(q.x / S.x, 0.0, 1.0)) + 0.3 * stHit().y * typeWarp, 0.0, 1.0);
  float on = step(S.y * (1.0 - lv), q.y);
  col = mix(col, fxFootage(gP), m * (1.0 - on) * 0.45);
  col = mix(col, cHot, m * on);
  col = mix(col, cInk, edgeOf(raw) * mix(0.9, 0.35, on));
}

void drawTypeFx(int v, vec4 aux, int ch, int tone, vec2 q, vec2 S, vec4 clk, vec3 cInk, vec3 cHot, inout vec3 col) {
  int rot = int(aux.x + 0.5);
  vec3 src = vec3(aux.yz, aux.w);
  vec2 tq = rot == 1 ? vec2(S.y - q.y, q.x) : (rot == 2 ? vec2(q.y, S.x - q.x) : q);
  vec2 TS = rot == 0 ? S : S.yx;
  if (v == 1) {
    vec2 mc = microCov(tq, TS, clk, src, ch);
    col = mix(col, cInk, mc.x);
    col = mix(col, cHot, mc.y);
  }
  if (v == 2) { fxGlyph(tq, TS, src, ch, tone, clk, cInk, cHot, col); }
  if (v == 3) { fxSlit(tq, TS, src, ch, clk, cInk, cHot, col); }
  if (v == 4) { fxEcho(tq, TS, src, ch, cInk, cHot, groundColor.rgb, col); }
  if (v == 5) { fxRipple(tq, TS, src, ch, cInk, cHot, col); }
  if (v == 6) { fxEq(tq, TS, src, ch, cInk, cHot, col); }
}

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

// Scene 1, specimen: a deep ultramarine field; the plate as a single-tone lavender dither inside a tall arch; one ultra-tall
// thin word as a column; pink and cyan micro bars on the arch edges that are spectrum band levels; a solid black square with a
// semicircle that snaps to a new place of a fixed set on every cut; mono captions with live numbers. Palette: ground (field),
// ink (lavender), accent (pink), tintA (cyan), tintB (black). Text set 1.
vec2 spPair(float i) {
  if (i < 0.5) { return vec2(1.44, 0.10); }
  if (i < 1.5) { return vec2(0.50, 0.70); }
  if (i < 2.5) { return vec2(1.44, 0.62); }
  if (i < 3.5) { return vec2(1.14, 0.78); }
  if (i < 4.5) { return vec2(0.50, 0.08); }
  return vec2(1.22, 0.34);
}

void sceneSpecimen(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 lav = inkColor.rgb;
  vec3 pink = accentColor.rgb;
  vec3 cyan = tintA.rgb;
  vec3 blk = tintB.rgb;
  col = groundColor.rgb;
  col = mix(col, mix(groundColor.rgb, blk, 0.45), scAA(sdBox(c, vec2(0.03, 0.035), vec2(0.70, 0.965))));
  vec2 lo = vec2(0.76, 0.07);
  vec2 hi = vec2(1.36, 0.93);
  // dithered plate in the arch
  float px = scPx();
  vec2 pix = floor(q / px);
  float inside = scAA(sdArch(c, lo, hi));
  float l = pow(scTone((pix + 0.5) * px, lo * scU, hi * scU, 1.6, 0.15), 0.65) * 0.92 + 0.08 * hit.y;
  col = mix(col, mix(mix(groundColor.rgb, blk, 0.6), lav, step(scBayer(pix), l)), inside);
  col = mix(col, lav, scLine(sdArch(c, lo - 0.016, hi + 0.016), 1.0));
  // band-level micro bars on the straight sides of the arch: pink on the left, cyan on the right
  float y0 = (lo.y + 0.5 * (hi.x - lo.x)) * scU;
  float y1 = (hi.y - 0.02) * scU;
  float row = floor((q.y - y0) / 4.0);
  float t = clamp((row * 4.0 + 2.0) / (y1 - y0), 0.0, 1.0);
  float inRow = step(0.0, q.y - y0) * step(q.y, y1) * step(mod(q.y - y0, 4.0), 2.0);
  float lenL = floor((0.012 + 0.095 * bandAt(t)) * scU / 2.0) * 2.0;
  float lenR = floor((0.012 + 0.095 * bandAt(1.0 - t * 0.8)) * scU / 2.0) * 2.0;
  float xl = (lo.x - 0.016) * scU;
  float xr = (hi.x + 0.016) * scU;
  col = mix(col, pink, inRow * step(xl - lenL, q.x) * step(q.x, xl - 1.0));
  col = mix(col, cyan, inRow * step(xr + 1.0, q.x) * step(q.x, xr + lenR));
  // rules, ticks and a dot grid
  float rule = max(scLine(c.y - 0.035, 1.0), scLine(c.y - 0.965, 1.0)) * step(0.05, c.x) * step(c.x, A - 0.05);
  float tick = step(mod(q.x, 0.04 * scU), 1.0) * step(abs(c.y - 0.965), 0.014) * step(0.05, c.x) * step(c.x, A - 0.05);
  col = mix(col, lav, max(rule * 0.8, tick * 0.8));
  col = mix(col, lav, max(max(scPlus(c, vec2(0.03, 0.035), 0.016), scPlus(c, vec2(0.70, 0.035), 0.016)), max(scPlus(c, vec2(0.03, 0.965), 0.016), scPlus(c, vec2(0.70, 0.965), 0.016))));
  vec2 dg = (c - vec2(1.44, 0.83)) / 0.026;
  float dots = scAA((length(fract(dg) - 0.5) * 0.026 - 0.004)) * step(0.0, dg.x) * step(dg.x, 9.0) * step(0.0, dg.y) * step(dg.y, 4.0);
  col = mix(col, lav, dots * 0.7);
  // the tall word: Pretendard Thin stretched up and squeezed in
  float w = scWordThin(q, vec2(0.05, -0.05) * scU, vec2(0.0, 0.0), vec2(0.35, 1.43), 0, 3.5);
  col = mix(col, lav, w);
  // the black square and semicircle: a new place of the fixed set on every cut
  float i = mod(floor(clk.x) * 5.0 + floor(hash12(vec2(floor(clk.x / 6.0), 7.0)) * 6.0), 6.0);
  vec2 P = spPair(i);
  float s = 0.13;
  float sq = scAA(sdBox(c, P, P + s));
  vec2 sc = P + vec2(s, 0.5 * s);
  sc.x += 0.03;
  float semi = scAA(max(length(c - sc) - 0.5 * s, -(c.x - sc.x)));
  col = mix(col, blk, max(sq, semi));
  // captions and live numbers (MesloLGS NF)
  col = mix(col, lav, scSheet(q, 1));
  vec2 np = q - vec2(1.44, 0.50) * scU;
  float fs = 0.03 * scU;
  float num = aNum(np, fs, floor(stLevel().r * 99.0), 2) + aNum(np - vec2(3.0 * MONO_ADV * fs, 0.0), fs, floor(stLevel().g * 99.0), 2) + aNum(np - vec2(6.0 * MONO_ADV * fs, 0.0), fs, floor(stLevel().b * 99.0), 2);
  col = mix(col, pink, min(num, 1.0));
}

// Scene 2, wiring: a black ground, the plate as a cyan / yellow duotone with scanline bands that re-seed on every cut, five yellow
// cables from fixed points on the CRT wall to boxed annotations (small Monument Extended caps and live readouts in a pixel font),
// quarter pixel arcs and a dot grid in the bottom-left corner, and a small crimson pixel glyph that blinks on every onset.
// Each onset sends a packet down the next cable and flashes its box. Palette: ground (black), ink (label white), accent (yellow),
// tintA (cyan), tintB (crimson). Text set 2.
const vec2 W_A[5] = vec2[5](vec2(0.663, 0.4355), vec2(0.573, 0.5775), vec2(0.663, 0.7195), vec2(1.115, 0.4355), vec2(1.025, 0.7195));
const vec2 W_B[5] = vec2[5](vec2(0.05, 0.14), vec2(0.05, 0.40), vec2(0.05, 0.62), vec2(1.43, 0.10), vec2(1.43, 0.62));
const vec2 W_SZ = vec2(0.30, 0.105);
const int W_GLYPH[7] = int[7](20, 62, 107, 127, 62, 34, 65);

vec2 wTail(int i) { return W_B[i] + (i < 3 ? vec2(W_SZ.x, 0.5 * W_SZ.y) : vec2(0.0, 0.5 * W_SZ.y)); }
vec2 wElbow(vec2 A, vec2 T) { return vec2(T.x + sign(A.x - T.x) * abs(A.y - T.y), T.y); }
float wCable(vec2 c, vec2 A, vec2 T, float w) {
  vec2 E = wElbow(A, T);
  return max(scLine(sdSeg(c, A, E), w), scLine(sdSeg(c, E, T), w));
}
vec2 wAlong(vec2 A, vec2 T, float t) {
  vec2 E = wElbow(A, T);
  float l1 = length(E - A);
  float d = t * (l1 + length(T - E));
  return d < l1 ? mix(A, E, d / max(l1, 1e-4)) : mix(E, T, (d - l1) / max(length(T - E), 1e-4));
}

void sceneWiring(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 white = inkColor.rgb;
  vec3 yel = accentColor.rgb;
  vec3 cyan = tintA.rgb;
  vec3 red = tintB.rgb;
  float cut = floor(clk.x);
  // plate: cyan / yellow duotone, scanline bands re-seeded on the cut, one slice thrown sideways on the beat
  float sliceY = hash12(vec2(cut, 3.0));
  float shift = step(abs(c.y - sliceY), 0.025) * hit.y * 0.05 * scU;
  float l = clamp((luma(scPlate(q + vec2(shift, 0.0), vec2(0.0), S)) - 0.1) * 1.5, 0.0, 1.0);
  vec3 d = mix(groundColor.rgb, cyan * 0.45, smoothstep(0.0, 0.4, l));
  d = mix(d, cyan, smoothstep(0.35, 0.7, l));
  d = mix(d, yel, smoothstep(0.66, 0.95, l));
  float band = step(0.62, hash12(vec2(floor(c.y / 0.03), cut)));
  d *= (1.0 - 0.22 * step(0.5, fract(c.y / 0.012))) * (1.0 - 0.5 * band);
  d *= mix(0.45, 1.0, smoothstep(1.05, 0.3, length((c - vec2(0.5 * A, 0.5)) * vec2(0.8, 1.2))));
  col = d;
  // cables and anchors
  int act = int(mod(clk.z, 5.0));
  float age = float(FRAMEINDEX) - clk.w;
  for (int i = 0; i < 5; i++) {
    vec2 T = wTail(i);
    bool on = i == act && clk.z > 0.5;
    float flash = on ? step(0.3, hit.x) : 0.0;
    col = mix(col, vec3(0.0), wCable(c, W_A[i], T, 4.0) * 0.85);
    col = mix(col, mix(yel, white, flash), wCable(c, W_A[i], T, on ? 2.0 : 1.2));
    float ring = scLine(length(c - W_A[i]) - 0.014, 1.2);
    col = mix(col, vec3(0.0), scAA(length(c - W_A[i]) - 0.018) * 0.5);
    col = mix(col, yel, max(ring, scAA(sdBox(c, W_A[i] - 0.004, W_A[i] + 0.004))));
    if (on && age < 9.0) {
      vec2 pp = wAlong(W_A[i], T, (age + 1.0) / 9.0);
      col = mix(col, white, scAA(sdBox(c, pp - 0.007, pp + 0.007)));
    }
    // box: black plate, yellow outline, a live readout in the pixel font and a segmented level bar
    float bf = scAA(sdBox(c, W_B[i], W_B[i] + W_SZ));
    col = mix(col, mix(vec3(0.0), yel, flash), bf * 0.9);
    col = mix(col, yel, scLine(sdBox(c, W_B[i], W_B[i] + W_SZ), 1.0));
    float lev = bandAt(0.06 + 0.2 * float(i));
    float cell = cellPx(0.0062 * scU);
    vec2 np = q - (W_B[i] + vec2(0.014, 0.058)) * scU;
    float num = numTxt(np, vec2(0.0), cell, floor(lev * 999.0), 3);
    vec2 bp = (c - (W_B[i] + vec2(0.115, 0.064))) / vec2(0.17, 0.02);
    float seg = step(0.0, bp.x) * step(bp.x, 1.0) * step(0.0, bp.y) * step(bp.y, 1.0) * step(mod(bp.x * 14.0, 1.0), 0.62);
    float litSeg = step(bp.x, lev);
    col = mix(col, mix(flash > 0.5 ? vec3(0.0) : yel, cyan, 1.0 - litSeg), seg * mix(0.35, 1.0, litSeg));
    col = mix(col, flash > 0.5 ? vec3(0.0) : yel, min(num, 1.0));
  }
  // pixel arcs and a dot grid, bottom-left
  float px = scPx();
  vec2 pc = (floor(q / px) + 0.5) * px - vec2(0.0, S.y);
  float r = length(pc) / scU;
  float ring = floor((r - 0.05) / 0.036);
  float ang = atan(-pc.y, pc.x) / 1.5708;
  float seg = floor(ang * (5.0 + ring));
  float arc = step(0.0, ring) * step(ring, 5.0) * step(fract((r - 0.05) / 0.036), 0.55) * step(0.0, ang) * step(ang, 1.0) * step(mod(seg + cut * (ring + 1.0), 3.0), 1.5);
  col = mix(col, yel, arc);
  vec2 dg = (c - vec2(0.27, 0.935)) / 0.026;
  float dots = scAA(length(fract(dg) - 0.5) * 0.026 - 0.004) * step(0.0, dg.x) * step(dg.x, 12.0) * step(0.0, dg.y) * step(dg.y, 2.0);
  col = mix(col, cyan, dots);
  // the crimson pixel glyph: dim, full for 5 frames after every onset
  vec2 gp = floor((c - vec2(0.405, 0.052)) / 0.0118);
  float gl = 0.0;
  if (gp.x >= 0.0 && gp.x < 7.0 && gp.y >= 0.0 && gp.y < 7.0) { gl = float((W_GLYPH[int(gp.y)] >> (6 - int(gp.x))) & 1); }
  col = mix(col, red * (age < 5.0 && clk.z > 0.5 ? 1.0 : 0.3), gl);
  // letterbox, corner brackets, label caps (Monument Extended)
  col = mix(col, vec3(0.0), scAA(sdBox(c, vec2(-1.0), vec2(A + 1.0, 0.045))) + scAA(sdBox(c, vec2(-1.0, 0.955), vec2(A + 1.0, 2.0))));
  vec2 a = min(c - 0.012, vec2(A, 1.0) - c - 0.012);
  col = mix(col, white, max(scLine(a.y, 1.0) * step(a.x, 0.03), scLine(a.x, 1.0) * step(a.y, 0.03)) * step(0.0, min(a.x, a.y) + 0.001));
  col = mix(col, white, scSheet(q, 0) * 0.9);
}

// Scene 3, field-cut: a collage over time. Every beat hard-cuts to the next of four full fields, each with its own fixed
// composition: acid lime with a halftone of the plate, a black dot-matrix tower whose height is the bass and rule marks;
// signal orange with rows of a condensed blue word that shear on every onset and a blue dither window of the plate; ultramarine
// with the plate in a ringed circle, a Hangul word and checker blocks; a white field with the plate torn into RGB pixel slabs and
// a lime brush chunk. Palette: ground (black), ink (white), accent (lime), tintA (orange), tintB (ultramarine).
// Text set 3: r the condensed word, g the Hangul word, b the labels.
void fcLime(vec2 q, vec2 c, vec4 hit, inout vec3 col) {
  vec3 blk = groundColor.rgb;
  col = accentColor.rgb;
  vec2 lo = vec2(0.07, 0.10);
  vec2 hi = vec2(0.95, 0.68);
  float pitch = max(3.0, 14.0 * U);
  col = mix(col, blk, scDots(q, lo * scU, hi * scU, pitch, 1.5, 0.15, 1.0) * scBox(c, lo, hi));
  col = mix(col, blk, max(max(scPlus(c, lo - 0.03, 0.02), scPlus(c, vec2(hi.x + 0.03, lo.y - 0.03), 0.02)), max(scPlus(c, vec2(lo.x - 0.03, hi.y + 0.03), 0.02), scPlus(c, hi + 0.03, 0.02))));
  // the bass tower: 6 x 28 dots, lit from the bottom up to the bass level
  float lv = stLevel().r;
  vec2 tg = (c - vec2(1.07, 0.93)) / vec2(0.026, -0.026);
  vec2 id = floor(tg);
  if (id.x >= 0.0 && id.x < 6.0 && id.y >= 0.0 && id.y < 28.0) {
    float h = (lv * 26.0 + 2.0 + 3.0 * hit.y) * (1.0 - 0.2 * hash12(vec2(id.x, 3.0)));
    float lit = step(id.y + 0.5, h);
    col = mix(col, blk, scAA(length(fract(tg) - 0.5) * 0.026 - mix(0.0035, 0.0115, lit)) * mix(0.4, 1.0, lit));
  }
  // label bar, live number, rule with ticks, readout rows
  col = mix(col, blk, scAA(sdBox(c, vec2(1.36, 0.14), vec2(1.72, 0.27))));
  col = mix(col, accentColor.rgb, scSheet(q, 2) * scBox(c, vec2(1.36, 0.14), vec2(1.72, 0.27)));
  float cell = cellPx(0.0125 * scU);
  col = mix(col, blk, min(numTxt(q, vec2(1.36, 0.31) * scU, cell, floor(lv * 999.0), 3), 1.0));
  col = mix(col, blk, max(scLine(c.y - 0.76, 1.0), step(mod(q.x, 0.04 * scU), 1.0) * step(abs(c.y - 0.77), 0.012)) * step(0.07, c.x) * step(c.x, 1.72));
  float rc = scCell();
  float rows = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 o = vec2(1.36, 0.47 + 0.075 * float(i)) * scU;
    float v = floor(stLevel()[i] * 999.0);
    rows = max(rows, i == 0 ? txt4(q, o, rc, 66, 83, 83, 0) : (i == 1 ? txt4(q, o, rc, 77, 73, 68, 0) : txt4(q, o, rc, 84, 82, 66, 0)));
    rows = max(rows, numTxt(q, o + vec2(16.0 * rc, 0.0), rc, v, 3));
    rows = max(rows, scBox(c, vec2(1.36, 0.47 + 0.075 * float(i) + 0.05), vec2(1.36 + 0.36 * stLevel()[i], 0.47 + 0.075 * float(i) + 0.056)));
  }
  col = mix(col, blk, rows);
  col = mix(col, blk, scBox(c, vec2(0.07, 0.82), vec2(0.07 + 0.88 * hit.y, 0.84)));
  col = mix(col, blk, numTxt(q, vec2(0.07, 0.88) * scU, rc, mod(float(FRAMEINDEX), 1000.0), 3));
}

void fcOrange(vec2 q, vec2 c, vec4 clk, vec4 hit, inout vec3 col) {
  vec3 blue = tintB.rgb;
  vec3 blk = groundColor.rgb;
  col = tintA.rgb;
  float row = floor((c.y - 0.035) / 0.134);
  float ry = q.y - (0.035 + row * 0.134) * scU;
  float h = hash12(vec2(row, clk.z));
  float shear = (fract(h * 7.0) < 0.5 ? -1.0 : 1.0) * (0.06 + 0.1 * fract(h * 11.0)) * step(0.45, hit.x) * step(h, 0.3) * scU;
  float pitch = 0.43 * scU;
  float lx = mod(q.x - (mod(row, 2.0) * 0.215 + 0.02) * scU - shear, pitch);
  float k = scS.y / RENDERSIZE.y;
  float m = crisp(sheetC(vec2(lx / (0.4 * k), 0.0333 * RENDERSIZE.y + (ry - 0.006 * scU) / (0.5 * k)), 0), 1.0) * step(0.0, row) * step(row, 6.0) * step(0.0, ry);
  col = mix(col, blue, m);
  vec2 lo = vec2(0.62, 0.38);
  vec2 hi = vec2(1.20, 0.66);
  float px = scPx();
  vec2 pix = floor(q / px);
  float win = scBox(c, lo, hi);
  float l = scTone((pix + 0.5) * px, lo * scU, hi * scU, 1.7, 0.2);
  col = mix(col, mix(tintA.rgb, blue, step(scBayer(pix), l)), win);
  col = mix(col, blk, max(scLine(sdBox(c, lo, hi), 1.5), max(max(scPlus(c, vec2(0.26, 0.20), 0.025), scPlus(c, vec2(1.45, 0.86), 0.025)), scPlus(c, vec2(1.62, 0.18), 0.025))));
  float cell = scCell();
  col = mix(col, blk, max(txt4(q, vec2(0.62, 0.68) * scU, cell, 82, 79, 87, 0), numTxt(q, vec2(0.62 + 0.06, 0.68) * scU, cell, mod(row + clk.z, 100.0), 2)));
}

void fcBlue(vec2 q, vec2 c, vec4 clk, inout vec3 col) {
  vec3 white = inkColor.rgb;
  col = tintB.rgb;
  vec2 ctr = vec2(1.22, 0.50);
  float R = 0.34;
  float d = length(c - ctr);
  vec3 f = clamp((scPlate(q, (ctr - R) * scU, (ctr + R) * scU) - 0.12) * 1.5, 0.0, 1.0);
  col = mix(col, f, scAA((d - R) * 1.0));
  float a = atan(c.y - ctr.y, c.x - ctr.x) / 6.28318;
  float tk = fract(a * 48.0 + floor(clk.x) * 0.5);
  float tickR = step(R + 0.07, d) * step(d, R + 0.07 + 0.03 * (mod(floor(a * 48.0 + floor(clk.x) * 0.5), 4.0) < 0.5 ? 1.8 : 1.0)) * step(tk, 0.16);
  col = mix(col, white, max(max(scLine(d - R - 0.025, 1.0), scLine(d - R - 0.05, 1.0) * step(fract(a * 24.0), 0.6)), tickR));
  col = mix(col, white, scSheet(q, 1));
  col = mix(col, groundColor.rgb, scAA(sdBox(c, vec2(0.07, 0.66), vec2(0.74, 0.76))));
  col = mix(col, accentColor.rgb, scSheet(q, 2) * scBox(c, vec2(0.07, 0.66), vec2(0.74, 0.76)));
  vec2 ck = floor((c - vec2(0.07, 0.83)) / 0.02);
  float chk = step(0.0, ck.x) * step(ck.x, 15.0) * step(0.0, ck.y) * step(ck.y, 4.0) * step(1.0, mod(ck.x + ck.y, 2.0));
  col = mix(col, groundColor.rgb, chk);
  col = mix(col, white, max(scPlus(c, vec2(0.05, 0.05), 0.02), scPlus(c, vec2(0.76, 0.05), 0.02)));
}

void fcWhite(vec2 q, vec2 c, float A, vec4 clk, vec4 hit, inout vec3 col) {
  vec3 blk = groundColor.rgb;
  col = inkColor.rgb;
  vec2 lo = vec2(0.06, 0.06);
  vec2 hi = vec2(A - 0.06, 0.94);
  float amt = 0.3 + 0.7 * step(0.7, hit.y);
  vec2 sl = floor(c / vec2(0.2, 0.045));
  float hs = hash12(vec2(sl.y, floor(clk.x) + 0.37 * sl.x));
  float off = step(0.55, hs) * (fract(hs * 13.0) - 0.5) * 0.18 * amt * scU;
  vec2 qq = q + vec2(off, 0.0);
  if (hs > 0.88) { qq = (floor(qq / 14.0) + 0.5) * 14.0; }
  float sp = 0.014 * amt * scU * step(0.5, hs);
  vec3 f = vec3(scPlate(qq + vec2(sp, 0.0), lo * scU, hi * scU).r, scPlate(qq, lo * scU, hi * scU).g, scPlate(qq - vec2(sp, 0.0), lo * scU, hi * scU).b);
  col = mix(col, clamp((f - 0.1) * 1.3, 0.0, 1.0), scBox(c, lo, hi));
  float ragged = 0.72 - 0.08 * hash12(vec2(floor(c.y / 0.012), 1.0)) - 0.1 * hit.y;
  col = mix(col, accentColor.rgb, scBox(c, vec2(0.30, 0.46), vec2(ragged, 0.54)));
  float cell = scCell();
  col = mix(col, blk, max(txt4(q, vec2(0.07, 0.955) * scU, cell, 70, 82, 77, 0), numTxt(q, vec2(0.07 + 0.045, 0.955) * scU, cell, mod(float(FRAMEINDEX), 1000.0), 3)));
  col = mix(col, blk, max(scPlus(c, vec2(0.03, 0.03), 0.018), scPlus(c, vec2(A - 0.03, 0.03), 0.018)));
}

void sceneFieldCut(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  vec4 hit = stHit();
  int f = int(mod(floor(clk.x * 0.5), 4.0));
  if (f == 0) { fcLime(q, c, hit, col); }
  if (f == 1) { fcOrange(q, c, clk, hit, col); }
  if (f == 2) { fcBlue(q, c, clk, col); }
  if (f == 3) { fcWhite(q, c, S.x / S.y, clk, hit, col); }
}

// Scene 4, pattern-sheet: a bone sheet inside a signal-green frame border. The plate is a black line-screen engraving inside the
// big circle; a heavy grotesk label between magenta serif quote marks; outline circles whose radius steps on every onset; thin
// rules, ticks and crosshairs; QR-like pixel stamps that re-seed on every beat; a vertical waveform strip with a 0 to 5 ruler on the
// left edge. Palette: ground (frame green), ink (black), accent (magenta), tintA (bone). Text set 4: r the label and caption,
// g the quote marks.
void scenePattern(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 ink = inkColor.rgb;
  vec3 mag = accentColor.rgb;
  vec3 bone = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  col = mix(col, bone, scAA(sdBox(c, vec2(0.05), vec2(A - 0.05, 0.95))));
  // the big circle with the plate as a horizontal line screen
  vec2 ctr = vec2(1.30, 0.46);
  float R = 0.31;
  float pitch = max(3.0, 8.0 * U);
  float yc = (floor(q.y / pitch) + 0.5) * pitch;
  float l = scTone(vec2(q.x, yc), (ctr - R) * scU, (ctr + R) * scU, 1.5, 0.12);
  float line = clamp(((1.0 - l) * 0.95 * pitch * 0.5) - abs(q.y - yc) + 0.5, 0.0, 1.0);
  float inC = scAA(length(c - ctr) - R);
  col = mix(col, mix(bone, ink, line), inC);
  col = mix(col, ink, scLine(length(c - ctr) - R, 1.6));
  // outline circles; the radii step on every onset
  float st = mod(clk.z, 5.0);
  col = mix(col, ink, scLine(length(c - vec2(0.98, 0.74)) - (0.14 + 0.014 * st), 1.2));
  col = mix(col, ink, scLine(length(c - vec2(0.98, 0.74)) - (0.2 + 0.014 * st), 1.2) * step(0.0, sin(atan(c.y - 0.74, c.x - 0.98) * 18.0 + 1.0)));
  col = mix(col, mag, scLine(length(c - vec2(1.62, 0.80)) - (0.06 + 0.012 * st), 2.0));
  col = mix(col, ink, scLine(length(c - vec2(1.62, 0.80)) - 0.1, 1.0));
  // rules, ticks and crosshairs
  float ex = step(0.2, c.x) * step(c.x, A - 0.05);
  col = mix(col, ink, max(scLine(c.y - 0.87, 1.2) * ex, step(mod(q.x, 0.025 * scU), 1.0) * step(abs(c.y - 0.885), 0.013) * ex));
  col = mix(col, ink, scLine(c.x - 0.92, 1.0) * step(0.05, c.y) * step(c.y, 0.32) * 0.9);
  col = mix(col, ink, scLine((c.x - 0.2) - (0.95 - c.y), 1.0) * step(0.2, c.x) * step(c.x, 0.5) * step(0.75, c.y) * 0.8);
  col = mix(col, ink, scAA(length(c - vec2(0.92, 0.87)) - 0.016));
  col = mix(col, mag, scAA(length(c - vec2(1.62, 0.80)) - 0.016));
  for (int i = 0; i < 4; i++) {
    vec2 p = vec2(0.26 + 0.52 * float(i), 0.46);
    col = mix(col, ink, max(scLine(c.y - p.y, 1.0) * step(abs(c.x - p.x), 0.018), scLine(c.x - p.x, 1.0) * step(abs(c.y - p.y), 0.018)) * step(float(i), 1.5));
  }
  // QR stamps, re-seeded on the beat
  float q1 = scQR(c, vec2(0.25, 0.09), 0.17, cut);
  float q2 = scQR(c, vec2(0.62, 0.09), 0.11, cut + 41.0);
  col = mix(col, ink, step(0.5, q1));
  col = mix(col, ink, step(-0.5, q2));
  col = mix(col, bone, step(0.5, q2));
  // the vertical waveform strip and its 0..5 ruler
  float t = clamp((c.y - 0.09) / 0.82, 0.0, 1.0);
  float amp = clamp(waveI(floor(t * 255.0) * 2.0) * scopeGain * 0.08, -0.028, 0.028);
  float rowOn = step(mod(q.y, 2.0), 1.0);
  float wv = step(0.075, c.x) * step(c.x, 0.135) * step(0.09, c.y) * step(c.y, 0.91) * rowOn * step(abs(c.x - 0.105), abs(amp) + 0.0015);
  col = mix(col, ink, wv);
  col = mix(col, ink, scLine(sdBox(c, vec2(0.075, 0.09), vec2(0.135, 0.91)), 1.0));
  float rk = (c.y - 0.09) / 0.82 * 25.0;
  float major = step(abs(rk - floor(rk / 5.0 + 0.5) * 5.0), 0.12) * step(0.0, rk) * step(rk, 25.2);
  float minor = step(abs(rk - floor(rk + 0.5)), 0.12) * step(0.0, rk) * step(rk, 25.2);
  col = mix(col, ink, max(major * step(0.14, c.x) * step(c.x, 0.165), minor * step(0.14, c.x) * step(c.x, 0.152)));
  float dc = scCell();
  for (int i = 0; i < 6; i++) { col = mix(col, ink, numTxt(q, vec2(0.172, 0.09 + 0.164 * float(i) - 0.012) * scU, dc, float(i), 1)); }
  // the label and the quote marks
  col = mix(col, ink, scSheet(q, 0));
  col = mix(col, mag, scSheet(q, 1));
}

// Scene 5, anatomy: a sepia paper field, a huge cropped serif numeral, a dark panel holding the plate as a cream hairline wireframe
// (edge detection), a thin ring around it, three callout cables to labels, a checkerboard tower of the mid level and tiny code
// columns. The wireframe grows denser on every beat and a rust scan band jumps to a new height on every cut, turning the lines it
// crosses rust. Palette: ground (tan paper), ink (umber), accent (rust), tintA (dark umber), tintB (cream). Text set 5: Times and
// Pretendard Light.
void sceneAnatomy(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 ink = inkColor.rgb;
  vec3 rust = accentColor.rgb;
  vec3 dark = tintA.rgb;
  vec3 cream = tintB.rgb;
  col = groundColor.rgb;
  col = mix(col, ink, scSheet(q, 0));
  vec2 lo = vec2(0.52, 0.05);
  vec2 hi = vec2(1.30, 0.95);
  float inP = scBox(c, lo, hi);
  col = mix(col, dark, inP);
  float e = scEdge(q, lo * scU, hi * scU, max(1.5, 4.0 * U));
  float thr = 0.1 - 0.05 * hit.y;
  float wire = smoothstep(thr, thr + 0.07, e) * inP;
  float bandY = 0.08 + 0.84 * fract(floor(clk.x) * 0.137);
  float inBand = step(abs(c.y - bandY), 0.03);
  col = mix(col, cream, 0.14 * inBand * inP);
  col = mix(col, mix(cream, rust, inBand), wire);
  col = mix(col, ink, scLine(sdBox(c, lo, hi), 1.0));
  // ring and ticks around the panel
  vec2 ctr = vec2(0.91, 0.5);
  float d = length(c - ctr);
  float a = atan(c.y - ctr.y, c.x - ctr.x) / 6.28318;
  col = mix(col, ink, max(scLine(d - 0.47, 1.0), scLine(d - 0.5, 1.0) * step(fract(a * 90.0), 0.35)));
  // callout cables and labels
  for (int i = 0; i < 3; i++) {
    vec2 A0 = i == 0 ? vec2(1.05, 0.42) : (i == 1 ? vec2(0.98, 0.58) : vec2(0.9, 0.7));
    vec2 T = vec2(1.38, 0.2 + 0.3 * float(i));
    col = mix(col, ink, wCable(c, A0, T, 1.0));
    col = mix(col, rust, scAA(sdBox(c, A0 - 0.006, A0 + 0.006)));
  }
  // checkerboard tower of the mid level, tiny code columns
  vec2 tg = floor((c - vec2(0.45, 0.95)) / vec2(0.02, -0.02));
  float h = stLevel().g * 20.0 + 2.0;
  col = mix(col, ink, step(0.0, tg.x) * step(tg.x, 2.0) * step(0.0, tg.y) * step(tg.y + 0.5, h) * step(mod(tg.x + tg.y, 2.0), 0.5));
  float cell = scCell();
  float code = 0.0;
  for (int i = 0; i < 9; i++) { code = max(code, numTxt(q, vec2(1.40, 0.82 + 0.014 * float(i)) * scU, max(1.0, cell - 1.0), floor(hash12(vec2(float(i), clk.x)) * 9999.0), 4)); }
  col = mix(col, rust, code);
  col = mix(col, ink, scSheet(q, 1));
}

// Scene 6, deck: a hot pink field and a HUD deck of thin black lines. The plate sits in a chamfered octagon window; outlined
// tab-box labels (DIN Condensed, Pretendard) down the left, a particle cloud box that scatters on the onset, a starburst glyph
// whose rays are band levels and which steps round on every beat, a text ring that turns a notch per onset, a contour-map box whose
// terrain shifts on the beat, and a 0..5 ruler strip. Palette: ground (pink), ink (black), accent (white), tintA (lilac).
// Text set 6: r the tab labels, g captions, b the ring line.
float dkRing(vec2 q, vec2 ctr, float Rm, float band, float rot) {
  vec2 d = q - ctr;
  float r = length(d);
  float a = atan(d.y, d.x) / 6.28318 + 0.5 + rot;
  float k = scS.y / RENDERSIZE.y;
  vec2 sp = vec2(fract(a) * 6.28318 * Rm / k, 0.9 * RENDERSIZE.y + (Rm + 0.5 * band - r) / k);
  return sheetC(sp, 2) * step(abs(r - Rm), 0.5 * band);
}

void sceneDeck(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 ink = inkColor.rgb;
  vec3 white = accentColor.rgb;
  vec3 lil = tintA.rgb;
  col = groundColor.rgb;
  float cut = floor(clk.x);
  // octagon window with the plate
  vec2 lo = vec2(0.40, 0.08);
  vec2 hi = vec2(1.38, 0.74);
  float dO = sdChamfer(c, lo, hi, 0.2);
  vec3 f = scPlate(q, lo * scU, hi * scU);
  col = mix(col, clamp((f - 0.1) * 1.3, 0.0, 1.0), scAA(dO));
  col = mix(col, ink, scLine(dO, 2.0));
  col = mix(col, ink, scLine(sdChamfer(c, lo - 0.014, hi + 0.014, 0.23), 1.0));
  // particle cloud box (left), scatters on the onset
  vec2 pl = vec2(0.03, 0.46);
  vec2 ph = vec2(0.33, 0.9);
  float inBox = scBox(c, pl, ph);
  col = mix(col, lil, inBox);
  col = mix(col, ink, scLine(sdBox(c, pl, ph), 1.0));
  if (inBox > 0.5) {
    float dots = 0.0;
    for (int i = 0; i < 70; i++) {
      vec2 h = hash22(vec2(float(i), 3.7));
      float t = (h.x - 0.5) * 1.6;
      vec2 p = vec2(0.18, 0.68) + vec2(t * 0.1, -t * 0.12) + (hash22(vec2(float(i), 9.1)) - 0.5) * 0.07;
      p += (hash22(vec2(float(i), clk.z)) - 0.5) * 0.12 * step(0.45, hit.x);
      dots = max(dots, scAA(length(c - p) - 0.0035));
    }
    col = mix(col, ink, dots);
  }
  // starburst glyph, top right, one notch per beat
  vec2 sb = vec2(1.58, 0.2);
  col = mix(col, ink, scBurst(c - sb, 0.12, 0.012, cut * 0.2618, 36.0));
  col = mix(col, white, scAA(sdBox(c, sb - 0.008, sb + 0.008)));
  // text ring, bottom right, a notch per onset
  vec2 rc = vec2(1.58, 0.52);
  col = mix(col, ink, dkRing(q, rc * scU, 0.11 * scU, 0.03 * scU, clk.z * 0.04));
  col = mix(col, ink, scLine(length(c - rc) - 0.075, 1.0));
  // contour map box, bottom right, terrain shifts on the beat
  vec2 ml = vec2(0.98, 0.78);
  vec2 mh = vec2(1.72, 0.96);
  float inM = scBox(c, ml, mh);
  col = mix(col, lil, inM);
  float v = fbm(c * vec2(5.0, 7.0) + cut * 0.9, 4) * 9.0;
  float iso = clamp(1.0 - abs(fract(v) - 0.5) * 2.0 / max(fwidth(v) * 1.5, 1e-3), 0.0, 1.0);
  col = mix(col, ink, iso * inM * 0.9);
  col = mix(col, ink, scLine(sdBox(c, ml, mh), 1.0));
  float cell = scCell();
  col = mix(col, ink, numTxt(q, vec2(0.98, 0.745) * scU, cell, mod(cut * 37.0 + 1275.0, 10000.0), 4));
  // ruler strip, bottom left
  float rk = (c.x - 0.03) / 0.3 * 25.0;
  float major = step(abs(rk - floor(rk / 5.0 + 0.5) * 5.0), 0.2) * step(0.0, rk) * step(rk, 25.2);
  float minor = step(abs(rk - floor(rk + 0.5)), 0.2) * step(0.0, rk) * step(rk, 25.2);
  col = mix(col, ink, max(major * step(0.93, c.y) * step(c.y, 0.975), minor * step(0.93, c.y) * step(c.y, 0.953)));
  float amp = waveI(floor(clamp(rk, 0.0, 25.0) / 25.0 * 255.0) * 2.0) * scopeGain * 0.03;
  col = mix(col, ink, scLine(c.y - 0.915 - amp, 1.2) * step(0.0, rk) * step(rk, 25.0));
  // labels in tab boxes, captions
  col = mix(col, ink, scSheet(q, 0));
  col = mix(col, ink, scSheet(q, 1));
}

// Scene 7, bootlog: phosphor green on near-black. A typed boot log (the engine types it over the clip), a dot-matrix terminal icon,
// a boot progress bar that fills a step on every beat, a big Hangul word, the plate as a single-tone phosphor CRT with raster
// lines and a ghost, a roll bar, and data streaks along the bottom whose length is the spectrum. Every beat inverts one log row.
// Palette: ground (near-black), ink (phosphor), accent (white-green), tintA (dim green). Text set 7: r the log, g Hangul.
const int BL_ICON[8] = int[8](2047, 1025, 1281, 1153, 1281, 1081, 1025, 2047);

void sceneBootlog(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 ph = inkColor.rgb;
  vec3 hot = accentColor.rgb;
  vec3 dim = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // CRT window: single-tone phosphor plate, raster lines, a ghost one pixel line to the right, roll bar
  vec2 lo = vec2(0.98, 0.14);
  vec2 hi = vec2(1.72, 0.80);
  float inW = scAA(sdBox(c, lo, hi) - 0.02 + 0.02);
  float l = luma(scPlate(q, lo * scU, hi * scU));
  float lg = luma(scPlate(q - vec2(3.0, 0.0), lo * scU, hi * scU));
  float ras = 0.72 + 0.28 * step(0.5, fract(q.y / 3.0));
  float roll = smoothstep(0.06, 0.0, abs(fract(c.y * 1.3 - cut * 0.11) - 0.5) - 0.44);
  float tone = clamp((max(l, lg * 0.6) - 0.05) * 1.7, 0.0, 1.0) * ras;
  col = mix(col, mix(dim * 0.4, ph, tone) + hot * 0.25 * roll * tone, scBox(c, lo, hi));
  col = mix(col, ph, scLine(sdBox(c, lo - 0.012, hi + 0.012), 1.0));
  for (int i = 0; i < 4; i++) {
    vec2 k = vec2(i < 2 ? lo.x - 0.012 : hi.x + 0.012, (i & 1) == 0 ? lo.y - 0.012 : hi.y + 0.012);
    col = mix(col, ph, scPlus(c, k, 0.02));
  }
  // dot-matrix terminal icon and the boot progress bar
  vec2 ig = floor((c - vec2(0.05, 0.84)) / 0.0125);
  float icon = 0.0;
  if (ig.x >= 0.0 && ig.x < 11.0 && ig.y >= 0.0 && ig.y < 8.0) { icon = float((BL_ICON[int(ig.y)] >> (10 - int(ig.x))) & 1); }
  float blink = step(0.5, fract(TIME * 2.0));
  col = mix(col, ph, icon);
  col = mix(col, ph, scBox(c, vec2(0.0 + 0.05 + 0.032, 0.845 + 0.0125 * 5.0), vec2(0.05 + 0.032 + 0.0125 * 3.0, 0.845 + 0.0125 * 6.0)) * blink * (1.0 - icon));
  vec2 pg = (c - vec2(0.24, 0.865)) / vec2(0.016, 0.05);
  float seg = step(0.0, pg.x) * step(pg.x, 40.0) * step(0.0, pg.y) * step(pg.y, 1.0) * step(mod(pg.x, 1.0), 0.7);
  float filled = step(pg.x, min(cut * 3.0 + 2.0, 40.0));
  col = mix(col, mix(dim, ph, filled), seg);
  col = mix(col, ph, scLine(sdBox(c, vec2(0.235, 0.855), vec2(0.24 + 40.0 * 0.016 + 0.005, 0.925)), 1.0));
  float cell = scCell();
  col = mix(col, ph, numTxt(q, vec2(0.24, 0.945) * scU, cell, min(cut * 3.0 + 2.0, 40.0) * 2.5, 3));
  // data streaks along the bottom: length is the spectrum, jump on the onset
  for (int i = 0; i < 6; i++) {
    float y = 0.955 + 0.007 * float(i);
    float len = 0.1 + 0.9 * bandAt(0.08 + 0.15 * float(i));
    float x0 = (0.3 + 1.2 * hash12(vec2(float(i), clk.z))) ;
    float s = scLine(c.y - y, 1.0) * step(x0 - len * 0.5, c.x) * step(c.x, x0 + len * 0.5);
    col = mix(col, ph, s * (0.35 + 0.65 * smoothstep(x0 - len * 0.5, x0 + len * 0.5, c.x)));
  }
  // typed log, Hangul word; the row picked by the beat is inverted
  float logRow = floor((c.y - 0.31) / 0.0364);
  float pick = step(0.0, logRow) * step(abs(logRow - mod(cut * 3.0, 12.0)), 0.5) * step(c.x, 0.93);
  col = mix(col, ph, pick * 0.9);
  float lg2 = scSheet(q, 0);
  col = mix(col, mix(ph, groundColor.rgb, pick), lg2);
  col = mix(col, hot, scSheet(q, 1));
}

// Scene 8, tunnel: a pixel checker tunnel in electric blue on black that jumps one ring deeper and turns half a step on
// every beat; the plate sits in a curved letterbox window at its vanishing point; a white-hot horizontal eye bar flares on the
// onset; a black block with a giant Monument Extended word and live depth numbers. Palette: ground (black), ink (white-hot),
// accent (electric blue), tintA (deep blue). Text set 8: r the word, g captions.
void sceneTunnel(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 hotc = inkColor.rgb;
  vec3 blue = accentColor.rgb;
  vec3 deep = tintA.rgb;
  float cut = floor(clk.x);
  vec2 ctr = vec2(0.5 * A, 0.5);
  float px = scPx();
  vec2 d = ((floor(q / px) + 0.5) * px) / scU - ctr;
  float r = length(d);
  float a = atan(d.y, d.x) / 6.28318;
  float z = 0.16 / max(r, 0.02);
  float ring = floor(z * 2.2 + cut);
  float seg = floor(a * 20.0 + cut * 0.5);
  float chk = mod(ring + seg, 2.0);
  float shade = smoothstep(0.05, 0.4, r);
  col = groundColor.rgb;
  col = mix(col, mix(deep, blue, 0.5 + 0.5 * step(1.5, mod(ring, 4.0))), chk * shade);
  col = mix(col, hotc, chk * step(0.5, mod(ring * 7.0 + seg, 29.0) - 27.5) * shade * step(1.2, z));
  // plate in the curved letterbox: the half height grows toward the sides
  float halfH = 0.17 + 0.2 * pow(abs(d.x) / (0.5 * A), 2.0);
  float inWin = scAA(abs(d.y) - halfH) * step(abs(d.x), 0.5 * A * 0.8);
  vec3 f = scPlate(q, vec2(0.1 * A, 0.2) * scU, vec2(0.9 * A, 0.8) * scU);
  vec3 tint = mix(vec3(luma(f)), f, 0.6) * vec3(0.7, 0.85, 1.25);
  col = mix(col, clamp(tint * 1.1, 0.0, 1.0), inWin);
  float edge = max(scLine(abs(d.y) - halfH, 1.5), 0.0) * step(abs(d.x), 0.5 * A * 0.8);
  col = mix(col, hotc, edge);
  // eye bar
  float bar = 0.003 + 0.028 * hit.x;
  float glow = smoothstep(0.1, 0.0, abs(d.y)) * 0.18 * (0.4 + hit.x);
  col = mix(col, blue, glow);
  col = mix(col, hotc, scAA(abs(d.y) - bar) * (0.55 + 0.45 * step(0.2, hit.x)));
  // block with the word, crosshairs, live depth
  col = mix(col, vec3(0.0), scAA(sdBox(c, vec2(-0.1, 0.78), vec2(0.98, 1.1))));
  col = mix(col, vec3(0.0), scAA(sdBox(c, vec2(1.1, 0.84), vec2(A + 0.1, 1.1))));
  col = mix(col, hotc, scSheet(q, 0));
  col = mix(col, hotc, scPlus(c, vec2(0.05, 0.05), 0.02));
  col = mix(col, hotc, scPlus(c, vec2(A - 0.05, 0.05), 0.02));
  float cell = scCell();
  col = mix(col, hotc, numTxt(q, vec2(A - 0.2, 0.9) * scU, cell * 2.0, mod(cut * 7.0, 1000.0), 3));
  col = mix(col, blue, scSheet(q, 1));
}

// Scene 9, runner: the plate as a grey monotone under scanline bands (a few bands slide sideways on every onset), glowing
// white-hot data streaks whose length is the spectrum and which jump on the onset, and a vermilion bar carrying a heavy Arial Black
// word that swaps to the next of three words and slams to a new left edge on every beat. Black pixel crosses, MesloLGS NF captions.
// Palette: ground (black), ink (white-hot), accent (vermilion), tintA (black), tintB (light grey). Text set 9: r, g, b are
// the three words (same place), the captions are on r above the bar.
void sceneRunner(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 hotc = inkColor.rgb;
  vec3 verm = accentColor.rgb;
  vec3 blk = tintA.rgb;
  vec3 sky = tintB.rgb;
  float cut = floor(clk.x);
  float band = floor(q.y / (4.0 * max(U * 3.0, 1.0)));
  float slide = step(0.9, hash12(vec2(band, clk.z))) * (hash12(vec2(band, clk.z + 7.0)) - 0.5) * 0.12 * scU;
  float l = clamp((luma(scPlate(q + vec2(slide, 0.0), vec2(0.0), S)) - 0.06) * 1.6, 0.0, 1.0);
  float stripe = 0.78 + 0.22 * step(0.5, fract(band * 0.5));
  col = mix(groundColor.rgb, sky, smoothstep(0.0, 1.0, l)) * stripe;
  // streaks
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float y = 0.04 + 0.92 * hash12(vec2(fi, 1.3));
    float len = 0.12 + 0.55 * bandAt(hash12(vec2(fi, 2.9)));
    float x0 = A * hash12(vec2(fi, clk.z));
    float u = clamp((c.x - (x0 - len)) / len, 0.0, 1.0);
    float s = scLine(c.y - y, 1.3) * step(x0 - len, c.x) * step(c.x, x0);
    col = mix(col, hotc, s * u * u * 0.9);
  }
  // the bar: its left edge slams to one of three places on the beat, the word swaps
  float pos = mod(cut, 3.0);
  float x0 = pos < 0.5 ? 0.0 : (pos < 1.5 ? 0.22 : 0.08);
  col = mix(col, verm, scAA(sdBox(c, vec2(x0, 0.6), vec2(A + 0.1, 0.79))));
  float w = pos < 0.5 ? scSheet(q, 0) : (pos < 1.5 ? scSheet(q, 1) : scSheet(q, 2));
  col = mix(col, blk, w * step(x0, c.x) * step(0.58, c.y) * step(c.y, 0.8));
  col = mix(col, blk, max(scPlus(c, vec2(x0 + 0.04, 0.6), 0.015), scPlus(c, vec2(A - 0.05, 0.79), 0.015)));
  float cell = scCell();
  col = mix(col, hotc, numTxt(q, vec2(0.06, 0.1) * scU, cell * 2.0, mod(cut * 11.0, 1000.0), 3));
  col = mix(col, hotc, scSheet(q, 0) * step(c.y, 0.5) * step(0.2, c.y));
  vec2 ck = floor((c - vec2(A - 0.34, 0.86)) / 0.025);
  col = mix(col, blk, step(0.0, ck.x) * step(ck.x, 9.0) * step(0.0, ck.y) * step(ck.y, 2.0) * step(1.0, mod(ck.x + ck.y, 2.0)));
}

// Scene 0, ascii: the plate drawn as ASCII, one character per cell from the pixel font by tone (mint, the lightest cells lilac);
// after every onset a hot column sweeps across it and lifts the characters it passes; a contour-map box with its terrain shifting
// on the beat, a particle cloud box that scatters on the onset, live readouts and a big Hangul word. Palette: ground (dark teal),
// ink (mint), accent (white mint), tintA (lilac). Text set 10 (Pretendard).
float asciiChar(vec2 q, vec2 lo, vec2 hi, vec4 clk, vec4 hit, out float lit) {
  float cell = scCell();
  vec2 adv = vec2(4.0, 6.0) * cell;
  vec2 id = floor((q - lo) / adv);
  vec2 org = lo + id * adv;
  vec2 mid = org + vec2(2.0, 3.0) * cell;
  float l = pow(scTone(mid, lo, hi, 1.5, 0.04), 0.7);
  float age = float(FRAMEINDEX) - clk.w;
  float sweepX = lo.x + (hi.x - lo.x) * (age / 9.0);
  float sw = step(abs(mid.x - sweepX), 18.0 * U + 8.0) * step(0.0, age) * step(age, 9.5) * step(0.5, clk.z);
  l = clamp(l + 0.35 * sw, 0.0, 1.0);
  int k = int(floor(l * 7.99));
  int ch = k == 0 ? 0 : (k == 1 ? 46 : (k == 2 ? 58 : (k == 3 ? 45 : (k == 4 ? 43 : (k == 5 ? 47 : (k == 6 ? 37 : 56))))));
  lit = step(0.8, l) + sw;
  return glyphAt(q - org, ch, cell) * step(lo.x, q.x) * step(q.x, hi.x) * step(lo.y, q.y) * step(q.y, hi.y);
}

void sceneAscii(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 mint = inkColor.rgb;
  vec3 whit = accentColor.rgb;
  vec3 lil = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  float lit;
  float g = asciiChar(q, vec2(0.05, 0.07) * scU, vec2(1.12, 0.77) * scU, clk, hit, lit);
  col = mix(col, mix(mint, lil, step(0.8, lit)), g);
  col = mix(col, whit, g * step(1.5, lit));
  col = mix(col, mint, scLine(sdBox(c, vec2(0.04, 0.06), vec2(1.13, 0.78)), 1.0) * 0.6);
  // contour map box
  vec2 ml = vec2(1.22, 0.07);
  vec2 mh = vec2(1.72, 0.37);
  float v = fbm(c * vec2(6.0, 8.0) + cut * 0.7, 4) * 10.0;
  float iso = clamp(1.0 - abs(fract(v) - 0.5) * 2.0 / max(fwidth(v) * 1.5, 1e-3), 0.0, 1.0);
  float major = clamp(1.0 - abs(fract(v * 0.2) - 0.5) * 2.0 / max(fwidth(v * 0.2) * 2.5, 1e-3), 0.0, 1.0);
  float inM = scBox(c, ml, mh);
  col = mix(col, mint, iso * inM * 0.7);
  col = mix(col, lil, major * inM);
  col = mix(col, mint, scLine(sdBox(c, ml, mh), 1.0));
  // particle cloud box
  vec2 pl = vec2(1.22, 0.42);
  vec2 ph = vec2(1.72, 0.72);
  col = mix(col, mint, scLine(sdBox(c, pl, ph), 1.0));
  if (scBox(c, pl, ph) > 0.5) {
    float dots = 0.0;
    for (int i = 0; i < 80; i++) {
      vec2 h = hash22(vec2(float(i), 5.3));
      vec2 p = vec2(1.47, 0.57) + (h - 0.5) * vec2(0.4, 0.22) * (0.4 + 0.6 * h.y);
      p += (hash22(vec2(float(i), clk.z + 3.0)) - 0.5) * 0.14 * step(0.45, hit.x);
      dots = max(dots, scAA(length(c - p) - 0.0035));
    }
    col = mix(col, lil, dots);
  }
  // readouts and the Hangul word
  float cell = scCell();
  col = mix(col, mint, max(txt4(q, vec2(1.22, 0.76) * scU, cell, 88, 0, 0, 0), numTxt(q, vec2(1.28, 0.76) * scU, cell, mod(cut * 37.0 + 714.0, 10000.0), 4)));
  col = mix(col, mint, max(txt4(q, vec2(1.22, 0.8) * scU, cell, 89, 0, 0, 0), numTxt(q, vec2(1.28, 0.8) * scU, cell, floor(stLevel().a * 999.0), 4)));
  col = mix(col, lil, scSheet(q, 0));
  col = mix(col, mint, scSheet(q, 1));
}

// Scene 10 (variant 0, rot 1), cube-wall: a salmon field and a 4 x 3 wall of cubes. On every beat every cube turns to its next face in
// three frames (even columns slide round sideways, odd columns upward); a face is a cobalt rounded tile with a cream letter, a cream
// tile with a cobalt letter, a cobalt Bayer dither of the plate, or a dot grid whose dot radius is the bass. Each onset swaps the letter
// of one cube. Palette: ground (salmon), ink (cream), accent (cobalt), tintA (dark salmon). Text set 11: r the four face letters
// (Big Shoulders Display Black, C U B E at 0, 0.2, 0.4, 0.6 of the sheet width), g the caption (MesloLGS NF).
float cwRound(vec2 p, float s, float r) { return length(max(abs(p) - (s - r), 0.0)) - r; }

vec4 cwFace(vec2 q, vec2 ctr, vec2 p, float s, int kind, int letter, float bass) {
  vec3 cobalt = accentColor.rgb;
  vec3 cream = inkColor.rgb;
  float cov = scAA(cwRound(p, s, 0.05));
  vec3 f = kind == 0 ? cobalt : (kind == 3 ? tintA.rgb : cream);
  float cx = (float(letter) * 0.2) * RENDERSIZE.x + 0.1167 * RENDERSIZE.y;
  vec2 sp = vec2(cx, 0.2361 * RENDERSIZE.y) + p / s * 0.1833 * RENDERSIZE.y;
  float m = crisp(sheetC(sp, 0), 1.0);
  if (kind == 0) { f = mix(f, cream, m); }
  if (kind == 1) { f = mix(f, cobalt, m); }
  if (kind == 2) {
    float px = scPx();
    vec2 pix = floor(q / px);
    float l = scTone((pix + 0.5) * px, (ctr - s) * scU, (ctr + s) * scU, 1.5, 0.08);
    f = mix(cream, cobalt, step(scBayer(pix), 1.0 - l));
  }
  if (kind == 3) {
    vec2 g = (p / s * 0.5 + 0.5) * 6.0;
    float dt = scAA((length(fract(g) - 0.5) - (0.12 + 0.34 * bass)) * s / 3.0);
    f = mix(f, cream, dt);
  }
  return vec4(f, cov);
}

void sceneCubeWall(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 cobalt = accentColor.rgb;
  vec3 cream = inkColor.rgb;
  float beat = floor(clk.x);
  float cut = floor(beat * 0.5);
  float age = float(FRAMEINDEX) - clk.y;
  float u = (cut < 0.5 || mod(beat, 2.0) > 0.5) ? 1.0 : clamp((age + 1.0) / 3.0, 0.0, 1.0);
  col = groundColor.rgb;
  vec2 o = vec2(0.5 * A - 0.6, 0.05);
  vec2 g = (c - o) / 0.3;
  vec2 id = floor(g);
  col = mix(col, tintA.rgb, scAA(sdBox(c, o - 0.01, o + vec2(1.2, 0.9) + 0.01)) * 0.5);
  if (id.x >= 0.0 && id.x < 4.0 && id.y >= 0.0 && id.y < 3.0) {
    vec2 ctr = o + (id + 0.5) * 0.3;
    vec2 p = c - ctr;
    float s = 0.135;
    bool horiz = mod(id.x, 2.0) < 0.5;
    float pitch = 2.0 * s + 0.03;
    float off = pitch * u;
    vec2 pPrev = horiz ? p + vec2(off, 0.0) : p + vec2(0.0, off);
    vec2 pNew = horiz ? p - vec2(pitch - off, 0.0) : p - vec2(0.0, pitch - off);
    float idx = id.x + 4.0 * id.y;
    float turns = floor((clk.z + 11.0 - idx) / 12.0);
    int letter = int(mod(idx + turns, 4.0));
    int kNew = int(mod(cut + id.x + 2.0 * id.y, 4.0));
    int kPrev = int(mod(cut + 3.0 + id.x + 2.0 * id.y, 4.0));
    bool inPrev = abs(horiz ? pPrev.x : pPrev.y) < s && abs(horiz ? pPrev.y : pPrev.x) < s;
    bool inNew = abs(horiz ? pNew.x : pNew.y) < s && abs(horiz ? pNew.y : pNew.x) < s;
    float bass = stLevel().r;
    if (u >= 0.99) {
      vec4 f2 = cwFace(q, ctr, p, s, kNew, letter, bass);
      col = mix(col, f2.rgb, f2.a);
    } else if (inNew) {
      vec4 fn = cwFace(q, ctr, pNew, s, kNew, letter, bass);
      col = mix(col, fn.rgb * (0.65 + 0.35 * u), fn.a);
    } else if (inPrev) {
      vec4 fp = cwFace(q, ctr, pPrev, s, kPrev, letter, bass);
      col = mix(col, fp.rgb * (1.0 - 0.35 * u), fp.a);
    }
  }
  // margins: cobalt bar with the caption, rules, crosses
  col = mix(col, cobalt, scAA(sdBox(c, vec2(0.0, 0.88), vec2(o.x - 0.03, 0.95))));
  col = mix(col, cream, scSheet(q, 1) * scBox(c, vec2(0.0, 0.88), vec2(o.x - 0.03, 0.95)));
  col = mix(col, cream, scLine(c.x - (o.x + 1.23), 1.0) * step(0.05, c.y) * step(c.y, 0.95) * 0.9);
  col = mix(col, cobalt, max(scPlus(c, vec2(0.08, 0.08), 0.02), scPlus(c, vec2(A - 0.08, 0.92), 0.02)));
  col = mix(col, cobalt, numTxt(q, vec2(A - 0.25, 0.08) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
}

// Scene 11 (variant 1, rot 1), vortex-count: a blue-grey field whose log-polar rings of text spiral out of the centre (white and navy
// rings alternate, the spiral steps a little on every beat), a round window at the vanishing point holding the plate as white
// halftone dots (dot size follows the bass), and a ring of 24 countdown ticks that loses one tick on every beat. Palette: ground
// (blue-grey), ink (white), accent (navy), tintA (pale blue-grey). Text set 12: r the spiral line (Bebas Neue), g the caption (Futura).
void sceneVortex(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 white = inkColor.rgb;
  vec3 navy = accentColor.rgb;
  float cut = floor(clk.x);
  vec2 ctr = vec2(0.5 * A, 0.5);
  vec2 d = c - ctr;
  float r = length(d);
  float th = atan(d.y, d.x);
  col = groundColor.rgb;
  // spiral text
  float w = log(max(r, 0.001) / 0.2) * 3.0;
  float n = floor(w);
  float tt = fract(th / 6.28318 + n * 0.173 + cut * 0.012);
  float k = RENDERSIZE.y;
  vec2 sp = vec2(tt * 0.97 * RENDERSIZE.x, (0.004 + (1.0 - fract(w)) * 0.076) * k);
  float m = crisp(sheetC(sp, 0), 1.0) * step(0.0, w) * step(r, 1.4);
  col = mix(col, mod(n, 2.0) < 0.5 ? white : navy, m);
  col = mix(col, white, 0.1 * step(0.0, w) * step(fract(w), 0.03));
  // round window with the plate as halftone, and the countdown ring
  float R = 0.19;
  float lv = stLevel().r;
  vec2 lo = (ctr - R) * scU;
  vec2 hi = (ctr + R) * scU;
  float dots = scDots(q, lo, hi, max(3.0, 11.0 * U), 1.0 + 1.6 * lv, 0.05, 0.0);
  col = mix(col, navy, scAA(r - R));
  col = mix(col, white, dots * scAA(r - R + 0.004));
  col = mix(col, white, scLine(r - R, 1.5));
  float left = 24.0 - mod(cut, 25.0);
  float a24 = (th / 6.28318 + 0.5) * 24.0;
  float tick = step(0.2, fract(a24)) * step(fract(a24), 0.8) * step(R + 0.012, r) * step(r, R + 0.045);
  float lit = step(floor(a24) + 0.5, left);
  col = mix(col, mix(tintA.rgb, white, lit), tick);
  // numeral, caption, crosses
  float cell = scCell();
  col = mix(col, white, numTxt(q, vec2(ctr.x + 0.08, ctr.y + 0.11) * scU, cell * 2.0, left, 2));
  col = mix(col, navy, scAA(sdBox(c, vec2(0.0, 0.84), vec2(0.4, 1.0))));
  col = mix(col, white, scSheet(q, 1));
  col = mix(col, white, max(scPlus(c, vec2(0.06, 0.06), 0.02), scPlus(c, vec2(A - 0.06, 0.06), 0.02)));
}

// Scene 12 (variant 2, rot 1), sticker-slap: a black field and a pile of cream stickers. Every beat a new sticker slaps on with an
// overshoot (scale 1.35, 1.12, 0.97, 1); the pile keeps the last eight. Every onset flips one sticker over to a 1-bit dither of the plate.
// Stickers are filled Impact words, outlined Impact words, round Georgia tags, dither plates and small mustard pills (mustard stays under
// about 15 percent); two rows of Impact text run along the top, filled and outlined in turn. Palette: ground (black), ink (cream),
// accent (mustard), tintA (lilac). Text set 13: r the sticker words (centred anchors), g the two rows.
vec2 stRot(vec2 p, float a) { float cs = cos(a); float sn = sin(a); return vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y); }

vec4 stSticker(vec2 q, vec2 c, float j, float cut, float age, float A, float flipJ) {
  vec2 h1 = hash22(vec2(j, 1.7));
  vec2 h2 = hash22(vec2(j, 8.3));
  vec2 pos = vec2(0.22 + (A - 0.44) * h1.x, 0.22 + 0.56 * h1.y);
  float rot = (h2.x - 0.5) * 0.6;
  float sz = 0.17 + 0.1 * h2.y;
  int type = int(floor(hash12(vec2(j, 4.4)) * 5.0));
  if (j == flipJ) { type = 3; }
  float sc = 1.0;
  if (j == cut) { sc = age < 0.5 ? 1.35 : (age < 1.5 ? 1.12 : (age < 2.5 ? 0.97 : 1.0)); }
  vec2 p = stRot(c - pos, rot) / sc;
  vec3 cream = inkColor.rgb;
  vec3 blk = groundColor.rgb;
  vec2 hs = vec2(sz, sz * 0.62);
  float cov = 0.0;
  vec3 f = cream;
  float k = RENDERSIZE.y;
  if (type == 2) {
    cov = scAA(length(p) - sz * 0.8);
    f = tintA.rgb;
    float m = crisp(sheetC(vec2(0.25 * RENDERSIZE.x, 0.774 * k) + p * (0.34 * k / (sz * 0.8)), 0), 1.0);
    f = mix(f, blk, m);
    f = mix(f, blk, scLine(length(p) - sz * 0.68, 1.5));
  } else if (type == 4) {
    vec2 hm = vec2(sz * 0.55, sz * 0.3);
    cov = scAA(sdBox(p, -hm, hm) - 0.03);
    f = accentColor.rgb;
    f = mix(f, blk, step(0.5, fract(p.x * 14.0)) * 0.9 * step(abs(p.y), hm.y * 0.5));
  } else {
    cov = scAA(sdBox(p, -hs, hs) - 0.03);
    if (type == 0 || type == 1) {
      vec2 anchor = type == 0 ? vec2(0.25 * RENDERSIZE.x, 0.252 * k) : vec2(0.75 * RENDERSIZE.x, 0.252 * k);
      float m = crisp(sheetC(anchor + p * (0.34 * k / sz), 0), 1.0);
      f = mix(f, blk, m);
    }
    if (type == 3) {
      float px = scPx();
      vec2 pix = floor(q / px);
      float l = scTone((pix + 0.5) * px, (pos - hs) * scU, (pos + hs) * scU, 1.6, 0.05);
      f = mix(blk, cream, step(scBayer(pix), l));
    }
  }
  return vec4(f, cov);
}

void sceneSticker(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  float beat = floor(clk.x);
  float cut = floor(beat * 0.5);
  float age = mod(beat, 2.0) < 0.5 ? float(FRAMEINDEX) - clk.y : 9.0;
  vec3 cream = inkColor.rgb;
  col = groundColor.rgb;
  // two rows of Impact text, filled then outlined
  float rows = scSheet(q, 2);
  col = mix(col, cream, rows * step(c.y, 0.17));
  float flipJ = cut - mod(floor(clk.z / 3.0), 4.0);
  for (int i = 7; i >= 0; i--) {
    float j = cut - float(i);
    vec4 s = stSticker(q, c, j, cut, age, A, flipJ);
    col = mix(col, s.rgb, s.a);
  }
  col = mix(col, cream, max(scPlus(c, vec2(0.06, 0.94), 0.02), scPlus(c, vec2(A - 0.06, 0.94), 0.02)));
  col = mix(col, cream, numTxt(q, vec2(A - 0.2, 0.9) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
}

// (the scene dispatcher is in 66-scene-main.glsl so it sorts after every scene file)

// Scene 13 (variant 3, rot 1), ribbon-rays: an ochre field with a fan of white hairline rays (the ray count grows on every beat,
// every third ray is a thin wedge), and a twisted ribbon that crosses the frame: its front face is black with a heavy condensed word
// flowing along it (the flow steps on every beat), its back face is an ochre duotone of the plate; four echo copies trail behind in
// colour steps. One DIN Condensed label sits at the root of the rays. Palette: ground (ochre), ink (white), accent (black),
// tintA (dark ochre), tintB (pale ochre). Text set 14: r the ribbon line (Avenir Next Condensed), g the label.
float rbY(float x, float ph) { return 0.5 + 0.2 * sin(x * 2.6 + ph); }
float rbTw(float x) { return cos(x * 1.9 + 0.6); }

void sceneRibbon(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 white = inkColor.rgb;
  vec3 blk = accentColor.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // rays from the lower left, one more pair on every beat
  vec2 ro = vec2(0.14, 0.9);
  vec2 dr = c - ro;
  float a = atan(dr.y, dr.x);
  float nr = 6.0 + mod(cut, 14.0) * 2.0;
  float ra = a * nr / 6.28318;
  float da = (fract(ra) - 0.5) * 6.28318 / nr;
  float ray = scLine(da * length(dr), 1.0);
  float wedge = step(mod(floor(ra), 3.0), 0.5) * step(abs(da * length(dr)), 0.006 + 0.012 * length(dr));
  col = mix(col, white, max(ray * 0.85, wedge * 0.9));
  // the ribbon and its echoes, back to front
  float flow = cut * 0.07;
  for (int e = 4; e >= 0; e--) {
    float fe = float(e);
    float ph = cut * 0.35 - fe * 0.2;
    float yy = rbY(c.x, ph) + fe * 0.03;
    float tw = rbTw(c.x - fe * 0.08);
    float wd = 0.02 + 0.11 * abs(tw);
    float dy = c.y - yy;
    float inside = scAA(abs(dy) - wd);
    if (e > 0) {
      vec3 ec = e == 4 ? tintA.rgb : (e == 3 ? tintB.rgb : (e == 2 ? blk : white));
      col = mix(col, ec, scLine(abs(dy) - wd, 1.5) * 0.9);
      continue;
    }
    vec3 face;
    if (tw > 0.0) {
      float m = crisp(sheetC(vec2(fract(c.x * 0.45 + flow) * 0.96 * RENDERSIZE.x, (0.012 + (0.5 + 0.5 * dy / max(wd, 0.004)) * 0.07) * RENDERSIZE.y), 0), 1.0);
      face = mix(blk, white, m);
    } else {
      float l = clamp((luma(scPlate(q, vec2(0.0), S)) - 0.05) * 1.8, 0.0, 1.0);
      face = mix(blk, vec3(1.0, 0.82, 0.38), l);
    }
    col = mix(col, face, inside);
    col = mix(col, white, scLine(abs(dy) - wd, 1.0) * 0.9);
  }
  col = mix(col, blk, scAA(length(c - ro) - 0.012));
  col = mix(col, blk, scSheet(q, 1));
  col = mix(col, blk, max(scPlus(c, vec2(A - 0.07, 0.08), 0.02), scPlus(c, vec2(0.45 * A, 0.94), 0.02)));
}

// Scene 14 (variant 4, rot 1), slab-shear: a concrete-grey field with a giant Futura word that flows on a sine wave (the wave steps on
// every beat) and is cut into nine horizontal slabs; on every beat some slabs slide sideways and two become safety-blue slabs holding
// the plate as a 1-bit Bayer dither with the word in white; a typed Menlo label sits on a seam, with a crosshair target and ticks.
// Palette: ground (concrete), ink (white), accent (safety blue), tintA (black). Text set 15: r the giant word, g the typed label.
void sceneSlab(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 blue = accentColor.rgb;
  vec3 blk = tintA.rgb;
  float cut = floor(clk.x);
  float slab = floor(c.y / 0.1111);
  float h = hash12(vec2(slab, cut));
  float shift = (step(0.55, h) * (fract(h * 9.0) - 0.5)) * 0.2 * scU;
  float isBlue = step(0.82, hash12(vec2(slab, cut + 31.0)));
  float wave = 0.045 * sin(c.x * 7.0 + cut * 0.9) * scU;
  float grain = fbm(c * 40.0, 3);
  col = groundColor.rgb * (0.88 + 0.2 * grain);
  vec2 sq = q + vec2(shift, wave);
  float m = crisp(sheetC(sq * (RENDERSIZE / scS), 0), 1.0);
  if (isBlue > 0.5) {
    float px = scPx();
    vec2 pix = floor(q / px);
    float l = scTone((pix + 0.5) * px, vec2(0.0), S, 1.6, 0.05);
    col = mix(blk, blue, step(scBayer(pix), l));
    col = mix(col, inkColor.rgb, m);
  } else {
    col = mix(col, blk, m);
  }
  // seams between slabs and a typed label on one of them
  float seam = scLine(fract(c.y / 0.1111 + 0.5) * 0.1111 - 0.0555, 1.0);
  col = mix(col, blk, seam * 0.35);
  col = mix(col, blk, step(mod(q.x, 0.03 * scU), 1.0) * step(abs(c.y - 0.2222), 0.008));
  col = mix(col, blk, scSheet(q, 1));
  vec2 t = vec2(A - 0.2, 0.5);
  float rr = length(c - t);
  col = mix(col, blk, max(scLine(rr - 0.09, 1.2), max(scLine(rr - 0.04, 1.0), max(scLine(c.x - t.x, 1.0) * step(abs(c.y - t.y), 0.12), scLine(c.y - t.y, 1.0) * step(abs(c.x - t.x), 0.12)))));
  col = mix(col, blk, numTxt(q, vec2(0.04, 0.93) * scU, scCell() * 2.0, mod(cut * 14.0, 1000.0), 3));
}

// Scene 15 (variant 5, rot 1), frame-loop-dial: a dark aubergine field with a line of Georgia text that runs round the border of the
// frame (every onset jumps it ahead, a quick double speed); an arch window with the plate as a peach Bayer dither; a dial of 60 ticks
// filled up on every beat with a split-flap countdown in its middle (the top half of the old digit folds away in 3 frames); a typed Menlo
// input line. Palette: ground (aubergine), ink (off-white), accent (peach), tintA (plum). Text set 16: r the border line and the
// MesloLGS NF atlas, g the typed line.
float fdFlap(vec2 q, vec2 lo, vec2 sz, float oldD, float newD, float u) {
  float fs = sz.y * 0.8;
  vec2 org = lo + vec2((sz.x - 0.602 * fs) * 0.5, (sz.y - fs) * 0.5);
  float mid = lo.y + 0.5 * sz.y;
  vec2 pn = q - org * scU;
  float dn = aNum(pn, fs * scU, newD, 1);
  float dOld = 0.0;
  float v = 0.0;
  if (q.y >= mid * scU) {
    v = u < 0.66 ? aNum(q - org * scU, fs * scU, oldD, 1) : dn;
  } else {
    float vis = 1.0 - u;
    float yy = mid * scU - (mid * scU - q.y) / max(vis, 0.001);
    if (u < 1.0 && (mid * scU - q.y) < 0.5 * sz.y * scU * vis) { v = aNum(vec2(q.x, yy) - org * scU, fs * scU, oldD, 1); }
    else if (u < 1.0) { v = dn; }
    else { v = dn; }
  }
  return crisp(v, 4.0);
}

void sceneFrameDial(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 off = inkColor.rgb;
  vec3 peach = accentColor.rgb;
  vec3 plum = tintA.rgb;
  float cut = floor(clk.x);
  float age = float(FRAMEINDEX) - clk.y;
  float u = cut < 0.5 ? 1.0 : clamp((age + 1.0) / 3.0, 0.0, 1.0);
  col = groundColor.rgb;
  // text round the border
  float bnd = 0.055;
  vec4 dd = vec4(c.y, A - c.x, 1.0 - c.y, c.x);
  float mn = min(min(dd.x, dd.y), min(dd.z, dd.w));
  float perim = 2.0 * A + 2.0;
  float s;
  float depth = mn;
  if (mn == dd.x) { s = c.x; }
  else if (mn == dd.y) { s = A + c.y; }
  else if (mn == dd.z) { s = A + 1.0 + (A - c.x); }
  else { s = 2.0 * A + 1.0 + (1.0 - c.y); }
  float tflow = TIME * 0.06 * perim + clk.z * 0.06;
  float k = RENDERSIZE.y;
  float ux = mod((s - tflow) * k, 5.0 * 101.8 * k / 360.0);
  float m = crisp(sheetC(vec2(ux, (0.012 + depth / bnd * 0.056) * k), 0), 1.0) * step(depth, bnd);
  col = mix(col, plum, step(depth, bnd));
  col = mix(col, peach, m);
  col = mix(col, peach, scLine(depth - bnd, 1.0) * 0.8);
  // arch window with a peach dither of the plate
  vec2 lo = vec2(0.17, 0.14);
  vec2 hi = vec2(0.84, 0.88);
  float px = scPx();
  vec2 pix = floor(q / px);
  float l = scTone((pix + 0.5) * px, lo * scU, hi * scU, 1.6, 0.06);
  col = mix(col, mix(plum, peach, step(scBayer(pix), l)), scAA(sdArch(c, lo, hi)));
  col = mix(col, off, scLine(sdArch(c, lo - 0.012, hi + 0.012), 1.0));
  // dial of 60 ticks and the split-flap countdown
  vec2 ctr = vec2(1.3, 0.5);
  float rr = length(c - ctr);
  float ang = (atan(c.y - ctr.y, c.x - ctr.x) / 6.28318 + 0.5) * 60.0;
  float tk = step(0.25, fract(ang)) * step(fract(ang), 0.75) * step(0.3, rr) * step(rr, 0.3 + 0.03 + 0.02 * step(mod(floor(ang), 5.0), 0.5));
  float on = step(floor(ang) + 0.5, mod(cut, 60.0));
  col = mix(col, mix(plum * 1.6, peach, on), tk);
  float val = mod(60.0 - cut, 100.0);
  float cw = 0.17;
  float v1 = fdFlap(q, vec2(ctr.x - 0.185, ctr.y - 0.13), vec2(cw, 0.26), floor(mod(60.0 - cut + 1.0, 100.0) / 10.0), floor(val / 10.0), u);
  float v2 = fdFlap(q, vec2(ctr.x + 0.015, ctr.y - 0.13), vec2(cw, 0.26), mod(60.0 - cut + 1.0, 10.0), mod(val, 10.0), u);
  col = mix(col, off, scAA(sdBox(c, vec2(ctr.x - 0.185, ctr.y - 0.13), vec2(ctr.x - 0.015, ctr.y + 0.13)) - 0.02));
  col = mix(col, off, scAA(sdBox(c, vec2(ctr.x + 0.015, ctr.y - 0.13), vec2(ctr.x + 0.185, ctr.y + 0.13)) - 0.02));
  col = mix(col, groundColor.rgb, min(v1 + v2, 1.0));
  col = mix(col, groundColor.rgb, scLine(c.y - ctr.y, 2.0) * scBox(c, vec2(ctr.x - 0.185, 0.0), vec2(ctr.x + 0.185, 1.0)));
  col = mix(col, peach, scSheet(q, 1));
  col = mix(col, off, max(scPlus(c, vec2(1.0, 0.18), 0.02), scPlus(c, vec2(1.6, 0.82), 0.02)));
}

// Scene 16 (variant 6, rot 1), tilt-tiles: a lemon field tilted about 14 degrees into rows of Rockwell word tiles. Neighbouring rows flow
// the other way and each beat every row jumps a different distance; filled and outlined rows alternate, and each onset swaps the kind
// of one row. A tilted window holds the plate as a three-tone posterize (black, lemon, white); a white caption box, a numbered black disc.
// Palette: ground (lemon), ink (black), accent (white), tintA (deep green). Text set 17: r filled word, g outlined word, b caption.
void sceneTilt(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 blk = inkColor.rgb;
  vec3 wht = accentColor.rgb;
  float cut = floor(clk.x * 0.5);
  col = groundColor.rgb;
  vec2 pr = stRot(c - vec2(0.5 * A, 0.5), 0.24);
  float rowH = 0.14;
  float n = floor(pr.y / rowH);
  float v = pr.y - n * rowH;
  float dir = mod(n, 2.0) < 0.5 ? 1.0 : -1.0;
  float off = dir * cut * (0.14 + 0.05 * mod(abs(n), 3.0));
  float u = mod(pr.x + off, 0.92);
  float k = RENDERSIZE.y;
  float swp = step(abs(mod(n, 7.0) - mod(clk.z, 7.0)), 0.5);
  int ch = mod(n + swp, 2.0) < 0.5 ? 0 : 1;
  float m = crisp(sheetC(vec2(u * 0.5 * k, (0.0478 + (v - 0.07) * 0.5) * k), ch), 1.0);
  col = mix(col, blk, m);
  col = mix(col, blk, scLine(v, 1.0) * 0.6);
  // tilted window with the posterized plate
  vec2 wc = vec2(0.04, 0.0);
  vec2 wh = vec2(0.5, 0.25);
  float inW = scAA(sdBox(pr, wc - wh, wc + wh));
  float l = scTone(q, vec2(0.0), S, 1.5, 0.05);
  vec3 pz = l < 0.3 ? blk : (l < 0.62 ? groundColor.rgb : wht);
  col = mix(col, pz, inW);
  col = mix(col, blk, scLine(sdBox(pr, wc - wh, wc + wh), 3.0));
  // caption box, numbered disc
  col = mix(col, wht, scAA(sdBox(c, vec2(0.04, 0.86), vec2(0.7, 0.97))));
  col = mix(col, blk, scSheet(q, 2) * scBox(c, vec2(0.04, 0.86), vec2(0.7, 0.97)));
  vec2 dc = vec2(A - 0.14, 0.15);
  col = mix(col, blk, scAA(length(c - dc) - 0.09));
  col = mix(col, wht, numTxt(q, (dc - vec2(0.035, 0.03)) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
  col = mix(col, tintA.rgb, scLine(length(c - dc) - 0.115, 2.0));
}

// Scene 17 (variant 7, rot 1), marquee-stack: a teal field of six stacked word rows. Every beat each row jumps its own distance in its own
// direction (a marquee that moves in steps, not a scroll); each row has three echo copies trailing in colour steps (dark teal,
// tangerine, cream shade); the last row is Hangul. A cream-framed window holds the plate as a coarse four-colour mosaic. Palette: ground
// (teal), ink (cream), accent (tangerine), tintA (dark teal). Text set 18: r the word (Gill Sans Bold), g the Hangul word, b the caption.
void sceneMarquee(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 cream = inkColor.rgb;
  vec3 tang = accentColor.rgb;
  vec3 deep = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  float n = floor((c.y - 0.05) / 0.15);
  float v = (c.y - 0.05) - n * 0.15;
  float k = RENDERSIZE.y;
  if (n >= 0.0 && n < 6.0) {
    float dk = n < 0.5 ? 0.25 : (n < 1.5 ? 0.42 : (n < 2.5 ? 0.6 : (n < 3.5 ? 0.33 : (n < 4.5 ? 0.5 : 0.7))));
    float dir = mod(n, 2.0) < 0.5 ? 1.0 : -1.0;
    float off = dir * (cut * dk + clk.z * 0.02 * dk);
    int ch = n > 4.5 ? 1 : 0;
    for (int e = 3; e >= 0; e--) {
      float oe = off + dir * float(e) * 0.07;
      float u = mod(c.x + oe, 0.95);
      float m = crisp(sheetC(vec2(u * 0.5 * k, (0.0478 + (v - 0.075) * 0.5) * k), ch), 1.0);
      vec3 ec = e == 3 ? deep : (e == 2 ? tang : (e == 1 ? cream * 0.78 : cream));
      col = mix(col, ec, m);
    }
  }
  col = mix(col, cream, scLine(fract((c.y - 0.05) / 0.15) * 0.15, 1.0) * 0.0);
  // mosaic window
  vec2 lo = vec2(1.1, 0.2);
  vec2 hi = vec2(1.64, 0.8);
  float blk = 0.022 * scU;
  vec2 mq = (floor(q / blk) + 0.5) * blk;
  float l = pow(scTone(mq, lo * scU, hi * scU, 1.5, 0.02), 0.6);
  vec3 mc = l < 0.25 ? deep : (l < 0.5 ? groundColor.rgb * 1.25 : (l < 0.75 ? tang : cream));
  col = mix(col, mc, scAA(sdBox(c, lo, hi)));
  col = mix(col, cream, scLine(sdBox(c, lo - 0.012, hi + 0.012), 3.0));
  // caption bar, disc, crosses
  col = mix(col, cream, scAA(sdBox(c, vec2(0.04, 0.955), vec2(0.8, 1.01))));
  col = mix(col, deep, scSheet(q, 2) * scBox(c, vec2(0.04, 0.955), vec2(0.8, 1.01)));
  col = mix(col, tang, scAA(length(c - vec2(A - 0.12, 0.88)) - 0.07));
  col = mix(col, deep, numTxt(q, vec2(A - 0.155, 0.855) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
  col = mix(col, cream, max(scPlus(c, vec2(1.05, 0.15), 0.02), scPlus(c, vec2(1.69, 0.85), 0.02)));
}

// Scene 18 (variant 8, rot 1), lens-wrap: an olive field; the plate wrapped on a sphere (longitude / latitude mapping, a red-blue lens
// fringe, a specular patch) whose size swells with the bass; a perspective floor of pink tile lines that steps toward you on every beat;
// a 4 x 3 block of small panels that each turn a quarter on every third onset; Didot and Courier New type. Palette: ground (olive),
// ink (pink), accent (black), tintA (dark olive), tintB (cream). Text set 19: r the word (Didot), g the caption (Courier New).
void sceneLens(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 pink = inkColor.rgb;
  vec3 blk = accentColor.rgb;
  vec3 cream = tintB.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // perspective floor
  float hy = 0.58;
  float t = 0.1 / max(c.y - hy + 0.004, 0.004);
  float wx = (c.x - 0.5 * A) * t * 1.2;
  float wz = t * 1.2 + cut * 0.5;
  float gx = 1.0 - clamp((0.5 - abs(fract(wx) - 0.5)) / max(fwidth(wx) * 1.2, 1e-3), 0.0, 1.0);
  float gz = 1.0 - clamp((0.5 - abs(fract(wz) - 0.5)) / max(fwidth(wz) * 1.2, 1e-3), 0.0, 1.0);
  float below = step(hy, c.y);
  col = mix(col, tintA.rgb, 0.6 * below);
  col = mix(col, pink, max(gx, gz) * smoothstep(0.0, 0.08, c.y - hy) * 0.9 * below);
  col = mix(col, pink, scLine(c.y - hy, 1.0) * 0.8);
  // sphere
  vec2 ctr = vec2(0.62, 0.45);
  float R = 0.3 + 0.05 * stLevel().r;
  vec2 d = (c - ctr) / R;
  float r2 = dot(d, d);
  float z = sqrt(max(1.0 - r2, 0.0));
  vec2 uv = vec2(0.5 + atan(d.x, max(z, 0.001)) / 3.0, 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.0);
  vec3 f = vec3(scPlate((uv - 0.5) * S + 0.5 * S, vec2(0.0), S).r, scPlate((uv - 0.5) * 1.025 * S + 0.5 * S, vec2(0.0), S).g, scPlate((uv - 0.5) * 1.05 * S + 0.5 * S, vec2(0.0), S).b);
  f = clamp((f - 0.06) * 1.3, 0.0, 1.0) * (0.35 + 0.65 * z);
  float spec = smoothstep(0.28, 0.0, length((d - vec2(-0.38, -0.42)) * vec2(1.0, 1.6)));
  f = mix(f, cream, spec * 0.55);
  col = mix(col, f, scAA((sqrt(r2) - 1.0) * R));
  col = mix(col, pink, scLine((sqrt(r2) - 1.0) * R, 2.0));
  col = mix(col, pink, scLine(length((c - ctr) * vec2(1.0, 3.2)) - 0.46, 1.0) * 0.8);
  // small panels that turn
  vec2 g = (c - vec2(A - 0.62, 0.06)) / 0.14;
  vec2 pid = floor(g);
  if (pid.x >= 0.0 && pid.x < 4.0 && pid.y >= 0.0 && pid.y < 3.0) {
    float i = pid.x + 4.0 * pid.y;
    vec2 p = (fract(g) - 0.5) * 0.14;
    if (abs(p.x) < 0.055 && abs(p.y) < 0.055) {
      p = stRot(p, floor((clk.z + i) / 3.0) * 1.5708);
      float bars = 0.0;
      for (int j = 0; j < 3; j++) {
        float h = 0.02 + 0.07 * hash12(vec2(i, float(j)));
        bars = max(bars, step(abs(p.x - (-0.03 + 0.03 * float(j))), 0.009) * step(-0.045, p.y) * step(p.y, -0.045 + h));
      }
      col = mix(cream, blk, bars);
    }
  }
  col = mix(col, cream, scSheet(q, 0));
  col = mix(col, cream, scSheet(q, 1));
  col = mix(col, blk, numTxt(q, vec2(0.05, 0.92) * scU, scCell() * 2.0, mod(cut * 3.0, 1000.0), 3));
}

// Scene 19 (variant 9, rot 1), liquid-type: a sky-blue field; the plate blurred and thresholded into ink-blot shapes (mid blue, one
// orange blot in the brightest part); a big Bodoni 72 word on a double sine ripple whose phase steps on every beat; a typed American
// Typewriter note and a crosshair reticle that jumps to a new place on every beat. Palette: ground (sky), ink (navy), accent (orange),
// tintA (pale), tintB (mid blue). Text set 20: r the word (Bodoni 72), g the typed note (American Typewriter).
void sceneLiquid(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 navy = inkColor.rgb;
  vec3 org = accentColor.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // ink blots: blurred plate luma thresholded
  float b = 0.0;
  float r = 7.0 * U * 3.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    b += luma(scPlate(q + r * vec2(cos(a), sin(a)), vec2(0.0), S));
  }
  b = b / 8.0;
  float thr = 0.3 - 0.05 * hit.y;
  col = mix(col, tintB.rgb, smoothstep(thr, thr + 0.025, b));
  col = mix(col, org, smoothstep(0.5, 0.53, b));
  // liquid word
  float ph = cut * 0.9;
  vec2 sq = q + scU * vec2(0.02 * sin(c.y * 14.0 + ph), 0.03 * sin(c.x * 6.0 + ph * 1.3));
  float m = crisp(sheetC(sq * (RENDERSIZE / scS), 0), 1.0);
  col = mix(col, navy, m);
  // reticle
  vec2 rp = vec2(0.3 + (A - 0.6) * hash12(vec2(cut, 2.0)), 0.25 + 0.5 * hash12(vec2(cut, 5.0)));
  col = mix(col, navy, max(scLine(length(c - rp) - 0.06, 1.2), max(scLine(c.x - rp.x, 1.0) * step(abs(c.y - rp.y), 0.1) * step(0.03, abs(c.y - rp.y)), scLine(c.y - rp.y, 1.0) * step(abs(c.x - rp.x), 0.1) * step(0.03, abs(c.x - rp.x)))));
  col = mix(col, navy, numTxt(q, (rp + vec2(0.07, 0.06)) * scU, scCell(), mod(cut * 17.0, 1000.0), 3));
  col = mix(col, navy, scSheet(q, 1));
  col = mix(col, navy, max(scPlus(c, vec2(0.06, 0.06), 0.02), scPlus(c, vec2(A - 0.06, 0.94), 0.02)));
}

// Scene 20 (variant 0, rot 2), panel-grid: an ice-white sheet with a 6 x 4 grid of small square panels, each a thin-line instrument
// (plate isolines, spectrum comb, bass gauge, big number, starburst, waveform, checker, reticle). On every onset one panel (in turn)
// swings a quarter turn in three frames and shows its next instrument. Brick accents; Optima and SF Mono type. Palette: ground (ice),
// ink (black), accent (brick), tintA (grey). Text set 21: r the Optima caption, g the SF Mono caption.
vec2 pgPanel(int kind, vec2 p, vec2 ctr, vec4 clk) {
  float h = 0.1;
  vec2 pp = (p + h) * scU;
  float cell = scCell();
  if (kind == 0) {
    float l = scTone((ctr + p) * scU, (ctr - h) * scU, (ctr + h) * scU, 1.4, 0.05);
    return vec2(smoothstep(0.38, 0.46, abs(fract(l * 7.0) - 0.5)), 0.0);
  }
  if (kind == 1) {
    float i = floor((p.x + h) / (2.0 * h) * 12.0);
    float lv = bandAt((i + 0.5) / 12.0);
    float bar = step(abs(fract((p.x + h) / (2.0 * h) * 12.0) - 0.5), 0.3) * step(h - lv * 2.0 * h * 0.9, p.y + h) * step(p.y, h * 0.9);
    return vec2(bar * step(0.3, lv + 0.2), bar * step(0.7, lv));
  }
  if (kind == 2) {
    float r = length(p);
    float a = atan(p.x, -p.y);
    float na = -2.3 + 4.6 * stLevel().r;
    float needle = scLine(sdSeg(p, vec2(0.0), 0.075 * vec2(sin(na), -cos(na))), 1.5);
    float tk = step(abs(fract(a * 3.8197) - 0.5), 0.12) * step(0.065, r) * step(r, 0.085) * step(abs(a), 2.4);
    return vec2(max(scLine(r - 0.085, 1.0), tk), needle);
  }
  if (kind == 3) { return vec2(numTxt(pp, vec2(0.04, 0.07) * scU, cell * 2.0, mod(clk.x * 7.0, 100.0), 2), 0.0); }
  if (kind == 4) { return vec2(scBurst(p, 0.09, 0.012, 0.0, 24.0), scAA(length(p) - 0.01)); }
  if (kind == 5) {
    float y = waveI((p.x + h) / (2.0 * h) * 400.0) * scopeGain * 0.3;
    return vec2(scLine(p.y - y, 1.2) * step(abs(p.x), 0.09), scLine(p.y, 1.0) * 0.0);
  }
  if (kind == 6) {
    vec2 g = floor(p / 0.033);
    return vec2(step(1.0, mod(g.x + g.y, 2.0)) * step(abs(p.x), 0.09) * step(abs(p.y), 0.09), 0.0);
  }
  float rr = length(p);
  return vec2(max(max(scLine(rr - 0.05, 1.0), scLine(p.x, 1.0) * step(abs(p.y), 0.085)), scLine(p.y, 1.0) * step(abs(p.x), 0.085)), 0.0);
}

void scenePanelGrid(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 ink = inkColor.rgb;
  vec3 brick = accentColor.rgb;
  col = groundColor.rgb;
  vec2 o = vec2((A - 1.38) * 0.5, 0.04);
  vec2 g = (c - o) / 0.23;
  vec2 id = floor(g);
  if (id.x >= 0.0 && id.x < 6.0 && id.y >= 0.0 && id.y < 4.0) {
    vec2 ctr = o + (id + 0.5) * 0.23;
    vec2 p = c - ctr;
    float i = id.x + 6.0 * id.y;
    if (abs(p.x) < 0.105 && abs(p.y) < 0.105) {
      float mine = mod(clk.z, 24.0) == i ? 1.0 : 0.0;
      float age = float(FRAMEINDEX) - clk.w;
      float u = (mine > 0.5 && clk.z > 0.5) ? clamp((age + 1.0) / 3.0, 0.0, 1.0) : 1.0;
      float turns = floor((clk.z + 24.0 - i) / 24.0);
      float ang = (turns - (1.0 - u)) * 1.5708;
      float tcount = u < 0.5 ? turns - 1.0 : turns;
      int kind = int(floor(hash12(vec2(i, 3.3 + tcount)) * 8.0));
      vec2 pr = stRot(p, ang);
      vec2 res = pgPanel(kind, pr, ctr, clk);
      col = mix(col, tintA.rgb * 1.5, 0.0);
      col = mix(col, ink, res.x * step(abs(pr.x), 0.1) * step(abs(pr.y), 0.1));
      col = mix(col, brick, res.y);
    }
    col = mix(col, ink, scLine(sdBox(p, vec2(-0.105), vec2(0.105)), 1.0));
  }
  col = mix(col, brick, scAA(sdBox(c, vec2(0.0, 0.04), vec2(o.x - 0.04, 0.14))));
  col = mix(col, ink, scLine(c.x - (o.x - 0.02), 1.0) * step(0.2, c.y) * step(c.y, 0.96) * 0.7);
  col = mix(col, ink, scSheet(q, 0));
  col = mix(col, ink, scSheet(q, 1));
  col = mix(col, brick, scLine(c.y - 0.975, 2.0) * step(0.0, c.x) * step(c.x, A * (0.2 + 0.8 * stLevel().a)));
}

// Scene 21 (variant 1, rot 2), mirror-track: a violet field and a central window holding the plate mirrored about its vertical axis and
// solarized into navy / brick / cream. Five outline target squares with tiny number labels jump to new places on every beat and are
// mirrored with the plate; a barcode strip re-seeds on every beat; a file-lookup text block with struck-through rows (D2Coding) and a big
// Phosphate word. Palette: ground (dusty violet), ink (cream), accent (brick red), tintA (indigo), tintB (pale violet). Text set 22: r the word, g the file block.
void sceneMirror(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 cream = inkColor.rgb;
  vec3 navy = accentColor.rgb;
  vec3 dk = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  vec2 lo = vec2(0.34, 0.08);
  vec2 hi = vec2(A - 0.06, 0.8);
  float wc = 0.5 * (lo.x + hi.x);
  vec2 qm = vec2(wc * scU + abs(q.x - wc * scU), q.y);
  float l = scTone(qm, lo * scU, hi * scU, 1.4, 0.05);
  float s = abs(l - (0.4 + 0.05 * mod(cut, 3.0))) * 2.0;
  vec3 sol = s < 0.22 ? navy : (s < 0.55 ? dk : cream);
  col = mix(col, sol, scAA(sdBox(c, lo, hi)));
  col = mix(col, cream, scLine(sdBox(c, lo - 0.01, hi + 0.01), 1.5));
  col = mix(col, cream, scLine(c.x - wc, 1.0) * step(lo.y, c.y) * step(c.y, hi.y) * 0.8);
  // targets, mirrored
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi + 1.0, cut));
    vec2 tp = vec2(mix(lo.x + 0.05, wc, h.x), mix(lo.y + 0.06, hi.y - 0.06, h.y));
    float sz = 0.03 + 0.03 * hash12(vec2(fi, 9.0));
    for (int sd = 0; sd < 2; sd++) {
      vec2 tq = sd == 0 ? tp : vec2(2.0 * wc - tp.x, tp.y);
      float box = scLine(sdBox(c, tq - sz, tq + sz), 1.2);
      vec2 br = abs(c - tq) - sz;
      col = mix(col, cream, max(box, 0.0));
      col = mix(col, cream, numTxt(q, (tq + vec2(sz + 0.01, -sz)) * scU, scCell(), mod(fi * 37.0 + cut * 11.0, 1000.0), 3));
    }
  }
  // barcode
  float bx = floor(c.x / 0.004);
  float bar = step(0.5, hash12(vec2(bx, cut))) * step(0.04, c.x) * step(c.x, 0.3) * step(0.86, c.y) * step(c.y, 0.96);
  col = mix(col, cream, bar);
  // file block with struck-through rows
  float row = floor((c.y - 0.1) / 0.034);
  float strike = step(0.0, row) * step(mod(row, 3.0), 1.5) * step(0.5, mod(row, 3.0)) * step(abs(c.y - (0.1 + (row + 0.5) * 0.034)), 0.0012) * step(0.04, c.x) * step(c.x, 0.3);
  col = mix(col, cream, scSheet(q, 1));
  col = mix(col, cream, strike);
  col = mix(col, cream, scSheet(q, 0));
  col = mix(col, navy, scAA(sdBox(c, vec2(0.04, 0.03), vec2(0.04 + 0.26 * stLevel().a, 0.045))));
}

// Scene dispatcher: variant 1..9 and 0 are the first ten scenes, rot 1 adds 10 (variant 0..5 + 10 are the round 9 scenes).
void drawScene(int v, vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  scS = S;
  scU = S.y;
  if (v == 1) { sceneSpecimen(q, S, clk, col); }
  if (v == 2) { sceneWiring(q, S, clk, col); }
  if (v == 3) { sceneFieldCut(q, S, clk, col); }
  if (v == 4) { scenePattern(q, S, clk, col); }
  if (v == 5) { sceneAnatomy(q, S, clk, col); }
  if (v == 6) { sceneDeck(q, S, clk, col); }
  if (v == 7) { sceneBootlog(q, S, clk, col); }
  if (v == 8) { sceneTunnel(q, S, clk, col); }
  if (v == 9) { sceneRunner(q, S, clk, col); }
  if (v == 0) { sceneAscii(q, S, clk, col); }
  if (v == 10) { sceneCubeWall(q, S, clk, col); }
  if (v == 11) { sceneVortex(q, S, clk, col); }
  if (v == 12) { sceneSticker(q, S, clk, col); }
  if (v == 13) { sceneRibbon(q, S, clk, col); }
  if (v == 14) { sceneSlab(q, S, clk, col); }
  if (v == 15) { sceneFrameDial(q, S, clk, col); }
  if (v == 16) { sceneTilt(q, S, clk, col); }
  if (v == 17) { sceneMarquee(q, S, clk, col); }
  if (v == 18) { sceneLens(q, S, clk, col); }
  if (v == 19) { sceneLiquid(q, S, clk, col); }
  if (v == 20) { scenePanelGrid(q, S, clk, col); }
  if (v == 21) { sceneMirror(q, S, clk, col); }
}

vec3 panelBody(int role, vec2 q, vec2 S, float hs, vec4 clk) {
  if (role == 1) { return vec3(0.0); }
  if (role == 2) { return pSpectrum(q, S); }
  if (role == 3) { return pScope(q, S); }
  if (role == 4) { return pMeter(q, S); }
  if (role == 5) { return pReadout(q, S, clk); }
  if (role == 6) { return pCross(q, S, clk); }
  return pFiller(role, q, S, hs, clk);
}

// the old boxed panel (frame "tile"): gutter inset, opaque ground, header strip, hairline frame
void drawTile(int role, float hs, vec2 q, vec2 S, vec4 clk, float snap, inout vec3 col) {
  vec3 cov3 = vec3(0.0);
  bool plate = role == 8 && hs < 0.6 && plateAmount > 0.5;
  col = groundColor.rgb;
  if (role == 1 && q.y > HEAD * U && HAS_INPUT) { col = footageBody(q, S, HEAD * U, 0); }
  if (role == 1 && !HAS_INPUT) {
    vec2 dd = (q - vec2(0.0, HEAD * U));
    vec2 body = S - vec2(0.0, HEAD * U);
    cov3.x = max(hl((dd.x * body.y - dd.y * body.x) / length(body)), hl((dd.x * body.y - (body.y - dd.y) * body.x) / length(body))) * 0.35 * step(0.0, dd.y);
  }
  cov3 = max(cov3, panelBody(role, q, S, hs, clk));
  if (plate) {
    cov3.x = 0.0;
    cov3.y = 1.0;
    cov3.z = panelBody(role, q, S, hs, clk).z;
  } else {
    vec3 head = panelHead(role, hs, q, S, clk, snap);
    cov3.x = max(cov3.x, head.x);
    cov3.y = max(cov3.y, head.y);
  }
  col = mix(col, inkColor.rgb, cov3.x);
  col = mix(col, accentColor.rgb, cov3.y);
  col = mix(col, groundColor.rgb, cov3.z);
}

// an editorial cell: optional solid fill, then the role drawn straight onto what is below it, then the frame
void drawEditorial(int role, vec4 sty, vec4 aux, int ch, vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  int v = int(sty.x + 0.5);
  int tone = int(sty.w + 0.5);
  int fill = int(sty.z + 0.5);
  vec3 cInk = tone == 1 ? groundColor.rgb : (tone == 2 ? accentColor.rgb : inkColor.rgb);
  vec3 cHot = tone == 2 ? inkColor.rgb : accentColor.rgb;
  if (fill == 1) { col = groundColor.rgb; }
  if (fill == 2) { col = inkColor.rgb; }
  if (fill == 3) { col = accentColor.rgb; }
  vec3 cov = vec3(0.0);
  if (role == 1) {
    if (HAS_INPUT) { col = footageBody(q, S, 0.0, v); }
    else { cov.x = max(hl((q.x * S.y - q.y * S.x) / length(S)), hl((q.x * S.y - (S.y - q.y) * S.x) / length(S))) * 0.35; }
  }
  if (role == 2) { cov = v == 0 ? pSpectrum(q, S) : pSpecHair(q, S, v); }
  if (role == 3) { cov = v == 0 ? pScope(q, S) : pScopeLine(q, S, v); }
  if (role == 4) { cov = v == 0 ? pMeter(q, S) : pMeterEd(q, S); }
  if (role == 5) { cov = v == 0 ? pReadout(q, S, clk) : pReadEd(q, S, v, clk); }
  if (role == 6) { cov = v == 0 ? pCross(q, S, clk) : pRegMark(q, S, clk); }
  if (role >= 7 && role <= 9) { cov = pFiller(role, q, S, role == 9 ? 0.5 : 0.0, clk); }
  if (role == 11) { cov = pType(q, S, v, int(aux.x + 0.5), vec3(aux.yz, aux.w), ch, clk); }
  if (role == 12) { cov = pRule(q, S, v); }
  if (role == 13) { drawTypeFx(v, aux, ch, tone, q, S, clk, cInk, cHot, col); }
  if (role == 14) { drawScene(v + 10 * int(aux.x + 0.5), q, S, clk, col); }
  cov.x = max(cov.x, frameCov(int(sty.y + 0.5), q, S));
  col = mix(col, cInk, cov.x);
  col = mix(col, cHot, cov.y);
}

void main() {
  vec2 res = RENDERSIZE;
  U = res.y / 1080.0;
  HW = max(lineWidth * U, 1.0);
  vec2 P = vec2(vUv.x, 1.0 - vUv.y) * res;
  gP = P;
  if (sheetDebug) {
    vec2 cellPx = res / vec2(32.0, 18.0);
    vec2 gd = (fract(P / cellPx + 0.5) - 0.5) * cellPx;
    vec3 c = mix(groundColor.rgb, inkColor.rgb, max(hl(gd.x), hl(gd.y)) * 0.18);
    vec3 tm = texture(TEXTMASK, vUv).rgb;
    if (soloPanel > 0) { tm *= vec3(soloPanel == 1 ? 1.0 : 0.0, soloPanel == 2 ? 1.0 : 0.0, soloPanel == 3 ? 1.0 : 0.0); }
    c = mix(c, inkColor.rgb, tm.r);
    c = mix(c, accentColor.rgb, tm.g * 0.8);
    c = mix(c, vec3(0.25, 0.55, 1.0), tm.b * 0.8);
    fragColor = vec4(c, 1.0);
    return;
  }
  float m = margin * U;
  vec2 un = (res - 2.0 * m) / vec2(32.0, 18.0);
  UN = un;
  vec2 g = (P - vec2(m)) / un;
  vec4 clk = stClock();
  float snap = (layoutMode == 1 && construction && clk.x > 0.5 && float(FRAMEINDEX) - clk.y < 2.0) ? 1.0 : 0.0;
  float gut = gutter * U * 0.5;

  vec3 col = groundColor.rgb;
  float bg = cov(length((fract(g + 0.5) - 0.5) * un) - 1.1 * U) * gridDots * 0.45;
  for (int k = 0; k < MAXL; k++) {
    vec4 r = texelFetch(state, ivec2(k, 3), 0);
    if (r.z < 0.5 || texelFetch(state, ivec2(k, 5), 0).y > 0.5) { continue; }
    for (int c = 0; c < 4; c++) {
      vec2 corner = vec2(m) + vec2((c & 1) == 0 ? r.x : r.z, (c & 2) == 0 ? r.y : r.w) * un;
      bg = max(bg, plusAt(P, corner, 6.0 * U));
    }
  }
  col = mix(col, inkColor.rgb, bg);
  for (int k = 0; k < MAXL; k++) {
    vec4 r = texelFetch(state, ivec2(k, 3), 0);
    if (r.z < 0.5) { continue; }
    vec4 meta = texelFetch(state, ivec2(k, 4), 0);
    vec4 sty = texelFetch(state, ivec2(k, 5), 0);
    bool tile = sty.y < 0.5;
    vec2 plo = vec2(m) + r.xy * un + (tile ? vec2(gut) : vec2(0.0));
    vec2 S = vec2(m) + r.zw * un - (tile ? vec2(gut) : vec2(0.0)) - plo;
    vec2 q = P - plo;
    if (q.x < 0.0 || q.y < 0.0 || q.x > S.x || q.y > S.y) { continue; }
    int role = int(meta.x + 0.5);
    if (tile) { drawTile(role, meta.y, q, S, clk, snap, col); }
    else { drawEditorial(role, sty, texelFetch(state, ivec2(k, 6), 0), int(meta.y + 0.5), q, S, clk, col); }
  }
  float n = hash12(gl_FragCoord.xy + float(FRAMEINDEX) * 13.37) - 0.5;
  fragColor = vec4(max(col + n * grain, vec3(0.0)), 1.0);
}
