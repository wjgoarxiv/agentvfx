// bass-circle main: a thin-line bracketed bass instrument. Only the bass band (startFreq..endFreq, 30..300
// Hz by default) is analysed, so the shape moves on real kicks only. Up to eight nested hairline outlines
// are drawn: outline s shows the bass spectrum delayed by s * layerDelay frames, raised to its own exponent
// [1, 1.12, 1.14, 1.30, 1.33, 1.36, 1.50, 1.52] and smoothed with a triangular kernel of its own width
// [0, 2, 2, 3, 3, 3, 5, 5]; radii are kept nested (bandGap) and older outlines are dimmer. The shape is
// mirrored left / right about an axis that snaps on every kick. Between the inner disc and the newest
// outline a radial dash hatch (hatchAmount) fills the shape. The centre disc is a hairline circle holding
// the input as a one-tone halftone (or, without footage, a ring + cross mark) that bounces and shakes with
// the bass. Around it: a square bracket frame that breathes with the kick, + marks at the cardinal points,
// a tick ring and a ring of fine dots (the particle cone as one-pixel dots streaming outward).
//@include stage.glsl
//@include hud.glsl
const float TAU = 6.28318530718;
const float EXP[8] = float[8](1.0, 1.12, 1.14, 1.30, 1.33, 1.36, 1.50, 1.52);

float histAt(int i, int d) { return texelFetch(barState, ivec2(clamp(i, 0, bandCount - 1), d == 0 ? 0 : 3 + d), 0).r; }

float sampleAt(float fx, int d) {
  float x = clamp(fx, 0.0, float(bandCount - 1));
  int i0 = int(floor(x));
  float t = x - float(i0);
  return mix(histAt(i0, d), histAt(i0 + 1, d), t * t * (3.0 - 2.0 * t));
}

float layerHeight(float fx, int d, int mg) {
  float s = 0.0;
  float ws = 0.0;
  for (int k = -5; k <= 5; k++) {
    if (abs(k) > mg) { continue; }
    float w = float(mg + 1 - abs(k));
    s += w * sampleAt(fx + float(k), d);
    ws += w;
  }
  return s / ws;
}

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  float px1 = 1.0 / res.y;
  float u1 = 1.0 / 1080.0;
  vec4 clk = texelFetch(barState, ivec2(0, 1), 0);
  vec2 sp = vUv * res;
  vec2 uv = stageUv(clk, vUv);
  float ke = kickEnv(clk);
  float since = stageSince(clk.z, clk.w);
  vec2 p = (uv * res - res * 0.5) * px1;
  vec2 sh = (hash22(vec2(clk.z, 9.1)) - 0.5) * 2.0 * emblemShake * ke * u1;
  vec2 pe = p - sh;
  float r = length(p);
  float rot = TIME * spin + (clk.z > 0.5 ? radians(snapDeg) * (clk.z - exp(-since / 0.07)) : 0.0);
  float a = atan(p.x, p.y) - rot;
  a = mod(a + 3.14159265, TAU) - 3.14159265;
  float fm = abs(a) / 3.14159265 * float(bandCount - 1);
  float grow = introK();
  float Re = emblemRadius * (1.0 + emblemBounce * ke) * (0.3 + 0.7 * introSpan());
  float R0 = Re * 1.06 + 0.006;
  float wU = hudW() * px1;

  float radii[8];
  float prevR = R0;
  for (int s = 0; s < 8; s++) {
    if (s >= layerCount) { break; }
    int mg = s == 0 ? 0 : (s < 3 ? 2 : (s < 6 ? 3 : 5));
    float A = layerHeight(fm, s * layerDelay, mg);
    float rs = R0 + max(maxRadius * pow(A, EXP[s]), 0.0) * grow;
    rs = max(rs, prevR + (s == 0 ? 0.0 : bandGap * grow));
    radii[s] = rs;
    prevR = rs;
  }
  float outlines = 0.0;
  for (int s = 7; s >= 0; s--) {
    if (s >= layerCount) { continue; }
    float al = s == 0 ? 1.0 : max(0.62 - 0.08 * float(s), 0.18);
    outlines = max(outlines, hair((r - radii[s]) / px1) * al);
  }
  float newest = radii[0];
  float hatch = step(R0, r) * step(r, newest) * step(0.5, fract(a / TAU * 180.0 * (1.0 + 0.0))) * step(0.5, fract(r / (7.0 * u1))) * hatchAmount;

  float de = length(pe) - Re;
  float disc = hair(de / px1);
  float emblem;
  if (HAS_INPUT) {
    float c = cos(rot * 0.5);
    float sn = sin(rot * 0.5);
    vec2 q = vec2(0.5) + (mat2(c, -sn, sn, c) * pe / Re) * 0.275 * vec2(res.y / res.x, 1.0);
    float cell = max(halftoneSize * 0.7 * U, 2.0);
    vec2 g = (q * res) / cell;
    vec2 fr = fract(g) - 0.5;
    float L = luma(texture(inputImage, (floor(g) + 0.5) * cell / res).rgb);
    emblem = cov((length(fr) - 0.6 * sqrt(clamp(L * 1.2, 0.0, 1.0))) * cell) * step(de, 0.0);
  } else {
    float lr = length(pe) / Re;
    float ca = cos(rot);
    float sa = sin(rot);
    vec2 qq = mat2(ca, -sa, sa, ca) * pe / Re;
    float crossA = max(hair(qq.y * Re / px1) * step(abs(qq.x), 0.5), hair(qq.x * Re / px1) * step(abs(qq.y), 0.5));
    emblem = max(hair((lr - 0.6) * Re / px1) * 0.8, crossA) * step(de, 0.0);
  }

  float half0 = 0.44 * (1.0 + 0.03 * ke);
  vec2 flo = res * 0.5 - half0 * res.y;
  vec2 fhi = res * 0.5 + half0 * res.y;
  float brk = brackets(sp, flo, fhi, 34.0 * U) * gridAmount;
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 dir = c == 0 ? vec2(1.0, 0.0) : (c == 1 ? vec2(-1.0, 0.0) : (c == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0)));
    plus = max(plus, plusAt(sp, res * 0.5 + dir * (half0 + 0.025) * res.y, 7.0 * U));
  }
  float tickCnt = 90.0;
  float tkd = abs(fract(a / TAU * tickCnt) - 0.5) * (TAU * 0.46 / tickCnt);
  float ticks = step(abs(r - 0.46), 0.007 * (mod(floor(a / TAU * tickCnt), 5.0) < 0.5 ? 1.5 : 1.0)) * cov((tkd - wU * 0.5) / px1) * gridAmount;
  float outerDash = hair((r - 0.43) / px1) * dashes(a * 0.43 / px1, 8.0, 0.4) * gridAmount;

  float cone = 0.0;
  for (int k = 0; k < 160; k++) {
    if (k >= coneCount) { break; }
    vec3 h = vec3(hash12(vec2(float(k), 1.7)), hash12(vec2(float(k), 4.3)), hash12(vec2(float(k), 8.9)));
    float z = fract(TIME * coneSpeed * (1.0 + 0.8 * ke) * (0.5 + h.y) + h.z);
    vec2 pos = vec2(cos(h.x * TAU), sin(h.x * TAU)) * (prevR + 0.02 + z * z * 0.5);
    cone = max(cone, cov((length(p - pos) - (0.7 + 1.6 * z) * u1) / px1) * smoothstep(0.0, 0.1, z) * smoothstep(1.0, 0.7, z));
  }

  float mk = max(max(outlines, hatch), max(disc, emblem));
  mk = max(mk, max(brk, max(plus * float(marks), max(ticks * 0.8, outerDash * 0.6))));
  mk = max(mk, cone * coneAmount);
  mk = max(mk, textInk());
  vec3 ink = inkColor.rgb;
  vec3 gnd = stageBackground(vUv, ink, ke);
  vec3 col = mix(gnd, ink, mk);
  float hot = hair((r - radii[0]) / px1);
  vec3 acc = colorMode == 1 ? paletteCycle(clamp(a / TAU + 0.5, 0.0, 1.0) + paletteShift) : accentColor.rgb;
  col = mix(col, acc, hot * 0.9);
  col += acc * exp(-max(r - prevR, 0.0) / max(glowRadius, px1)) * glow * 0.3 * step(R0, r);
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
