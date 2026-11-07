// mosh-melt main: luma-threshold horizontal pixel-sort streaks over the
// accumulation buffer, hard posterize, saturate, blend.
// (No builtin mix() calls: `blend` is an input name.)
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(state, 0));
  vec3 m = texture(state, vUv).rgb;
  float px = max(streakLen / 16.0, 0.0) * texel.x;
  for (int k = 1; k <= 16; k++) {
    vec3 s = texture(state, vUv - vec2(float(k) * px, 0.0)).rgb;
    float w = step(threshold, luma(s));
    m = max(m, s * w);
  }
  float lv = float(levels);
  m = floor(m * lv + 0.5) / lv;
  float cl = luma(m);
  m = vec3(cl) + (m - vec3(cl)) * clamp(saturation, 0.0, 3.0);
  vec3 src = texture(inputImage, vUv).rgb;
  float b = clamp(blend, 0.0, 1.0);
  fragColor = vec4(src + (m - src) * b, 1.0);
}
