// Scene 19 (variant 9, rot 1), liquid-type: a sky-blue field; the plate blurred and thresholded into ink-blot shapes (mid blue, one
// orange blot in the brightest part); a big Bodoni 72 word on a double sine ripple whose phase steps on every beat; a typed American
// Typewriter note and a crosshair reticle that jumps to a new place on every beat. Palette: ground (sky), ink (navy), accent (orange),
// tintA (pale), tintB (mid blue). Text set 20: r the word (Bodoni 72), g the typed note (American Typewriter).
void sceneLiquid(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 navy = inkColor.rgb;
  vec3 org = accentColor.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // ink blots: blurred plate luma thresholded
  float b = 0.0;
  float r = 7.0 * U * 3.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    b += luma(scPlate(q + r * vec2(cos(a), sin(a)), vec2(0.0), S));
  }
  b = b / 8.0;
  float thr = 0.3 - 0.05 * hit.y;
  col = mix(col, tintB.rgb, smoothstep(thr, thr + 0.025, b));
  col = mix(col, org, smoothstep(0.5, 0.53, b));
  // liquid word
  float ph = cut * 0.9;
  vec2 sq = q + scU * vec2(0.02 * sin(c.y * 14.0 + ph), 0.03 * sin(c.x * 6.0 + ph * 1.3));
  float m = crisp(sheetC(sq * (RENDERSIZE / scS), 0), 1.0);
  col = mix(col, navy, m);
  // reticle
  vec2 rp = vec2(0.3 + (A - 0.6) * hash12(vec2(cut, 2.0)), 0.25 + 0.5 * hash12(vec2(cut, 5.0)));
  col = mix(col, navy, max(scLine(length(c - rp) - 0.06, 1.2), max(scLine(c.x - rp.x, 1.0) * step(abs(c.y - rp.y), 0.1) * step(0.03, abs(c.y - rp.y)), scLine(c.y - rp.y, 1.0) * step(abs(c.x - rp.x), 0.1) * step(0.03, abs(c.x - rp.x)))));
  col = mix(col, navy, numTxt(q, (rp + vec2(0.07, 0.06)) * scU, scCell(), mod(cut * 17.0, 1000.0), 3));
  col = mix(col, navy, scSheet(q, 1));
  col = mix(col, navy, max(scPlus(c, vec2(0.06, 0.06), 0.02), scPlus(c, vec2(A - 0.06, 0.94), 0.02)));
}
