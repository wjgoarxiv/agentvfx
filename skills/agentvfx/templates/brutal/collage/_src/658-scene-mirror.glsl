// Scene 21 (variant 1, rot 2), mirror-track: a violet field and a central window holding the plate mirrored about its vertical axis and
// solarized into navy / brick / cream. Five outline target squares with tiny number labels jump to new places on every beat and are
// mirrored with the plate; a barcode strip re-seeds on every beat; a file-lookup text block with struck-through rows (D2Coding) and a big
// Phosphate word. Palette: ground (dusty violet), ink (cream), accent (brick red), tintA (indigo), tintB (pale violet). Text set 22: r the word, g the file block.
void sceneMirror(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 cream = inkColor.rgb;
  vec3 navy = accentColor.rgb;
  vec3 dk = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  vec2 lo = vec2(0.34, 0.08);
  vec2 hi = vec2(A - 0.06, 0.8);
  float wc = 0.5 * (lo.x + hi.x);
  vec2 qm = vec2(wc * scU + abs(q.x - wc * scU), q.y);
  float l = scTone(qm, lo * scU, hi * scU, 1.4, 0.05);
  float s = abs(l - (0.4 + 0.05 * mod(cut, 3.0))) * 2.0;
  vec3 sol = s < 0.22 ? navy : (s < 0.55 ? dk : cream);
  col = mix(col, sol, scAA(sdBox(c, lo, hi)));
  col = mix(col, cream, scLine(sdBox(c, lo - 0.01, hi + 0.01), 1.5));
  col = mix(col, cream, scLine(c.x - wc, 1.0) * step(lo.y, c.y) * step(c.y, hi.y) * 0.8);
  // targets, mirrored
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi + 1.0, cut));
    vec2 tp = vec2(mix(lo.x + 0.05, wc, h.x), mix(lo.y + 0.06, hi.y - 0.06, h.y));
    float sz = 0.03 + 0.03 * hash12(vec2(fi, 9.0));
    for (int sd = 0; sd < 2; sd++) {
      vec2 tq = sd == 0 ? tp : vec2(2.0 * wc - tp.x, tp.y);
      float box = scLine(sdBox(c, tq - sz, tq + sz), 1.2);
      vec2 br = abs(c - tq) - sz;
      col = mix(col, cream, max(box, 0.0));
      col = mix(col, cream, numTxt(q, (tq + vec2(sz + 0.01, -sz)) * scU, scCell(), mod(fi * 37.0 + cut * 11.0, 1000.0), 3));
    }
  }
  // barcode
  float bx = floor(c.x / 0.004);
  float bar = step(0.5, hash12(vec2(bx, cut))) * step(0.04, c.x) * step(c.x, 0.3) * step(0.86, c.y) * step(c.y, 0.96);
  col = mix(col, cream, bar);
  // file block with struck-through rows
  float row = floor((c.y - 0.1) / 0.034);
  float strike = step(0.0, row) * step(mod(row, 3.0), 1.5) * step(0.5, mod(row, 3.0)) * step(abs(c.y - (0.1 + (row + 0.5) * 0.034)), 0.0012) * step(0.04, c.x) * step(c.x, 0.3);
  col = mix(col, cream, scSheet(q, 1));
  col = mix(col, cream, strike);
  col = mix(col, cream, scSheet(q, 0));
  col = mix(col, navy, scAA(sdBox(c, vec2(0.04, 0.03), vec2(0.04 + 0.26 * stLevel().a, 0.045))));
}
