// spectrogram-scroll pass1: HUD chrome. Generated layout constants below match the text items in fx.json.
#define KIND 3
#define CLOUD_PTS 0
#define DIAMOND 0
#define C_LO vec2(0.21, 0.12)
#define C_HI vec2(0.79, 0.88)
#define GRID_X 10
#define GRID_Y 6
#define READ_B int(clamp(AUDIO_BPM, 0.0, 999.0))
// HUD pass: chrome mask. R = hard ink (frames, ticks, digits, graph lines), G = faint ink (dashed grids, minor marks).
// Layout constants here are shared with the text items of fx.json (x right, y up in uv; text y counts from the top).
// KIND 0 = square XY panel, 1 = wide scope panel, 2 = polar panel, 3 = spectrogram panel.
const float U = 1.0 / 1080.0;
float ASP;
float AA;

float cov(float d) { return clamp(0.5 - d / AA, 0.0, 1.0); }
float stroke(float d, float w) { return cov(abs(d) - 0.5 * w); }
float sdBox(vec2 p, vec2 h) {
  vec2 d = abs(p) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
vec2 hu(vec2 uv, vec2 c) { return (uv - c) * vec2(ASP, 1.0); }
float panelSd(vec2 uv, vec2 lo, vec2 hi, float r) {
  vec2 h = 0.5 * (hi - lo) * vec2(ASP, 1.0);
  return sdBox(hu(uv, 0.5 * (lo + hi)), h - r) - r;
}
float inside(vec2 uv, vec2 lo, vec2 hi) { return cov(panelSd(uv, lo, hi, 0.0) + 2.0 * U); }

float gridDashed(vec2 uv, vec2 lo, vec2 hi, int nx, int ny) {
  vec2 n = vec2(float(nx), float(ny));
  vec2 sz = (hi - lo) * vec2(ASP, 1.0);
  vec2 f = abs(fract((uv - lo) / (hi - lo) * n + 0.5) - 0.5) * sz / n;
  vec2 along = (uv - lo) * vec2(ASP, 1.0);
  float vx = stroke(f.x, 1.0 * U) * step(fract(along.y / (9.0 * U)), 0.4);
  float hy = stroke(f.y, 1.0 * U) * step(fract(along.x / (9.0 * U)), 0.4);
  return max(vx, hy) * inside(uv, lo, hi);
}

float ticks(vec2 uv, vec2 lo, vec2 hi, int nx, int ny) {
  vec2 sz = (hi - lo) * vec2(ASP, 1.0);
  vec2 loc = max((uv - lo) * vec2(ASP, 1.0), 0.0);
  vec2 n = vec2(float(nx * 5), float(ny * 5));
  vec2 k = loc / (sz / n);
  vec2 f = abs(fract(k + 0.5) - 0.5) * sz / n;
  ivec2 ik = ivec2(floor(k + 0.5));
  float lx = (ik.x % 5 == 0) ? 14.0 * U : 7.0 * U;
  float ly = (ik.y % 5 == 0) ? 14.0 * U : 7.0 * U;
  float tb = stroke(f.x, 1.2 * U) * step(loc.y, lx);
  float tl = stroke(f.y, 1.2 * U) * step(loc.x, ly);
  return max(tb, tl) * inside(uv, lo, hi);
}

float plusAt(vec2 uv, vec2 c, float arm) {
  vec2 d = hu(uv, c);
  return max(stroke(d.y, 1.2 * U) * step(abs(d.x), arm), stroke(d.x, 1.2 * U) * step(abs(d.y), arm));
}

float brackets(vec2 uv, vec2 lo, vec2 hi) {
  vec2 a = abs(hu(uv, 0.5 * (lo + hi)));
  vec2 h = 0.5 * (hi - lo) * vec2(ASP, 1.0) + 10.0 * U;
  float arm = 36.0 * U;
  float w = 2.6 * U;
  float hz = stroke(a.y - h.y, w) * step(h.x - arm, a.x) * step(a.x, h.x + 0.5 * w);
  float vt = stroke(a.x - h.x, w) * step(h.y - arm, a.y) * step(a.y, h.y + 0.5 * w);
  return max(hz, vt);
}

float icon(vec2 uv, vec2 c, int k) {
  vec2 q = hu(uv, c) / (9.0 * U);
  float d;
  if (k == 0) d = abs(length(q) - 1.0);
  else if (k == 1) d = abs(max(abs(q.x), abs(q.y)) - 0.85);
  else if (k == 2) d = min(abs(length(q) - 1.0), min(abs(q.x) + 9.0 * step(0.7, abs(q.y)), abs(q.y) + 9.0 * step(0.7, abs(q.x))));
  else {
    q.y += 0.15;
    d = abs(max(abs(q.x) * 0.866 + q.y * 0.5, -q.y) - 0.6);
  }
  return cov(d * 9.0 * U - 0.6 * U);
}

float rowv(int row, int i) { return texelFetch(audio, ivec2(clamp(i, 0, 511), row), 0).r * 2.0 - 1.0; }

float specU(float t) {
  float f = 40.0 * pow(400.0, clamp(t, 0.0, 1.0));
  float v = texture(audioFFT, vec2(((f - 29.3) / 46.875 + 0.5) / 512.0, 0.5)).r;
  return clamp((v * 70.0 - 70.0 + 3.0 * log2(f / 1000.0) + 62.0) / 38.0, 0.0, 1.0);
}

float trace(vec2 uv, vec2 lo, vec2 hi, float y0, float y1) {
  float lo_ = min(y0, y1);
  float hi_ = max(y0, y1);
  return cov(max(lo_ - uv.y, uv.y - hi_) - 0.7 * U) * inside(uv, lo, hi);
}

float specGraph(vec2 uv, vec2 lo, vec2 hi) {
  float t = (uv.x - lo.x) / (hi.x - lo.x);
  float st = 1.5 * AA / ((hi.x - lo.x) * ASP);
  float v0 = max(specU(t - st), specU(t));
  float v1 = max(specU(t), specU(t + st));
  return trace(uv, lo, hi, lo.y + v0 * (hi.y - lo.y) * 0.96, lo.y + v1 * (hi.y - lo.y) * 0.96);
}

float waveStrip(vec2 uv, vec2 lo, vec2 hi) {
  float t = (uv.x - lo.x) / (hi.x - lo.x);
  int i = int(t * 511.0);
  float c = 0.5 * (lo.y + hi.y);
  float h = 0.45 * (hi.y - lo.y);
  float a = clamp(rowv(0, i) * 2.5, -1.0, 1.0);
  float b = clamp(rowv(0, i + 1) * 2.5, -1.0, 1.0);
  return trace(uv, lo, hi, c + a * h, c + b * h);
}

float cloud(vec2 uv, vec2 lo, vec2 hi) {
  vec2 hs = 0.5 * (hi - lo) * vec2(ASP, 1.0);
  vec2 q = hu(uv, 0.5 * (lo + hi));
  float m = 1.0e3;
  for (int k = 0; k < 127; k++) {
    int i = k * 4;
#if CLOUD_PTS
    int cols = int(min(RENDERSIZE.x, 512.0));
    vec2 v = texelFetch(pts, ivec2(i % cols, i / cols), 0).xy / 0.4;
#else
    vec2 v = tanh(2.0 * vec2(rowv(0, i), rowv(1, i)));
#endif
    m = min(m, length(q - v * hs * 0.9));
  }
  return cov(m - 1.3 * U) * inside(uv, lo, hi);
}

float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float digit(vec2 p, int d) {
  int m = d == 0 ? 63 : d == 1 ? 6 : d == 2 ? 91 : d == 3 ? 79 : d == 4 ? 102 : d == 5 ? 109 : d == 6 ? 125 : d == 7 ? 7 : d == 8 ? 127 : 111;
  float b = 1.0e3;
  if ((m & 1) != 0) b = min(b, segD(p, vec2(0.0, 1.0), vec2(0.5, 1.0)));
  if ((m & 2) != 0) b = min(b, segD(p, vec2(0.5, 1.0), vec2(0.5, 0.5)));
  if ((m & 4) != 0) b = min(b, segD(p, vec2(0.5, 0.5), vec2(0.5, 0.0)));
  if ((m & 8) != 0) b = min(b, segD(p, vec2(0.0, 0.0), vec2(0.5, 0.0)));
  if ((m & 16) != 0) b = min(b, segD(p, vec2(0.0, 0.5), vec2(0.0, 0.0)));
  if ((m & 32) != 0) b = min(b, segD(p, vec2(0.0, 1.0), vec2(0.0, 0.5)));
  if ((m & 64) != 0) b = min(b, segD(p, vec2(0.0, 0.5), vec2(0.5, 0.5)));
  return b;
}

float number(vec2 uv, vec2 org, float h, int val, int n) {
  vec2 q = hu(uv, org);
  float best = 1.0e3;
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    int pw = 1;
    for (int j = 1; j < 4; j++) if (j < n - i) pw *= 10;
    int dv = (max(val, 0) / pw) % 10;
    vec2 p = vec2(q.x - float(i) * 0.8 * h, q.y + h) / h;
    if (p.x > -0.3 && p.x < 0.85 && p.y > -0.3 && p.y < 1.3) best = min(best, digit(p, dv) * h);
  }
  return cov(best - 0.8 * U);
}

#if KIND == 2
float polarGrid(vec2 uv, out float hard) {
  vec2 q = hu(uv, vec2(0.5));
  float r = length(q);
  float a = atan(q.y, q.x);
  hard = stroke(r - ringRadius, 1.3 * U) + stroke(r - 0.36, 1.1 * U);
  float f = stroke(r - ringRadius - depth, 1.0 * U) + stroke(r - max(ringRadius - depth, 0.01), 1.0 * U);
  if (spokes > 0) {
    float st = 6.28318530718 / float(spokes);
    float da = abs(mod(a + 0.5 * st, st) - 0.5 * st) * r;
    f += stroke(da, 1.0 * U) * step(ringRadius - depth, r) * step(r, ringRadius + depth) * 0.8;
  }
  return f;
}
#endif

void main() {
  ASP = RENDERSIZE.x / RENDERSIZE.y;
  AA = 1.0 / RENDERSIZE.y;
  vec2 uv = vUv;
  float hard = 0.0;
  float faint = 0.0;
  vec2 cLo = C_LO;
  vec2 cHi = C_HI;

  hard = max(hard, stroke(panelSd(uv, cLo, cHi, 0.0), 1.4 * U));
  hard = max(hard, brackets(uv, cLo, cHi));
  faint = max(faint, gridDashed(uv, cLo, cHi, GRID_X, GRID_Y));
  hard = max(hard, ticks(uv, cLo, cHi, GRID_X, GRID_Y) * 0.9);
  hard = max(hard, plusAt(uv, 0.5 * (cLo + cHi), 14.0 * U));
#if KIND == 0
  vec2 hs = 0.5 * (cHi - cLo) * vec2(ASP, 1.0);
  vec2 q = hu(uv, 0.5 * (cLo + cHi));
  float dm = (abs(q.x) / hs.x + abs(q.y) / hs.y - 1.0) * hs.y * 0.7;
  float dg = min(abs(q.x - q.y), abs(q.x + q.y)) * 0.7071;
#if DIAMOND
  hard = max(hard, stroke(dm, 1.3 * U) * inside(uv, cLo, cHi));
  faint = max(faint, stroke(dg, 1.0 * U) * inside(uv, cLo, cHi) * step(fract(length(q) / (9.0 * U)), 0.4));
  faint = max(faint, stroke(length(q) - 0.5 * hs.y, 1.0 * U) * 0.8);
#endif
#elif KIND == 1
  hard = max(hard, stroke(uv.y - 0.5 * (cLo.y + cHi.y), 1.3 * U) * inside(uv, cLo, cHi));
#elif KIND == 2
  float ph;
  faint = max(faint, polarGrid(uv, ph));
  hard = max(hard, ph * inside(uv, cLo, cHi));
#elif KIND == 3
  for (int i = 0; i < 3; i++) {
    float f = i == 0 ? 100.0 : (i == 1 ? 1000.0 : 10000.0);
    float v = freqScale == 1 ? (f - fMin) / (fMax - fMin) : (freqScale == 2 ? (sqrt(f) - sqrt(fMin)) / (sqrt(fMax) - sqrt(fMin)) : log(f / fMin) / log(fMax / fMin));
    float y = cLo.y + v * (cHi.y - cLo.y);
    faint = max(faint, stroke(uv.y - y, 1.0 * U) * inside(uv, cLo, cHi) * step(fract(hu(uv, cLo).x / (9.0 * U)), 0.5));
  }
#endif

  vec2 clo = vec2(0.022, 0.25);
  vec2 chi = vec2(0.175, 0.64);
  vec2 wlo = vec2(0.022, 0.07);
  vec2 whi = vec2(0.175, 0.16);
  vec2 slo = vec2(0.855, 0.57);
  vec2 shi = vec2(0.975, 0.77);
  vec2 rlo = vec2(0.855, 0.20);
  vec2 rhi = vec2(0.975, 0.46);
  hard = max(hard, stroke(panelSd(uv, clo, chi, 6.0 * U), 1.3 * U));
  hard = max(hard, cloud(uv, clo, chi));
  faint = max(faint, gridDashed(uv, clo, chi, 4, 6) * 0.8);
  hard = max(hard, stroke(panelSd(uv, wlo, whi, 4.0 * U), 1.3 * U));
  hard = max(hard, waveStrip(uv, wlo, whi));
  hard = max(hard, ticks(uv, wlo, whi, 5, 1) * 0.8);
  hard = max(hard, stroke(panelSd(uv, slo, shi, 0.0), 1.3 * U));
  faint = max(faint, gridDashed(uv, slo, shi, 4, 6));
  hard = max(hard, specGraph(uv, slo, shi));
  hard = max(hard, stroke(panelSd(uv, rlo, rhi, 6.0 * U), 1.3 * U));
  for (int i = 0; i < 4; i++) {
    hard = max(hard, icon(uv, vec2(0.04 + 0.04 * float(i), 0.69), i));
    hard = max(hard, icon(uv, vec2(0.868 + 0.034 * float(i), 0.51), (i + 2) % 4));
  }
  float lvl = 0.0;
  lvl = max(lvl, number(uv, vec2(0.915, 0.415), 0.03, int(clamp(AUDIO_RMS * 100.0, 0.0, 99.0)), 2));
  lvl = max(lvl, number(uv, vec2(0.915, 0.335), 0.03, READ_B, 3));
  lvl = max(lvl, number(uv, vec2(0.915, 0.255), 0.03, FRAMEINDEX % 10000, 4));
  hard = max(hard, lvl);
  hard = max(hard, plusAt(uv, vec2(0.012, 0.975), 8.0 * U));
  hard = max(hard, plusAt(uv, vec2(0.988, 0.975), 8.0 * U));
  hard = max(hard, plusAt(uv, vec2(0.012, 0.025), 8.0 * U));
  hard = max(hard, plusAt(uv, vec2(0.988, 0.025), 8.0 * U));
  fragColor = vec4(hard, faint, 0.0, 1.0);
}
