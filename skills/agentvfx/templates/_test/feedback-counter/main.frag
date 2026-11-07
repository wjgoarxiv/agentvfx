void main() {
  float v = texture(acc, vUv).r;
  fragColor = vec4(srgbToLinear(vec3(v)), 1.0);
}
