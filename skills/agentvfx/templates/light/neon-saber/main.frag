// Beam core on top of its bloom, over footage, then the display fit.

vec3 acesFit(vec3 x) {
  x = max(x, 0.0);
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 agxFit(vec3 x) {
  vec3 y = log2(max(x, 0.0) + 0.001);
  vec3 u = clamp((y + 7.5) / 11.0, 0.0, 1.0);
  vec3 s = u * u * (3.0 - 2.0 * u);
  return clamp(s * 1.2 - 0.05, 0.0, 1.0);
}

vec3 addLight(vec3 scene, vec3 light) {
  vec3 base = max(scene, 0.0);
  vec3 hdr = base + max(light, 0.0);
  vec3 curved = toneMap == 1 ? acesFit(hdr) : agxFit(hdr);
  vec3 curvedBase = toneMap == 1 ? acesFit(base) : agxFit(base);
  return base + max(curved - curvedBase, 0.0);
}

void main() {
  vec3 scene = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  vec3 light = texture(beam, vUv).rgb + texture(glow, vUv).rgb * 0.22;
  fragColor = vec4(addLight(scene, light), 1.0);
}
