// echo-flow f2: Horn-Schunck Jacobi iteration 2, warm-started from f1.
// Neighbourhood-averaged flow plus fresh local Sobel gradients.
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(f1, 0));
  vec2 ub = vec2(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      ub = ub + texture(f1, vUv + vec2(float(i), float(j)) * texel).rg;
    }
  }
  ub = ub / 9.0;
  vec2 px = vec2(1.0) / vec2(textureSize(inputImage, 0));
  float lC = luma(texture(inputImage, vUv).rgb);
  float ix = luma(texture(inputImage, vUv + vec2(px.x, 0.0)).rgb) - luma(texture(inputImage, vUv - vec2(px.x, 0.0)).rgb);
  float iy = luma(texture(inputImage, vUv + vec2(0.0, px.y)).rgb) - luma(texture(inputImage, vUv - vec2(0.0, px.y)).rgb);
  float it = lC - texture(prev, vUv).r;
  float denom = ix * ix + iy * iy + flowSmooth * flowSmooth;
  float corr = (ix * ub.x + iy * ub.y + it) / max(denom, 1e-6);
  fragColor = vec4(ub - vec2(ix, iy) * corr, 0.0, 1.0);
}
