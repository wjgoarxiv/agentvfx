void main() {
  float prev = texture(acc, vUv).r;
  fragColor = vec4(prev + inc, 0.0, 0.0, 1.0);
}
