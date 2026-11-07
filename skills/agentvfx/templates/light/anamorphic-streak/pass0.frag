// Highlight extract plus a 1px box so the first wide stride still catches small lamps.

vec3 softKnee(vec3 c) {
  float br = luma(max(c, 0.0));
  float kneeW = max(threshold * knee, 1e-4);
  float soft = clamp(br - threshold + kneeW, 0.0, 2.0 * kneeW);
  soft = (soft * soft) / (4.0 * kneeW);
  float contrib = max(soft, br - threshold);
  return max(c, 0.0) * max(contrib / max(br, 1e-4), 0.0);
}

void main() {
  vec2 px = vec2(1.0) / RENDERSIZE;
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec3 src = HAS_INPUT ? texture(inputImage, vUv + px * vec2(float(i), float(j))).rgb : vec3(0.0);
      acc += softKnee(src);
    }
  }
  fragColor = vec4(acc / 9.0, 1.0);
}
