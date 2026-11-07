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
