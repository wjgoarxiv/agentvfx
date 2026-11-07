// mosh-melt state: flow-advected accumulation with refresh hits.
// Flow comes from frame difference along the local Sobel gradient.
// Refresh every refreshN frames (or on an audio beat when audioRefresh
// is on); otherwise max-blend the advected old state with the current
// frame. RGB = accumulation, A = this frame's luma for next frame.
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(inputImage, 0));
  float lC = luma(texture(inputImage, vUv).rgb);
  float lx1 = luma(texture(inputImage, vUv - vec2(texel.x, 0.0)).rgb);
  float lx2 = luma(texture(inputImage, vUv + vec2(texel.x, 0.0)).rgb);
  float ly1 = luma(texture(inputImage, vUv - vec2(0.0, texel.y)).rgb);
  float ly2 = luma(texture(inputImage, vUv + vec2(0.0, texel.y)).rgb);
  vec2 grad = vec2(lx2 - lx1, ly2 - ly1);
  float it = lC - texture(state, vUv).a;
  float gm = length(grad) + 1e-4;
  vec2 shift = (grad / gm) * clamp(-it * 24.0, -6.0, 6.0) * texel;
  vec3 old = texture(state, vUv - shift).rgb;
  vec3 cur = texture(inputImage, vUv).rgb;
  bool hit = (FRAMEINDEX % refreshN == 0) || (audioRefresh && AUDIO_BEAT > 0.5);
  vec3 acc = hit ? cur : max(old * decay, cur * 0.9);
  fragColor = vec4(acc, lC);
}
