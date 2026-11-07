void main() {
  float phase = fract(TIME * rate + 1e-4);
  bool on = rate <= 0.0 || phase < 0.5;
  vec3 c = red ? vec3(1.0, 0.0, 0.0) : vec3(1.0);
  fragColor = vec4(on ? c : vec3(0.0), 1.0);
}
