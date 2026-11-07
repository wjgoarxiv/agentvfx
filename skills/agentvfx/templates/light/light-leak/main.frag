// Edge-anchored burn. The ramp hits zero before the far side of the frame, so it cannot fog the plate.

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

float anchored(vec2 uv) {
  if (edgeAnchor == 1) return 1.0 - uv.x;
  if (edgeAnchor == 2) return uv.y;
  if (edgeAnchor == 3) return 1.0 - uv.y;
  if (edgeAnchor == 4) return length(uv);
  return uv.x;
}

void main() {
  vec2 q = vUv * noiseScale;
  float n = fbm(q + vec2(TIME * 0.04, SEED * 3.0), 4);
  float n2 = fbm(q * 1.7 + vec2(4.2, -TIME * 0.03), 3);
  vec2 bent = vUv + (vec2(n, n2) - 0.5) * warp * 0.22;
  float d = anchored(clamp(bent, 0.0, 1.0));
  float x = clamp(1.0 - d * edgeTight, 0.0, 1.0) * leakWidth;
  x = clamp(x, 0.0, 1.0);
  float core = smoothstep(0.62, 0.95, x);
  float halo = smoothstep(0.02, 0.5, x) * (1.0 - core);
  float swell = 1.0 - swellAmt + swellAmt * (0.55 + 0.45 * sin(TIME * swellHz * 6.28318));
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  vec3 leak = (vec3(core) * 1.35 + accent * halo) * leakGain * swell;
  vec3 scene = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  fragColor = vec4(addLight(scene, leak), 1.0);
}
