// Scene 8, tunnel: a pixel checker tunnel in electric blue on black that jumps one ring deeper and turns half a step on
// every beat; the plate sits in a curved letterbox window at its vanishing point; a white-hot horizontal eye bar flares on the
// onset; a black block with a giant Monument Extended word and live depth numbers. Palette: ground (black), ink (white-hot),
// accent (electric blue), tintA (deep blue). Text set 8: r the word, g captions.
void sceneTunnel(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 hotc = inkColor.rgb;
  vec3 blue = accentColor.rgb;
  vec3 deep = tintA.rgb;
  float cut = floor(clk.x);
  vec2 ctr = vec2(0.5 * A, 0.5);
  float px = scPx();
  vec2 d = ((floor(q / px) + 0.5) * px) / scU - ctr;
  float r = length(d);
  float a = atan(d.y, d.x) / 6.28318;
  float z = 0.16 / max(r, 0.02);
  float ring = floor(z * 2.2 + cut);
  float seg = floor(a * 20.0 + cut * 0.5);
  float chk = mod(ring + seg, 2.0);
  float shade = smoothstep(0.05, 0.4, r);
  col = groundColor.rgb;
  col = mix(col, mix(deep, blue, 0.5 + 0.5 * step(1.5, mod(ring, 4.0))), chk * shade);
  col = mix(col, hotc, chk * step(0.5, mod(ring * 7.0 + seg, 29.0) - 27.5) * shade * step(1.2, z));
  // plate in the curved letterbox: the half height grows toward the sides
  float halfH = 0.17 + 0.2 * pow(abs(d.x) / (0.5 * A), 2.0);
  float inWin = scAA(abs(d.y) - halfH) * step(abs(d.x), 0.5 * A * 0.8);
  vec3 f = scPlate(q, vec2(0.1 * A, 0.2) * scU, vec2(0.9 * A, 0.8) * scU);
  vec3 tint = mix(vec3(luma(f)), f, 0.6) * vec3(0.7, 0.85, 1.25);
  col = mix(col, clamp(tint * 1.1, 0.0, 1.0), inWin);
  float edge = max(scLine(abs(d.y) - halfH, 1.5), 0.0) * step(abs(d.x), 0.5 * A * 0.8);
  col = mix(col, hotc, edge);
  // eye bar
  float bar = 0.003 + 0.028 * hit.x;
  float glow = smoothstep(0.1, 0.0, abs(d.y)) * 0.18 * (0.4 + hit.x);
  col = mix(col, blue, glow);
  col = mix(col, hotc, scAA(abs(d.y) - bar) * (0.55 + 0.45 * step(0.2, hit.x)));
  // block with the word, crosshairs, live depth
  col = mix(col, vec3(0.0), scAA(sdBox(c, vec2(-0.1, 0.78), vec2(0.98, 1.1))));
  col = mix(col, vec3(0.0), scAA(sdBox(c, vec2(1.1, 0.84), vec2(A + 0.1, 1.1))));
  col = mix(col, hotc, scSheet(q, 0));
  col = mix(col, hotc, scPlus(c, vec2(0.05, 0.05), 0.02));
  col = mix(col, hotc, scPlus(c, vec2(A - 0.05, 0.05), 0.02));
  float cell = scCell();
  col = mix(col, hotc, numTxt(q, vec2(A - 0.2, 0.9) * scU, cell * 2.0, mod(cut * 7.0, 1000.0), 3));
  col = mix(col, blue, scSheet(q, 1));
}
