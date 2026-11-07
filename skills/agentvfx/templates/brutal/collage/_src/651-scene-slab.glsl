// Scene 14 (variant 4, rot 1), slab-shear: a concrete-grey field with a giant Futura word that flows on a sine wave (the wave steps on
// every beat) and is cut into nine horizontal slabs; on every beat some slabs slide sideways and two become safety-blue slabs holding
// the plate as a 1-bit Bayer dither with the word in white; a typed Menlo label sits on a seam, with a crosshair target and ticks.
// Palette: ground (concrete), ink (white), accent (safety blue), tintA (black). Text set 15: r the giant word, g the typed label.
void sceneSlab(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 blue = accentColor.rgb;
  vec3 blk = tintA.rgb;
  float cut = floor(clk.x);
  float slab = floor(c.y / 0.1111);
  float h = hash12(vec2(slab, cut));
  float shift = (step(0.55, h) * (fract(h * 9.0) - 0.5)) * 0.2 * scU;
  float isBlue = step(0.82, hash12(vec2(slab, cut + 31.0)));
  float wave = 0.045 * sin(c.x * 7.0 + cut * 0.9) * scU;
  float grain = fbm(c * 40.0, 3);
  col = groundColor.rgb * (0.88 + 0.2 * grain);
  vec2 sq = q + vec2(shift, wave);
  float m = crisp(sheetC(sq * (RENDERSIZE / scS), 0), 1.0);
  if (isBlue > 0.5) {
    float px = scPx();
    vec2 pix = floor(q / px);
    float l = scTone((pix + 0.5) * px, vec2(0.0), S, 1.6, 0.05);
    col = mix(blk, blue, step(scBayer(pix), l));
    col = mix(col, inkColor.rgb, m);
  } else {
    col = mix(col, blk, m);
  }
  // seams between slabs and a typed label on one of them
  float seam = scLine(fract(c.y / 0.1111 + 0.5) * 0.1111 - 0.0555, 1.0);
  col = mix(col, blk, seam * 0.35);
  col = mix(col, blk, step(mod(q.x, 0.03 * scU), 1.0) * step(abs(c.y - 0.2222), 0.008));
  col = mix(col, blk, scSheet(q, 1));
  vec2 t = vec2(A - 0.2, 0.5);
  float rr = length(c - t);
  col = mix(col, blk, max(scLine(rr - 0.09, 1.2), max(scLine(rr - 0.04, 1.0), max(scLine(c.x - t.x, 1.0) * step(abs(c.y - t.y), 0.12), scLine(c.y - t.y, 1.0) * step(abs(c.x - t.x), 0.12)))));
  col = mix(col, blk, numTxt(q, vec2(0.04, 0.93) * scU, scCell() * 2.0, mod(cut * 14.0, 1000.0), 3));
}
