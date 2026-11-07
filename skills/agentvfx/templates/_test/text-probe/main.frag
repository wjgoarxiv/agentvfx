void main() {
  vec4 m = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  vec3 c = mix(vec3(0.0), vec3(0.25), m.g);
  c = mix(c, vec3(1.0), m.r);
  fragColor = vec4(c * gain, 1.0);
}
