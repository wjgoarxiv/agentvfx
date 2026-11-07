// echo-flow f1: Horn-Schunck Jacobi iteration 1 from a zero start.
// Ix, Iy from Sobel on current luma; It against the previous frame.
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(inputImage, 0));
  float lC = luma(texture(inputImage, vUv).rgb);
  float lx1 = luma(texture(inputImage, vUv - vec2(texel.x, 0.0)).rgb);
  float lx2 = luma(texture(inputImage, vUv + vec2(texel.x, 0.0)).rgb);
  float ly1 = luma(texture(inputImage, vUv - vec2(0.0, texel.y)).rgb);
  float ly2 = luma(texture(inputImage, vUv + vec2(0.0, texel.y)).rgb);
  float ix = lx2 - lx1;
  float iy = ly2 - ly1;
  float it = lC - texture(prev, vUv).r;
  float denom = ix * ix + iy * iy + flowSmooth * flowSmooth;
  float corr = it / max(denom, 1e-6);
  fragColor = vec4(-ix * corr, -iy * corr, ix, iy);
}
