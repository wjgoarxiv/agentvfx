// Sacred pass0: spatially smoothed luminance of the current frame into lumaNow.
// With footage: 5x5 tent-weighted blur of input luma; the radius scales with the frame height so the
// look holds at any resolution, and it removes film grain that would otherwise shimmer as fine bands.
// Generative fallback (!HAS_INPUT): a slow fbm luminance field.
void main() {
  if (!HAS_INPUT) {
    vec2 q = vUv * vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
    float f = fbm(q * 1.6 + vec2(TIME * 0.03, -TIME * 0.021), 4);
    f = 0.65 * f + 0.35 * fbm(q * 3.1 - vec2(0.0, TIME * 0.017), 3);
    fragColor = vec4(vec3(clamp(f, 0.0, 1.0)), 1.0);
    return;
  }
  vec2 px = vec2(1.0) / vec2(textureSize(inputImage, 0));
  float r = max(lumaBlur, 0.0) * RENDERSIZE.y / 540.0;
  float acc = 0.0;
  float wsum = 0.0;
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      float w = (3.0 - abs(float(i))) * (3.0 - abs(float(j)));
      acc += w * luma(texture(inputImage, vUv + vec2(float(i), float(j)) * r * px).rgb);
      wsum += w;
    }
  }
  fragColor = vec4(vec3(acc / wsum), 1.0);
}
