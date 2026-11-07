// impact-1bit: a hit layer. For hitFrames after its start the layer below becomes two flat colours
// (ink and paper, default black and white) by a luminance threshold against a local mean, with an
// optional ordered dither, then dissolves back by hashed chunky blocks (no grey mix frames).
float hitEnv(float n, float total, float hold, float curve) {
  if (n >= total) return 0.0;
  if (n < hold) return 1.0;
  float k = (n - hold + 1.0) / (total - hold + 1.0);
  return pow(clamp(1.0 - k, 0.0, 1.0), curve);
}

float bayer8(vec2 p) {
  ivec2 q = ivec2(mod(p, 8.0));
  int v = 0;
  for (int k = 0; k < 3; k++) {
    int xb = (q.x >> k) & 1;
    int yb = (q.y >> k) & 1;
    v = v * 4 + 2 * (xb ^ yb) + yb;
  }
  return (float(v) + 0.5) / 64.0;
}

float sLuma(vec2 uv) {
  return luma(linearToSrgb(clamp(texture(inputImage, uv).rgb, 0.0, 1.0)));
}

void main() {
  vec3 src = texture(inputImage, vUv).rgb;
  float n = floor(TIME / TIMEDELTA + 0.5);
  float env = hitEnv(n, float(hitFrames), float(holdFrames), decayCurve);
  if (env <= 0.0) {
    fragColor = vec4(src, 1.0);
    return;
  }
  float L = (sLuma(vUv) - 0.5) * preContrast + 0.5;
  vec2 px = vec2(adaptRadius * RENDERSIZE.y / 1080.0) / RENDERSIZE;
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = 0.785398 * float(i);
    m += sLuma(vUv + vec2(cos(a), sin(a)) * px);
  }
  m = (m / 8.0 - 0.5) * preContrast + 0.5;
  float t = mix(threshold, clamp(m + (threshold - 0.5) * 0.5, 0.05, 0.95), adapt);
  float d = 0.0;
  vec2 pp = floor(vUv * RENDERSIZE / max(ditherPx * RENDERSIZE.y / 1080.0, 1.0));
  if (dither == 1) {
    d = (bayer8(pp) - 0.5) * ditherAmount;
  } else if (dither == 2) {
    d = (hash12(pp + n * 3.1) - 0.5) * ditherAmount;
  }
  bool bright = (L + d) > t;
  if (flip) {
    bright = !bright;
  }
  vec3 ink = inkColor.rgb;
  vec3 paper = paperColor.rgb;
  if (useScorePalette) {
    ink = PALETTE[0];
    paper = PALETTE[PALETTE_COUNT - 1];
  }
  vec3 o = bright ? paper : ink;
  vec2 cell = floor(vUv * RENDERSIZE / max(blockPx * RENDERSIZE.y / 1080.0, 1.0));
  bool hit = hash12(cell + vec2(n * 17.31, 3.7)) < env;
  fragColor = vec4(hit ? o : src, 1.0);
}
