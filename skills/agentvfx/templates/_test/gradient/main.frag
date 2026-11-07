void main() {
  vec2 uv = isf_FragNormCoord;
  float x = fract(uv.x + TIME * speed * 0.25);
  fragColor = vec4(mix(vec3(0.02), tint.rgb, x) * (0.4 + 0.6 * uv.y), 1.0);
}
