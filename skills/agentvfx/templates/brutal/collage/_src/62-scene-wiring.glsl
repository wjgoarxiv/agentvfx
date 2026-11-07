// Scene 2, wiring: a black ground, the plate as a cyan / yellow duotone with scanline bands that re-seed on every cut, five yellow
// cables from fixed points on the CRT wall to boxed annotations (small Monument Extended caps and live readouts in a pixel font),
// quarter pixel arcs and a dot grid in the bottom-left corner, and a small crimson pixel glyph that blinks on every onset.
// Each onset sends a packet down the next cable and flashes its box. Palette: ground (black), ink (label white), accent (yellow),
// tintA (cyan), tintB (crimson). Text set 2.
const vec2 W_A[5] = vec2[5](vec2(0.663, 0.4355), vec2(0.573, 0.5775), vec2(0.663, 0.7195), vec2(1.115, 0.4355), vec2(1.025, 0.7195));
const vec2 W_B[5] = vec2[5](vec2(0.05, 0.14), vec2(0.05, 0.40), vec2(0.05, 0.62), vec2(1.43, 0.10), vec2(1.43, 0.62));
const vec2 W_SZ = vec2(0.30, 0.105);
const int W_GLYPH[7] = int[7](20, 62, 107, 127, 62, 34, 65);

vec2 wTail(int i) { return W_B[i] + (i < 3 ? vec2(W_SZ.x, 0.5 * W_SZ.y) : vec2(0.0, 0.5 * W_SZ.y)); }
vec2 wElbow(vec2 A, vec2 T) { return vec2(T.x + sign(A.x - T.x) * abs(A.y - T.y), T.y); }
float wCable(vec2 c, vec2 A, vec2 T, float w) {
  vec2 E = wElbow(A, T);
  return max(scLine(sdSeg(c, A, E), w), scLine(sdSeg(c, E, T), w));
}
vec2 wAlong(vec2 A, vec2 T, float t) {
  vec2 E = wElbow(A, T);
  float l1 = length(E - A);
  float d = t * (l1 + length(T - E));
  return d < l1 ? mix(A, E, d / max(l1, 1e-4)) : mix(E, T, (d - l1) / max(length(T - E), 1e-4));
}

void sceneWiring(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec4 hit = stHit();
  vec3 white = inkColor.rgb;
  vec3 yel = accentColor.rgb;
  vec3 cyan = tintA.rgb;
  vec3 red = tintB.rgb;
  float cut = floor(clk.x);
  // plate: cyan / yellow duotone, scanline bands re-seeded on the cut, one slice thrown sideways on the beat
  float sliceY = hash12(vec2(cut, 3.0));
  float shift = step(abs(c.y - sliceY), 0.025) * hit.y * 0.05 * scU;
  float l = clamp((luma(scPlate(q + vec2(shift, 0.0), vec2(0.0), S)) - 0.1) * 1.5, 0.0, 1.0);
  vec3 d = mix(groundColor.rgb, cyan * 0.45, smoothstep(0.0, 0.4, l));
  d = mix(d, cyan, smoothstep(0.35, 0.7, l));
  d = mix(d, yel, smoothstep(0.66, 0.95, l));
  float band = step(0.62, hash12(vec2(floor(c.y / 0.03), cut)));
  d *= (1.0 - 0.22 * step(0.5, fract(c.y / 0.012))) * (1.0 - 0.5 * band);
  d *= mix(0.45, 1.0, smoothstep(1.05, 0.3, length((c - vec2(0.5 * A, 0.5)) * vec2(0.8, 1.2))));
  col = d;
  // cables and anchors
  int act = int(mod(clk.z, 5.0));
  float age = float(FRAMEINDEX) - clk.w;
  for (int i = 0; i < 5; i++) {
    vec2 T = wTail(i);
    bool on = i == act && clk.z > 0.5;
    float flash = on ? step(0.3, hit.x) : 0.0;
    col = mix(col, vec3(0.0), wCable(c, W_A[i], T, 4.0) * 0.85);
    col = mix(col, mix(yel, white, flash), wCable(c, W_A[i], T, on ? 2.0 : 1.2));
    float ring = scLine(length(c - W_A[i]) - 0.014, 1.2);
    col = mix(col, vec3(0.0), scAA(length(c - W_A[i]) - 0.018) * 0.5);
    col = mix(col, yel, max(ring, scAA(sdBox(c, W_A[i] - 0.004, W_A[i] + 0.004))));
    if (on && age < 9.0) {
      vec2 pp = wAlong(W_A[i], T, (age + 1.0) / 9.0);
      col = mix(col, white, scAA(sdBox(c, pp - 0.007, pp + 0.007)));
    }
    // box: black plate, yellow outline, a live readout in the pixel font and a segmented level bar
    float bf = scAA(sdBox(c, W_B[i], W_B[i] + W_SZ));
    col = mix(col, mix(vec3(0.0), yel, flash), bf * 0.9);
    col = mix(col, yel, scLine(sdBox(c, W_B[i], W_B[i] + W_SZ), 1.0));
    float lev = bandAt(0.06 + 0.2 * float(i));
    float cell = cellPx(0.0062 * scU);
    vec2 np = q - (W_B[i] + vec2(0.014, 0.058)) * scU;
    float num = numTxt(np, vec2(0.0), cell, floor(lev * 999.0), 3);
    vec2 bp = (c - (W_B[i] + vec2(0.115, 0.064))) / vec2(0.17, 0.02);
    float seg = step(0.0, bp.x) * step(bp.x, 1.0) * step(0.0, bp.y) * step(bp.y, 1.0) * step(mod(bp.x * 14.0, 1.0), 0.62);
    float litSeg = step(bp.x, lev);
    col = mix(col, mix(flash > 0.5 ? vec3(0.0) : yel, cyan, 1.0 - litSeg), seg * mix(0.35, 1.0, litSeg));
    col = mix(col, flash > 0.5 ? vec3(0.0) : yel, min(num, 1.0));
  }
  // pixel arcs and a dot grid, bottom-left
  float px = scPx();
  vec2 pc = (floor(q / px) + 0.5) * px - vec2(0.0, S.y);
  float r = length(pc) / scU;
  float ring = floor((r - 0.05) / 0.036);
  float ang = atan(-pc.y, pc.x) / 1.5708;
  float seg = floor(ang * (5.0 + ring));
  float arc = step(0.0, ring) * step(ring, 5.0) * step(fract((r - 0.05) / 0.036), 0.55) * step(0.0, ang) * step(ang, 1.0) * step(mod(seg + cut * (ring + 1.0), 3.0), 1.5);
  col = mix(col, yel, arc);
  vec2 dg = (c - vec2(0.27, 0.935)) / 0.026;
  float dots = scAA(length(fract(dg) - 0.5) * 0.026 - 0.004) * step(0.0, dg.x) * step(dg.x, 12.0) * step(0.0, dg.y) * step(dg.y, 2.0);
  col = mix(col, cyan, dots);
  // the crimson pixel glyph: dim, full for 5 frames after every onset
  vec2 gp = floor((c - vec2(0.405, 0.052)) / 0.0118);
  float gl = 0.0;
  if (gp.x >= 0.0 && gp.x < 7.0 && gp.y >= 0.0 && gp.y < 7.0) { gl = float((W_GLYPH[int(gp.y)] >> (6 - int(gp.x))) & 1); }
  col = mix(col, red * (age < 5.0 && clk.z > 0.5 ? 1.0 : 0.3), gl);
  // letterbox, corner brackets, label caps (Monument Extended)
  col = mix(col, vec3(0.0), scAA(sdBox(c, vec2(-1.0), vec2(A + 1.0, 0.045))) + scAA(sdBox(c, vec2(-1.0, 0.955), vec2(A + 1.0, 2.0))));
  vec2 a = min(c - 0.012, vec2(A, 1.0) - c - 0.012);
  col = mix(col, white, max(scLine(a.y, 1.0) * step(a.x, 0.03), scLine(a.x, 1.0) * step(a.y, 0.03)) * step(0.0, min(a.x, a.y) + 0.001));
  col = mix(col, white, scSheet(q, 0) * 0.9);
}
