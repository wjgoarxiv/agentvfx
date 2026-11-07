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
