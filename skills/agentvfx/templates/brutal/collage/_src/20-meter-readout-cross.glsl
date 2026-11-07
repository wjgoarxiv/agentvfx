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
