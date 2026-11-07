// Scene 1, specimen: a deep ultramarine field; the plate as a single-tone lavender dither inside a tall arch; one ultra-tall
// thin word as a column; pink and cyan micro bars on the arch edges that are spectrum band levels; a solid black square with a
// semicircle that snaps to a new place of a fixed set on every cut; mono captions with live numbers. Palette: ground (field),
// ink (lavender), accent (pink), tintA (cyan), tintB (black). Text set 1.
vec2 spPair(float i) {
  if (i < 0.5) { return vec2(1.44, 0.10); }
  if (i < 1.5) { return vec2(0.50, 0.70); }
  if (i < 2.5) { return vec2(1.44, 0.62); }
  if (i < 3.5) { return vec2(1.14, 0.78); }
  if (i < 4.5) { return vec2(0.50, 0.08); }
  return vec2(1.22, 0.34);
}

void sceneSpecimen(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 lav = inkColor.rgb;
  vec3 pink = accentColor.rgb;
  vec3 cyan = tintA.rgb;
  vec3 blk = tintB.rgb;
  col = groundColor.rgb;
  col = mix(col, mix(groundColor.rgb, blk, 0.45), scAA(sdBox(c, vec2(0.03, 0.035), vec2(0.70, 0.965))));
  vec2 lo = vec2(0.76, 0.07);
  vec2 hi = vec2(1.36, 0.93);
  // dithered plate in the arch
  float px = scPx();
  vec2 pix = floor(q / px);
  float inside = scAA(sdArch(c, lo, hi));
  float l = pow(scTone((pix + 0.5) * px, lo * scU, hi * scU, 1.6, 0.15), 0.65) * 0.92 + 0.08 * hit.y;
  col = mix(col, mix(mix(groundColor.rgb, blk, 0.6), lav, step(scBayer(pix), l)), inside);
  col = mix(col, lav, scLine(sdArch(c, lo - 0.016, hi + 0.016), 1.0));
  // band-level micro bars on the straight sides of the arch: pink on the left, cyan on the right
  float y0 = (lo.y + 0.5 * (hi.x - lo.x)) * scU;
  float y1 = (hi.y - 0.02) * scU;
  float row = floor((q.y - y0) / 4.0);
  float t = clamp((row * 4.0 + 2.0) / (y1 - y0), 0.0, 1.0);
  float inRow = step(0.0, q.y - y0) * step(q.y, y1) * step(mod(q.y - y0, 4.0), 2.0);
  float lenL = floor((0.012 + 0.095 * bandAt(t)) * scU / 2.0) * 2.0;
  float lenR = floor((0.012 + 0.095 * bandAt(1.0 - t * 0.8)) * scU / 2.0) * 2.0;
  float xl = (lo.x - 0.016) * scU;
  float xr = (hi.x + 0.016) * scU;
  col = mix(col, pink, inRow * step(xl - lenL, q.x) * step(q.x, xl - 1.0));
  col = mix(col, cyan, inRow * step(xr + 1.0, q.x) * step(q.x, xr + lenR));
  // rules, ticks and a dot grid
  float rule = max(scLine(c.y - 0.035, 1.0), scLine(c.y - 0.965, 1.0)) * step(0.05, c.x) * step(c.x, A - 0.05);
  float tick = step(mod(q.x, 0.04 * scU), 1.0) * step(abs(c.y - 0.965), 0.014) * step(0.05, c.x) * step(c.x, A - 0.05);
  col = mix(col, lav, max(rule * 0.8, tick * 0.8));
  col = mix(col, lav, max(max(scPlus(c, vec2(0.03, 0.035), 0.016), scPlus(c, vec2(0.70, 0.035), 0.016)), max(scPlus(c, vec2(0.03, 0.965), 0.016), scPlus(c, vec2(0.70, 0.965), 0.016))));
  vec2 dg = (c - vec2(1.44, 0.83)) / 0.026;
  float dots = scAA((length(fract(dg) - 0.5) * 0.026 - 0.004)) * step(0.0, dg.x) * step(dg.x, 9.0) * step(0.0, dg.y) * step(dg.y, 4.0);
  col = mix(col, lav, dots * 0.7);
  // the tall word: Pretendard Thin stretched up and squeezed in
  float w = scWordThin(q, vec2(0.05, -0.05) * scU, vec2(0.0, 0.0), vec2(0.35, 1.43), 0, 3.5);
  col = mix(col, lav, w);
  // the black square and semicircle: a new place of the fixed set on every cut
  float i = mod(floor(clk.x) * 5.0 + floor(hash12(vec2(floor(clk.x / 6.0), 7.0)) * 6.0), 6.0);
  vec2 P = spPair(i);
  float s = 0.13;
  float sq = scAA(sdBox(c, P, P + s));
  vec2 sc = P + vec2(s, 0.5 * s);
  sc.x += 0.03;
  float semi = scAA(max(length(c - sc) - 0.5 * s, -(c.x - sc.x)));
  col = mix(col, blk, max(sq, semi));
  // captions and live numbers (MesloLGS NF)
  col = mix(col, lav, scSheet(q, 1));
  vec2 np = q - vec2(1.44, 0.50) * scU;
  float fs = 0.03 * scU;
  float num = aNum(np, fs, floor(stLevel().r * 99.0), 2) + aNum(np - vec2(3.0 * MONO_ADV * fs, 0.0), fs, floor(stLevel().g * 99.0), 2) + aNum(np - vec2(6.0 * MONO_ADV * fs, 0.0), fs, floor(stLevel().b * 99.0), 2);
  col = mix(col, pink, min(num, 1.0));
}
