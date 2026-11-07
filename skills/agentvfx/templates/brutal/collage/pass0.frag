// collage pass 0: state and layout, persistent in `state` (RGBA16F).
//   texel (0,0)   clock: x cut count, y last cut frame, z onset count, w last onset frame
//   texel (1,0)   levels: bass, mid, treble, rms. Attack is the same frame as the audio value;
//                 release is a linear fall of full scale in `release` seconds.
//   texel (2,0)   loudest spectrum band: x its index, y its level
//   texels (i,1)  spectrum band i (same attack / release rule)
//   texels (k,3)  cell k rectangle in grid units (x0, y0, x1, y1) on a 32 x 18 grid, y down
//   texels (k,4)  cell k: role, hash, area, cell count
//   texels (k,5)  cell k style: variant, frame (0 tile, 1 none, 2 hairline, 3 corners), fill (0 none, 1 ground, 2 ink, 3 accent), tone (0 ink, 1 ground, 2 accent)
//   texels (k,6)  cell k text-sheet window: rot (0, 1 reads upward, 2 reads downward), x, y in grid units, scale
//   texel (3,0)   hits: x onset pulse (0.6..1 on the onset frame, by flux), y beat pulse (1 on the beat frame); same release as the levels
//   texels (i,7)  history, i = 0..63, the last 64 frames, newest at i = 63: x beat pulse (or 0.4 of the onset pulse), signed by a hash of the onset count, then mid, treble, rms levels (slit-scan type)
//   texels (k,4).y of a type or typefx cell holds the text-sheet channel it reads (0 R, 1 G, 2 B)
// Fixed mode (layoutMode 0, the default) reads the layout from the cell / style / src inputs; the reshuffle mode
// below is opt-in. In reshuffle mode the layout is a pure function of (cut count, SEED): every cut rebuilds an asymmetric recursive
// subdivision of the 32 x 18 grid (always split the biggest leaves, along the long side most of the time,
// at an integer grid line away from the middle) and deals the panel roles to the leaves by fit. Its cells are tiles.
// Roles: 1 footage, 2 spectrum, 3 scope, 4 level meter, 5 readout, 6 crosshair, 7..9 fillers, 11 type, 12 rule, 13 typefx.
const int MAXL = 16;
const int NB = 64;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd(uint a, uint b) { return float(pcg(a * 2654435761u ^ pcg(b + 2654435769u))) / 4294967295.0; }

vec4 clockNext(vec4 c) {
  float since = (float(FRAMEINDEX) - c.y) * TIMEDELTA;
  bool beat = AUDIO_BEAT > 0.5;
  bool hit = AUDIO_ONSET > 0.5 && AUDIO_FLUX >= cutFlux && (c.x < 0.5 || since >= cutGap);
  bool cut = (cutMode == 0 && beat) || (cutMode == 1 && hit) || (cutMode == 2 && (beat || hit));
  if (cut) { c.x += 1.0; c.y = float(FRAMEINDEX); }
  if (AUDIO_ONSET > 0.5) { c.z += 1.0; c.w = float(FRAMEINDEX); }
  return c;
}

vec4 gR[MAXL];
int gRole[MAXL];
float gHash[MAXL];
vec4 gSty[MAXL];
vec4 gAux[MAXL];
int gCount;

float roleScore(int r, int i, uint seed) {
  vec2 sz = gR[i].zw - gR[i].xy;
  float a = sz.x * sz.y;
  float asp = sz.x / sz.y;
  float j = rnd(seed, uint(700 + r * 16 + i));
  if (r == 1) { return a * (0.6 + j) * exp(-abs(log(asp / 1.6)) * 1.2); }
  if (r == 2) { return a * pow(asp, 0.9) * (0.75 + 0.5 * j); }
  if (r == 3) { return a * pow(asp, 0.6) * (0.75 + 0.5 * j); }
  if (r == 4) { return a * pow(1.0 / asp, 0.9) * (0.75 + 0.5 * j); }
  if (r == 5) { return a * (0.5 + j); }
  return -abs(log(asp)) + 0.5 * j;
}

void genLayout(uint seed, int n) {
  for (int i = 0; i < MAXL; i++) { gR[i] = vec4(0.0); gRole[i] = 0; gHash[i] = rnd(seed, uint(900 + i)); gSty[i] = vec4(0.0); gAux[i] = vec4(0.0, 0.0, 0.0, 1.0); }
  gR[0] = vec4(0.0, 0.0, 32.0, 18.0);
  gCount = 1;
  for (int s = 1; s < MAXL; s++) {
    if (s >= n) { break; }
    int pick = -1;
    float best = -1.0;
    for (int i = 0; i < MAXL; i++) {
      if (i >= gCount) { break; }
      vec2 sz = gR[i].zw - gR[i].xy;
      if (max(sz.x, sz.y) < 7.0) { continue; }
      float sc = sz.x * sz.y * (0.5 + rnd(seed, uint(s * 16 + i)));
      if (sc > best) { best = sc; pick = i; }
    }
    if (pick < 0) { break; }
    vec2 sz = gR[pick].zw - gR[pick].xy;
    bool alongX = sz.x >= sz.y;
    if (rnd(seed, uint(300 + s)) < 0.22) { alongX = !alongX; }
    if ((alongX ? sz.x : sz.y) < 7.0) { alongX = !alongX; }
    float len = alongX ? sz.x : sz.y;
    float f = mix(0.24, 0.76, rnd(seed, uint(400 + s)));
    if (abs(f - 0.5) < 0.1) { f = f < 0.5 ? 0.38 : 0.62; }
    float k = clamp(floor(f * len + 0.5), 3.0, len - 3.0);
    vec4 a = gR[pick];
    vec4 b = a;
    if (alongX) { a.z = a.x + k; b.x = a.z; } else { a.w = a.y + k; b.y = a.w; }
    gR[pick] = a;
    gR[gCount] = b;
    gCount += 1;
  }
  for (int r = 1; r <= 6; r++) {
    int pick = -1;
    float best = -1.0e9;
    for (int i = 0; i < MAXL; i++) {
      if (i >= gCount) { break; }
      if (gRole[i] != 0) { continue; }
      float sc = roleScore(r, i, seed);
      if (sc > best) { best = sc; pick = i; }
    }
    if (pick >= 0) { gRole[pick] = r; }
  }
  int first = rnd(seed, 880u) < 0.5 ? 7 : 8;
  int nth = 0;
  for (int i = 0; i < MAXL; i++) {
    if (i >= gCount) { break; }
    if (gRole[i] != 0) { continue; }
    gRole[i] = nth == 0 ? first : (nth == 1 ? 15 - first : 9);
    nth += 1;
  }
}

// layoutMode 0 (fixed): the rectangles come from the cell0..cell15 inputs, decimal RRXXYYWWHH (role, x, y, w, h), with
// style0.. = VTFRr digits (variant, tone, fill, frame, rot) and src0.. = CSSXXYY digits (sheet channel, scale in tenths,
// x and y in half grid units plus 10 grid units) for the text-sheet window. Roles 1..9 as above, 10 (pixels) is the dot-cluster
// filler drawn as role 7 with hash 1, 11 type, 12 rule, 13 typefx (warped type: micro-type field, glyph window, slit-scan,
// echo stacks). A role that is not 1..13 leaves the slot empty. The layout does not depend on the cut count, so cells never move.
int cellVal(int k) {
  if (k == 0) { return cell0; }
  if (k == 1) { return cell1; }
  if (k == 2) { return cell2; }
  if (k == 3) { return cell3; }
  if (k == 4) { return cell4; }
  if (k == 5) { return cell5; }
  if (k == 6) { return cell6; }
  if (k == 7) { return cell7; }
  if (k == 8) { return cell8; }
  if (k == 9) { return cell9; }
  if (k == 10) { return cell10; }
  if (k == 11) { return cell11; }
  if (k == 12) { return cell12; }
  if (k == 13) { return cell13; }
  if (k == 14) { return cell14; }
  return cell15;
}
int styleVal(int k) {
  if (k == 0) { return style0; }
  if (k == 1) { return style1; }
  if (k == 2) { return style2; }
  if (k == 3) { return style3; }
  if (k == 4) { return style4; }
  if (k == 5) { return style5; }
  if (k == 6) { return style6; }
  if (k == 7) { return style7; }
  if (k == 8) { return style8; }
  if (k == 9) { return style9; }
  if (k == 10) { return style10; }
  if (k == 11) { return style11; }
  if (k == 12) { return style12; }
  if (k == 13) { return style13; }
  if (k == 14) { return style14; }
  return style15;
}
int srcVal(int k) {
  if (k == 0) { return src0; }
  if (k == 1) { return src1; }
  if (k == 2) { return src2; }
  if (k == 3) { return src3; }
  if (k == 4) { return src4; }
  if (k == 5) { return src5; }
  if (k == 6) { return src6; }
  if (k == 7) { return src7; }
  if (k == 8) { return src8; }
  if (k == 9) { return src9; }
  if (k == 10) { return src10; }
  if (k == 11) { return src11; }
  if (k == 12) { return src12; }
  if (k == 13) { return src13; }
  if (k == 14) { return src14; }
  return src15;
}

void fixedLayout() {
  gCount = 0;
  for (int i = 0; i < MAXL; i++) { gR[i] = vec4(0.0); gRole[i] = 0; gHash[i] = 0.0; gSty[i] = vec4(0.0); gAux[i] = vec4(0.0, 0.0, 0.0, 1.0); }
  for (int k = 0; k < MAXL; k++) {
    int v = cellVal(k);
    int role = v / 100000000;
    if (role < 1 || role > 14) { continue; }
    vec2 o = vec2(float((v / 1000000) % 100), float((v / 10000) % 100));
    vec2 s = vec2(float((v / 100) % 100), float(v % 100));
    int sr = srcVal(k);
    gR[gCount] = vec4(min(o, vec2(32.0, 18.0)), min(o + s, vec2(32.0, 18.0)));
    gRole[gCount] = role == 10 ? 7 : role;
    gHash[gCount] = role == 10 ? 1.0 : (role == 9 ? 0.5 : (role >= 11 ? float((sr / 1000000) % 10) : 0.0));
    int st = styleVal(k);
    gSty[gCount] = vec4(float((st / 10000) % 10), float((st / 10) % 10), float((st / 100) % 10), float((st / 1000) % 10));
    int sc = (sr / 10000) % 100;
    gAux[gCount] = vec4(float(st % 10), float((sr / 100) % 100) * 0.5 - 10.0, float(sr % 100) * 0.5 - 10.0, sc == 0 ? 1.0 : float(sc) * 0.1);
    gCount += 1;
  }
}

float specAtHz(float hz) {
  float s = (hz - 29.3) / 46.875;
  return texture(audioFFT, vec2(clamp((s + 0.5) / 512.0, 0.0, 1.0), 0.5)).r;
}
float bandRaw(int i) {
  float ratio = endFreq / startFreq;
  float f0 = startFreq * pow(ratio, float(i) / float(bands));
  float f1 = startFreq * pow(ratio, float(i + 1) / float(bands));
  float v = 0.0;
  for (int k = 0; k < 3; k++) { v = max(v, specAtHz(mix(f0, f1, (float(k) + 0.5) / 3.0))); }
  return pow(clamp((v - floorLevel) / max(ceilLevel - floorLevel, 0.01), 0.0, 1.0), specExp);
}
float bandNow(int i) {
  float v = bandRaw(i);
  if (i > 0) { v = max(v, bandRaw(i - 1) * 0.8); }
  if (i < bands - 1) { v = max(v, bandRaw(i + 1) * 0.8); }
  return v;
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 clk = clockNext(texelFetch(state, ivec2(0, 0), 0));
  float fall = TIMEDELTA / max(release, 0.005);
  if (px.y == 0 && px.x == 0) { fragColor = clk; return; }
  vec4 raw = clamp(vec4(AUDIO_BASS / 2.6, AUDIO_MID / 2.2, AUDIO_TREB / 2.6, AUDIO_RMS * 2.4), 0.0, 1.0);
  if (px.y == 0 && px.x == 1) {
    fragColor = max(raw, texelFetch(state, px, 0) - fall);
    return;
  }
  vec2 hit = vec2(AUDIO_ONSET > 0.5 ? 0.6 + 0.4 * clamp(AUDIO_FLUX, 0.0, 1.0) : 0.0, AUDIO_BEAT > 0.5 ? 1.0 : 0.0);
  vec2 hitNow = max(hit, texelFetch(state, ivec2(3, 0), 0).xy - fall);
  if (px.y == 0 && px.x == 3) {
    fragColor = vec4(hitNow, 0.0, 1.0);
    return;
  }
  if (px.y == 7 && px.x < 64) {
    float pulse = max(hitNow.y, 0.4 * hitNow.x);
    vec4 now = vec4(pulse * (hash12(vec2(clk.z, 9.0)) < 0.5 ? 1.0 : -1.0), raw.g, raw.b, raw.a);
    fragColor = px.x == 63 ? now : texelFetch(state, ivec2(px.x + 1, 7), 0);
    return;
  }
  if (px.y == 0 && px.x == 2) {
    vec2 best = vec2(0.0);
    for (int i = 0; i < NB; i++) {
      if (i >= bands) { break; }
      float v = max(bandNow(i), texelFetch(state, ivec2(i, 1), 0).r - fall);
      if (v > best.y) { best = vec2(float(i), v); }
    }
    fragColor = vec4(best, 0.0, 1.0);
    return;
  }
  if (px.y == 1 && px.x < bands) {
    fragColor = vec4(max(bandNow(px.x), texelFetch(state, px, 0).r - fall), 0.0, 0.0, 1.0);
    return;
  }
  if (px.y >= 3 && px.y <= 6 && px.x < MAXL) {
    if (layoutMode == 0 && soloPanel == 0) {
      fixedLayout();
    } else {
      uint seed = uint(clk.x) * 2654435761u + uint(SEED * 65535.0) * 40503u + 12345u;
      genLayout(seed, soloPanel > 0 ? 1 : cells);
      if (soloPanel > 0) { gRole[0] = soloPanel; }
    }
    int k = px.x;
    vec4 r = k < gCount ? gR[k] : vec4(0.0);
    vec2 sz = r.zw - r.xy;
    if (px.y == 3) { fragColor = r; }
    else if (px.y == 4) { fragColor = vec4(k < gCount ? float(gRole[k]) : 0.0, gHash[k], sz.x * sz.y, float(gCount)); }
    else if (px.y == 5) { fragColor = gSty[k]; }
    else { fragColor = gAux[k]; }
    return;
  }
  fragColor = vec4(0.0);
}
