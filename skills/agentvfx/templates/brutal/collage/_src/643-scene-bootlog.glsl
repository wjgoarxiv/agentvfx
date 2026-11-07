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
