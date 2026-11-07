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
