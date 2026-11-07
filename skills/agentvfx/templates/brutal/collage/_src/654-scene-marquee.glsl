// Scene 17 (variant 7, rot 1), marquee-stack: a teal field of six stacked word rows. Every beat each row jumps its own distance in its own
// direction (a marquee that moves in steps, not a scroll); each row has three echo copies trailing in colour steps (dark teal,
// tangerine, cream shade); the last row is Hangul. A cream-framed window holds the plate as a coarse four-colour mosaic. Palette: ground
// (teal), ink (cream), accent (tangerine), tintA (dark teal). Text set 18: r the word (Gill Sans Bold), g the Hangul word, b the caption.
void sceneMarquee(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 cream = inkColor.rgb;
  vec3 tang = accentColor.rgb;
  vec3 deep = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  float n = floor((c.y - 0.05) / 0.15);
  float v = (c.y - 0.05) - n * 0.15;
  float k = RENDERSIZE.y;
  if (n >= 0.0 && n < 6.0) {
    float dk = n < 0.5 ? 0.25 : (n < 1.5 ? 0.42 : (n < 2.5 ? 0.6 : (n < 3.5 ? 0.33 : (n < 4.5 ? 0.5 : 0.7))));
    float dir = mod(n, 2.0) < 0.5 ? 1.0 : -1.0;
    float off = dir * (cut * dk + clk.z * 0.02 * dk);
    int ch = n > 4.5 ? 1 : 0;
    for (int e = 3; e >= 0; e--) {
      float oe = off + dir * float(e) * 0.07;
      float u = mod(c.x + oe, 0.95);
      float m = crisp(sheetC(vec2(u * 0.5 * k, (0.0478 + (v - 0.075) * 0.5) * k), ch), 1.0);
      vec3 ec = e == 3 ? deep : (e == 2 ? tang : (e == 1 ? cream * 0.78 : cream));
      col = mix(col, ec, m);
    }
  }
  col = mix(col, cream, scLine(fract((c.y - 0.05) / 0.15) * 0.15, 1.0) * 0.0);
  // mosaic window
  vec2 lo = vec2(1.1, 0.2);
  vec2 hi = vec2(1.64, 0.8);
  float blk = 0.022 * scU;
  vec2 mq = (floor(q / blk) + 0.5) * blk;
  float l = pow(scTone(mq, lo * scU, hi * scU, 1.5, 0.02), 0.6);
  vec3 mc = l < 0.25 ? deep : (l < 0.5 ? groundColor.rgb * 1.25 : (l < 0.75 ? tang : cream));
  col = mix(col, mc, scAA(sdBox(c, lo, hi)));
  col = mix(col, cream, scLine(sdBox(c, lo - 0.012, hi + 0.012), 3.0));
  // caption bar, disc, crosses
  col = mix(col, cream, scAA(sdBox(c, vec2(0.04, 0.955), vec2(0.8, 1.01))));
  col = mix(col, deep, scSheet(q, 2) * scBox(c, vec2(0.04, 0.955), vec2(0.8, 1.01)));
  col = mix(col, tang, scAA(length(c - vec2(A - 0.12, 0.88)) - 0.07));
  col = mix(col, deep, numTxt(q, vec2(A - 0.155, 0.855) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
  col = mix(col, cream, max(scPlus(c, vec2(1.05, 0.15), 0.02), scPlus(c, vec2(1.69, 0.85), 0.02)));
}
