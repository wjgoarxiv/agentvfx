// kaleido-fold main: saturate the feedback buffer and blend over source.
// (No builtin mix() calls: `blend` is an input name.)
void main() {
  vec3 f = texture(fold, vUv).rgb;
  float fl = luma(f);
  f = vec3(fl) + (f - vec3(fl)) * clamp(saturation, 0.0, 3.0);
  vec3 src = texture(inputImage, vUv).rgb;
  float m = clamp(blend, 0.0, 1.0);
  fragColor = vec4(src + (f - src) * m, 1.0);
}
