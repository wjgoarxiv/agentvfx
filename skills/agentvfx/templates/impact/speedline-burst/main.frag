// speedline-burst: a hit layer. The layer below is zoom-smeared and darkened; hard wedge-shaped
// lines radiate from `center`. Each angular cell of the circle hashes (per step of frames) to
// "line or not", a width and a ragged start radius, so lines re-roll like hand-drawn frames. As the
// hit decays, fewer and thinner lines survive. Lines are crisp edges, never a soft overlay.
float hitEnv(float n, float total, float hold, float curve) {
  if (n >= total) return 0.0;
  if (n < hold) return 1.0;
  float k = (n - hold + 1.0) / (total - hold + 1.0);
  return pow(clamp(1.0 - k, 0.0, 1.0), curve);
}

void main() {
  vec3 src = texture(inputImage, vUv).rgb;
  float n = floor(TIME / TIMEDELTA + 0.5);
  float env = hitEnv(n, float(hitFrames), float(holdFrames), decayCurve);
  if (env <= 0.0) {
    fragColor = vec4(src, 1.0);
    return;
  }
  float aspect = RENDERSIZE.x / max(RENDERSIZE.y, 1.0);
  vec2 p = (vUv - center) * vec2(aspect, 1.0);
  float r = length(p);

  // zoom smear: average the frame sampled toward the centre
  vec3 base = vec3(0.0);
  const int TAPS = 10;
  for (int k = 0; k < TAPS; k++) {
    float s = 1.0 - zoomSmear * env * float(k) / float(TAPS - 1);
    base += texture(inputImage, clamp(center + (vUv - center) * s, 0.0, 1.0)).rgb;
  }
  base /= float(TAPS);
  base *= 1.0 - dim * env * smoothstep(0.05, 0.9, r);

  // wedge lines
  float step_ = floor(n / float(stepFrames));
  float cells = float(lines);
  float a = atan(p.y, p.x) / 6.28318530718 + 0.5;
  float x = a * cells;
  float id = floor(x);
  float f = fract(x) - 0.5;
  float h1 = hash12(vec2(id, step_ * 1.7 + 3.0));
  float h2 = hash12(vec2(id + 91.0, step_ * 2.3 + 9.0));
  float h3 = hash12(vec2(id + 177.0, step_ * 0.9 + 21.0));
  float live = step(h1, density * env);
  float width = thickness * mix(0.25, 1.0, h3) * (0.4 + 0.6 * env);
  float aa = cells / (6.28318530718 * max(r, 1e-3) * RENDERSIZE.y) * 1.2;
  float wedge = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, abs(f));
  float startR = innerRadius * (1.0 + innerRagged * (h2 - 0.3));
  float lineMask = wedge * live * smoothstep(startR, startR + 0.004, r);

  vec3 lineCol;
  if (mode == 1) {
    lineCol = vec3(0.0);
  } else if (mode == 2) {
    lineCol = PALETTE[min(1 + int(h3 * float(max(PALETTE_COUNT - 1, 1))), PALETTE_COUNT - 1)];
  } else if (mode == 3) {
    lineCol = vec3(1.0) - clamp(base, 0.0, 1.0);
  } else {
    lineCol = lineColor.rgb;
  }
  vec3 col = mix(base, lineCol, lineMask);

  // hot core: a hard-edged pure white starburst (radius ragged per wedge), never a soft glow
  float coreR = innerRadius * core * (0.75 + 0.6 * h2) * (0.5 + 0.5 * env);
  float aaR = 1.5 / RENDERSIZE.y;
  col = mix(col, vec3(1.0), 1.0 - smoothstep(coreR - aaR, coreR + aaR, r));
  fragColor = vec4(max(col, 0.0), 1.0);
}
