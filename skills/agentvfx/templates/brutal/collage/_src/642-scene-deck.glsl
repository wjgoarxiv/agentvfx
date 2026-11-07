// Scene 6, deck: a hot pink field and a HUD deck of thin black lines. The plate sits in a chamfered octagon window; outlined
// tab-box labels (DIN Condensed, Pretendard) down the left, a particle cloud box that scatters on the onset, a starburst glyph
// whose rays are band levels and which steps round on every beat, a text ring that turns a notch per onset, a contour-map box whose
// terrain shifts on the beat, and a 0..5 ruler strip. Palette: ground (pink), ink (black), accent (white), tintA (lilac).
// Text set 6: r the tab labels, g captions, b the ring line.
float dkRing(vec2 q, vec2 ctr, float Rm, float band, float rot) {
  vec2 d = q - ctr;
  float r = length(d);
  float a = atan(d.y, d.x) / 6.28318 + 0.5 + rot;
  float k = scS.y / RENDERSIZE.y;
  vec2 sp = vec2(fract(a) * 6.28318 * Rm / k, 0.9 * RENDERSIZE.y + (Rm + 0.5 * band - r) / k);
  return sheetC(sp, 2) * step(abs(r - Rm), 0.5 * band);
}

void sceneDeck(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 ink = inkColor.rgb;
  vec3 white = accentColor.rgb;
  vec3 lil = tintA.rgb;
  col = groundColor.rgb;
  float cut = floor(clk.x);
  // octagon window with the plate
  vec2 lo = vec2(0.40, 0.08);
  vec2 hi = vec2(1.38, 0.74);
  float dO = sdChamfer(c, lo, hi, 0.2);
  vec3 f = scPlate(q, lo * scU, hi * scU);
  col = mix(col, clamp((f - 0.1) * 1.3, 0.0, 1.0), scAA(dO));
  col = mix(col, ink, scLine(dO, 2.0));
  col = mix(col, ink, scLine(sdChamfer(c, lo - 0.014, hi + 0.014, 0.23), 1.0));
  // particle cloud box (left), scatters on the onset
  vec2 pl = vec2(0.03, 0.46);
  vec2 ph = vec2(0.33, 0.9);
  float inBox = scBox(c, pl, ph);
  col = mix(col, lil, inBox);
  col = mix(col, ink, scLine(sdBox(c, pl, ph), 1.0));
  if (inBox > 0.5) {
    float dots = 0.0;
    for (int i = 0; i < 70; i++) {
      vec2 h = hash22(vec2(float(i), 3.7));
      float t = (h.x - 0.5) * 1.6;
      vec2 p = vec2(0.18, 0.68) + vec2(t * 0.1, -t * 0.12) + (hash22(vec2(float(i), 9.1)) - 0.5) * 0.07;
      p += (hash22(vec2(float(i), clk.z)) - 0.5) * 0.12 * step(0.45, hit.x);
      dots = max(dots, scAA(length(c - p) - 0.0035));
    }
    col = mix(col, ink, dots);
  }
  // starburst glyph, top right, one notch per beat
  vec2 sb = vec2(1.58, 0.2);
  col = mix(col, ink, scBurst(c - sb, 0.12, 0.012, cut * 0.2618, 36.0));
  col = mix(col, white, scAA(sdBox(c, sb - 0.008, sb + 0.008)));
  // text ring, bottom right, a notch per onset
  vec2 rc = vec2(1.58, 0.52);
  col = mix(col, ink, dkRing(q, rc * scU, 0.11 * scU, 0.03 * scU, clk.z * 0.04));
  col = mix(col, ink, scLine(length(c - rc) - 0.075, 1.0));
  // contour map box, bottom right, terrain shifts on the beat
  vec2 ml = vec2(0.98, 0.78);
  vec2 mh = vec2(1.72, 0.96);
  float inM = scBox(c, ml, mh);
  col = mix(col, lil, inM);
  float v = fbm(c * vec2(5.0, 7.0) + cut * 0.9, 4) * 9.0;
  float iso = clamp(1.0 - abs(fract(v) - 0.5) * 2.0 / max(fwidth(v) * 1.5, 1e-3), 0.0, 1.0);
  col = mix(col, ink, iso * inM * 0.9);
  col = mix(col, ink, scLine(sdBox(c, ml, mh), 1.0));
  float cell = scCell();
  col = mix(col, ink, numTxt(q, vec2(0.98, 0.745) * scU, cell, mod(cut * 37.0 + 1275.0, 10000.0), 4));
  // ruler strip, bottom left
  float rk = (c.x - 0.03) / 0.3 * 25.0;
  float major = step(abs(rk - floor(rk / 5.0 + 0.5) * 5.0), 0.2) * step(0.0, rk) * step(rk, 25.2);
  float minor = step(abs(rk - floor(rk + 0.5)), 0.2) * step(0.0, rk) * step(rk, 25.2);
  col = mix(col, ink, max(major * step(0.93, c.y) * step(c.y, 0.975), minor * step(0.93, c.y) * step(c.y, 0.953)));
  float amp = waveI(floor(clamp(rk, 0.0, 25.0) / 25.0 * 255.0) * 2.0) * scopeGain * 0.03;
  col = mix(col, ink, scLine(c.y - 0.915 - amp, 1.2) * step(0.0, rk) * step(rk, 25.0));
  // labels in tab boxes, captions
  col = mix(col, ink, scSheet(q, 0));
  col = mix(col, ink, scSheet(q, 1));
}
