// echo-flow main: chroma split along the flow direction over the trail
// buffer, then saturate and blend. (No builtin mix() calls.)
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(trail, 0));
  vec2 f = texture(f2, vUv).rg;
  float mag = length(f);
  vec2 dir = f / (mag + 1e-4);
  float m = clamp(mag * chromaSplit * 0.15, 0.0, 12.0);
  vec2 o = dir * m * texel;
  vec3 col = vec3(
    texture(trail, vUv + o).r,
    texture(trail, vUv).g,
    texture(trail, vUv - o).b);
  float cl = luma(col);
  col = vec3(cl) + (col - vec3(cl)) * clamp(saturation, 0.0, 3.0);
  vec3 src = texture(inputImage, vUv).rgb;
  float b = clamp(blend, 0.0, 1.0);
  fragColor = vec4(src + (col - src) * b, 1.0);
}
