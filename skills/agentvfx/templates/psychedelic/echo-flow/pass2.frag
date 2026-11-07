// echo-flow trail: advect the previous output along the flow field and
// max-blend with the lightly punched current frame (persistent trails).
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(trail, 0));
  vec2 f = texture(f2, vUv).rg * flowScale;
  vec3 old = texture(trail, vUv - f * texel).rgb;
  vec3 cur = texture(inputImage, vUv).rgb;
  float cl = luma(cur);
  cur = vec3(cl) + (cur - vec3(cl)) * 1.3;
  fragColor = vec4(max(old * decay, cur), 1.0);
}
