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
