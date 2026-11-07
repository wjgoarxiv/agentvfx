// Scene 5, anatomy: a sepia paper field, a huge cropped serif numeral, a dark panel holding the plate as a cream hairline wireframe
// (edge detection), a thin ring around it, three callout cables to labels, a checkerboard tower of the mid level and tiny code
// columns. The wireframe grows denser on every beat and a rust scan band jumps to a new height on every cut, turning the lines it
// crosses rust. Palette: ground (tan paper), ink (umber), accent (rust), tintA (dark umber), tintB (cream). Text set 5: Times and
// Pretendard Light.
void sceneAnatomy(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 ink = inkColor.rgb;
  vec3 rust = accentColor.rgb;
  vec3 dark = tintA.rgb;
  vec3 cream = tintB.rgb;
  col = groundColor.rgb;
  col = mix(col, ink, scSheet(q, 0));
  vec2 lo = vec2(0.52, 0.05);
  vec2 hi = vec2(1.30, 0.95);
  float inP = scBox(c, lo, hi);
  col = mix(col, dark, inP);
  float e = scEdge(q, lo * scU, hi * scU, max(1.5, 4.0 * U));
  float thr = 0.1 - 0.05 * hit.y;
  float wire = smoothstep(thr, thr + 0.07, e) * inP;
  float bandY = 0.08 + 0.84 * fract(floor(clk.x) * 0.137);
  float inBand = step(abs(c.y - bandY), 0.03);
  col = mix(col, cream, 0.14 * inBand * inP);
  col = mix(col, mix(cream, rust, inBand), wire);
  col = mix(col, ink, scLine(sdBox(c, lo, hi), 1.0));
  // ring and ticks around the panel
  vec2 ctr = vec2(0.91, 0.5);
  float d = length(c - ctr);
  float a = atan(c.y - ctr.y, c.x - ctr.x) / 6.28318;
  col = mix(col, ink, max(scLine(d - 0.47, 1.0), scLine(d - 0.5, 1.0) * step(fract(a * 90.0), 0.35)));
  // callout cables and labels
  for (int i = 0; i < 3; i++) {
    vec2 A0 = i == 0 ? vec2(1.05, 0.42) : (i == 1 ? vec2(0.98, 0.58) : vec2(0.9, 0.7));
    vec2 T = vec2(1.38, 0.2 + 0.3 * float(i));
    col = mix(col, ink, wCable(c, A0, T, 1.0));
    col = mix(col, rust, scAA(sdBox(c, A0 - 0.006, A0 + 0.006)));
  }
  // checkerboard tower of the mid level, tiny code columns
  vec2 tg = floor((c - vec2(0.45, 0.95)) / vec2(0.02, -0.02));
  float h = stLevel().g * 20.0 + 2.0;
  col = mix(col, ink, step(0.0, tg.x) * step(tg.x, 2.0) * step(0.0, tg.y) * step(tg.y + 0.5, h) * step(mod(tg.x + tg.y, 2.0), 0.5));
  float cell = scCell();
  float code = 0.0;
  for (int i = 0; i < 9; i++) { code = max(code, numTxt(q, vec2(1.40, 0.82 + 0.014 * float(i)) * scU, max(1.0, cell - 1.0), floor(hash12(vec2(float(i), clk.x)) * 9999.0), 4)); }
  col = mix(col, rust, code);
  col = mix(col, ink, scSheet(q, 1));
}
