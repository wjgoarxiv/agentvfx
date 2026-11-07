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
