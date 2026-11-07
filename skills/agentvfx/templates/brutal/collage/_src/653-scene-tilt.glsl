// Scene 16 (variant 6, rot 1), tilt-tiles: a lemon field tilted about 14 degrees into rows of Rockwell word tiles. Neighbouring rows flow
// the other way and each beat every row jumps a different distance; filled and outlined rows alternate, and each onset swaps the kind
// of one row. A tilted window holds the plate as a three-tone posterize (black, lemon, white); a white caption box, a numbered black disc.
// Palette: ground (lemon), ink (black), accent (white), tintA (deep green). Text set 17: r filled word, g outlined word, b caption.
void sceneTilt(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 blk = inkColor.rgb;
  vec3 wht = accentColor.rgb;
  float cut = floor(clk.x * 0.5);
  col = groundColor.rgb;
  vec2 pr = stRot(c - vec2(0.5 * A, 0.5), 0.24);
  float rowH = 0.14;
  float n = floor(pr.y / rowH);
  float v = pr.y - n * rowH;
  float dir = mod(n, 2.0) < 0.5 ? 1.0 : -1.0;
  float off = dir * cut * (0.14 + 0.05 * mod(abs(n), 3.0));
  float u = mod(pr.x + off, 0.92);
  float k = RENDERSIZE.y;
  float swp = step(abs(mod(n, 7.0) - mod(clk.z, 7.0)), 0.5);
  int ch = mod(n + swp, 2.0) < 0.5 ? 0 : 1;
  float m = crisp(sheetC(vec2(u * 0.5 * k, (0.0478 + (v - 0.07) * 0.5) * k), ch), 1.0);
  col = mix(col, blk, m);
  col = mix(col, blk, scLine(v, 1.0) * 0.6);
  // tilted window with the posterized plate
  vec2 wc = vec2(0.04, 0.0);
  vec2 wh = vec2(0.5, 0.25);
  float inW = scAA(sdBox(pr, wc - wh, wc + wh));
  float l = scTone(q, vec2(0.0), S, 1.5, 0.05);
  vec3 pz = l < 0.3 ? blk : (l < 0.62 ? groundColor.rgb : wht);
  col = mix(col, pz, inW);
  col = mix(col, blk, scLine(sdBox(pr, wc - wh, wc + wh), 3.0));
  // caption box, numbered disc
  col = mix(col, wht, scAA(sdBox(c, vec2(0.04, 0.86), vec2(0.7, 0.97))));
  col = mix(col, blk, scSheet(q, 2) * scBox(c, vec2(0.04, 0.86), vec2(0.7, 0.97)));
  vec2 dc = vec2(A - 0.14, 0.15);
  col = mix(col, blk, scAA(length(c - dc) - 0.09));
  col = mix(col, wht, numTxt(q, (dc - vec2(0.035, 0.03)) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
  col = mix(col, tintA.rgb, scLine(length(c - dc) - 0.115, 2.0));
}
