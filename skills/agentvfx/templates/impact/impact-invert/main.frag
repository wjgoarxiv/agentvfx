// impact-invert: a hit layer. For hitFrames after its start it replaces the layer below with a hard
// negative (in display/sRGB space), full strength for holdFrames, then it dissolves back by hashed
// chunky blocks: each block is either fully negative or fully the original, so no frame is a grey mix.
float hitEnv(float n, float total, float hold, float curve) {
  if (n >= total) return 0.0;
  if (n < hold) return 1.0;
  float k = (n - hold + 1.0) / (total - hold + 1.0);
  return pow(clamp(1.0 - k, 0.0, 1.0), curve);
}

vec3 negativeOf(vec3 s, int m) {
  if (m == 1) {
    vec3 h = rgb2hsv(s);
    h.z = 1.0 - h.z;
    return hsv2rgb(h);
  }
  if (m == 2) {
    return (vec3(1.0) - s).gbr;
  }
  if (m == 3) {
    return linearToSrgb(paletteRamp(1.0 - luma(srgbToLinear(s))));
  }
  return vec3(1.0) - s;
}

void main() {
  vec3 src = texture(inputImage, vUv).rgb;
  float n = floor(TIME / TIMEDELTA + 0.5);
  float env = hitEnv(n, float(hitFrames), float(holdFrames), decayCurve);
  if (env <= 0.0) {
    fragColor = vec4(src, 1.0);
    return;
  }
  vec3 s = linearToSrgb(clamp(src, 0.0, 1.0));
  vec3 o = negativeOf(s, mode);
  o = clamp((o - 0.5) * contrast + 0.5, 0.0, 1.0);
  vec2 cell = floor(vUv * RENDERSIZE / max(blockPx * RENDERSIZE.y / 1080.0, 1.0));
  bool hit = hash12(cell + vec2(n * 17.31, 3.7)) < env;
  if (bands > 0) {
    float b = floor(vUv.y * float(bands));
    hit = hit && hash12(vec2(b, floor(n * 0.5) + 7.0)) < bandCoverage;
  }
  fragColor = vec4(srgbToLinear(hit ? o : s), 1.0);
}
