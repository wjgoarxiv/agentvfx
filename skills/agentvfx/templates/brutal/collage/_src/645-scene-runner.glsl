// Scene 9, runner: the plate as a grey monotone under scanline bands (a few bands slide sideways on every onset), glowing
// white-hot data streaks whose length is the spectrum and which jump on the onset, and a vermilion bar carrying a heavy Arial Black
// word that swaps to the next of three words and slams to a new left edge on every beat. Black pixel crosses, MesloLGS NF captions.
// Palette: ground (black), ink (white-hot), accent (vermilion), tintA (black), tintB (light grey). Text set 9: r, g, b are
// the three words (same place), the captions are on r above the bar.
void sceneRunner(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 hotc = inkColor.rgb;
  vec3 verm = accentColor.rgb;
  vec3 blk = tintA.rgb;
  vec3 sky = tintB.rgb;
  float cut = floor(clk.x);
  float band = floor(q.y / (4.0 * max(U * 3.0, 1.0)));
  float slide = step(0.9, hash12(vec2(band, clk.z))) * (hash12(vec2(band, clk.z + 7.0)) - 0.5) * 0.12 * scU;
  float l = clamp((luma(scPlate(q + vec2(slide, 0.0), vec2(0.0), S)) - 0.06) * 1.6, 0.0, 1.0);
  float stripe = 0.78 + 0.22 * step(0.5, fract(band * 0.5));
  col = mix(groundColor.rgb, sky, smoothstep(0.0, 1.0, l)) * stripe;
  // streaks
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float y = 0.04 + 0.92 * hash12(vec2(fi, 1.3));
    float len = 0.12 + 0.55 * bandAt(hash12(vec2(fi, 2.9)));
    float x0 = A * hash12(vec2(fi, clk.z));
    float u = clamp((c.x - (x0 - len)) / len, 0.0, 1.0);
    float s = scLine(c.y - y, 1.3) * step(x0 - len, c.x) * step(c.x, x0);
    col = mix(col, hotc, s * u * u * 0.9);
  }
  // the bar: its left edge slams to one of three places on the beat, the word swaps
  float pos = mod(cut, 3.0);
  float x0 = pos < 0.5 ? 0.0 : (pos < 1.5 ? 0.22 : 0.08);
  col = mix(col, verm, scAA(sdBox(c, vec2(x0, 0.6), vec2(A + 0.1, 0.79))));
  float w = pos < 0.5 ? scSheet(q, 0) : (pos < 1.5 ? scSheet(q, 1) : scSheet(q, 2));
  col = mix(col, blk, w * step(x0, c.x) * step(0.58, c.y) * step(c.y, 0.8));
  col = mix(col, blk, max(scPlus(c, vec2(x0 + 0.04, 0.6), 0.015), scPlus(c, vec2(A - 0.05, 0.79), 0.015)));
  float cell = scCell();
  col = mix(col, hotc, numTxt(q, vec2(0.06, 0.1) * scU, cell * 2.0, mod(cut * 11.0, 1000.0), 3));
  col = mix(col, hotc, scSheet(q, 0) * step(c.y, 0.5) * step(0.2, c.y));
  vec2 ck = floor((c - vec2(A - 0.34, 0.86)) / 0.025);
  col = mix(col, blk, step(0.0, ck.x) * step(ck.x, 9.0) * step(0.0, ck.y) * step(ck.y, 2.0) * step(1.0, mod(ck.x + ck.y, 2.0)));
}
