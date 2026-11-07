// pixel-sort (pass0 keyBuf: cell average colour in rgb, sort key in a). Idea: pixel sorting as in ASDFPixelSort by Kim Asendorf (concept only; code written fresh).
// Spans of cells whose luma lies in a threshold window are sorted along an axis. Span extents come from
// log2 run-length doubling (pass1..pass8); the sort itself ranks 32 strided samples of the span in the
// last pass (exact when a span has <= 32 cells, a quantile approximation above that).
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h1(uint a) { return float(pcg(a)) / 4294967295.0; }
float h2(uint a, uint b) { return h1(a * 2654435761u + pcg(b + 1013904223u)); }

// SEED is the score seed / 2^32, so small integer seeds are tiny floats; recover the integer.
uint seedU() { return uint(min(SEED * 4294967296.0 + 0.5, 4294967040.0)); }

// The sort works on cells of cellPx x cellPx pixels (1 cell = 1 "pixel" of the sort).
// Reading order: left to right for the horizontal axis, top to bottom for the vertical one.
float cellPx() { return max(1.0, floor(cellSize * RENDERSIZE.y / 1080.0 + 0.5)); }
vec2 axisDir() { return sortAxis == 0 ? vec2(1.0, 0.0) : vec2(0.0, -1.0); }
vec2 cellDims() { return ceil(RENDERSIZE / cellPx()); }
bool inCells(vec2 c) { vec2 d = cellDims(); return c.x >= 0.0 && c.y >= 0.0 && c.x < d.x && c.y < d.y; }
ivec2 cellTexel(vec2 c) { return ivec2(min(c * cellPx(), RENDERSIZE - 1.0)); }
float acrossOf(vec2 c) { return sortAxis == 0 ? c.y : c.x; }
float alongOf(vec2 c) { return sortAxis == 0 ? c.x : cellDims().y - 1.0 - c.y; }

// Span mask: a cell takes part when its row is gated in and its perceptual luma lies in [lo, hi].
bool maskOf(vec2 c) {
  if (!inCells(c)) return false;
  uint across = uint(acrossOf(c));
  uint st = uint(floor(TIME * stutterHz));
  uint sd = seedU();
  float kick = clamp(audioKick, 0.0, 2.0);
  if (h2(across + 7u, st * 977u + sd) > clamp(rowsFrac + 0.4 * kick, 0.0, 1.0)) return false;
  float sw = sweep * sin(6.2832 * (TIME * sweepRate + h1(sd + 17u)));
  float lo = threshLo + sw - 0.25 * kick + (h2(across, st + sd + 3u) - 0.5) * rowVar;
  float hi = threshHi + sw + 0.2 * kick + (h2(across, st + sd + 5u) - 0.5) * rowVar;
  float l = linearToSrgb(vec3(luma(texelFetch(keyBuf, cellTexel(c), 0).rgb))).r;
  return l >= lo && l <= hi;
}
// Spans are cut at multiples of 256 cells; the cut grid is shifted per row so cuts do not line up.
float cutShift(vec2 c) { return floor(h2(uint(acrossOf(c)), seedU() + 99u) * 256.0) * cutJitter; }

float sortKey(vec3 c) {
  if (sortBy == 1) return rgb2hsv(c).x;
  if (sortBy == 2) return rgb2hsv(c).y;
  if (sortBy == 3) return linearToSrgb(c).b;
  return linearToSrgb(vec3(luma(c))).r;
}
void main() {
  float cp = cellPx();
  vec2 c = floor(vUv * RENDERSIZE / cp);
  vec2 cen = (c + 0.5) * cp;
  vec3 acc;
  if (cp < 1.5) acc = texture(inputImage, vUv).rgb;
  else {
    acc = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(i % 2 == 0 ? -0.25 : 0.25, i < 2 ? -0.25 : 0.25) * cp;
      acc += texture(inputImage, (cen + o) / RENDERSIZE).rgb;
    }
    acc *= 0.25;
  }
  fragColor = vec4(acc, sortKey(acc));
}
