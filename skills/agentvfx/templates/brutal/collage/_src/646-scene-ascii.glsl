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
