void main() {
  vec4 c = HAS_INPUT ? texture(inputImage, vUv) : vec4(0.0, 0.0, 0.0, 1.0);
  fragColor = vec4(c.rgb * gain, 1.0);
}
