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
