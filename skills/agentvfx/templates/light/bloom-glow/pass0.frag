// Soft-knee highlight extract. Light stays linear; the display fit is the last pass.
// probeDot plants one white pixel at the frame centre for the falloff test.

vec3 softKnee(vec3 c) {
  float br = luma(max(c, 0.0));
  float kneeW = max(threshold * knee, 1e-4);
  float soft = clamp(br - threshold + kneeW, 0.0, 2.0 * kneeW);
  soft = (soft * soft) / (4.0 * kneeW);
  float contrib = max(soft, br - threshold);
  return max(c, 0.0) * max(contrib / max(br, 1e-4), 0.0);
}

void main() {
  vec3 src = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  src *= plateExposure;
  if (probeDot > 0.5) {
    vec2 mid = floor(RENDERSIZE * 0.5) + vec2(0.5);
    if (all(lessThan(abs(gl_FragCoord.xy - mid), vec2(0.5)))) src = vec3(1.0);
  }
  fragColor = vec4(softKnee(src), 1.0);
}
