// 64-tap radial march toward lightPos. Decay follows GPU Gems 3 ch.13.
// The sum is scaled by (1 - decay) so a frame of emitters cannot flood the picture.
// Sample count stays fixed; rayDensity shortens or lengthens the march.

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

float emitter(vec2 uv) {
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  float disk = 1.0 - smoothstep(sunSize * 0.4, sunSize, length((uv - lightPos) * aspect));
  float srcL = HAS_INPUT ? luma(texture(inputImage, clamp(uv, 0.0, 1.0)).rgb) : 0.0;
  float kneeW = 0.06;
  float soft = clamp(srcL - rayThreshold + kneeW, 0.0, 2.0 * kneeW);
  soft = (soft * soft) / (4.0 * kneeW);
  float mask = clamp(max(soft, srcL - rayThreshold) / max(1.0 - rayThreshold, 1e-3), 0.0, 1.0);
  return max(mask, disk);
}

void main() {
  vec2 delta = (vUv - lightPos) * (rayDensity / 64.0);
  vec2 coord = vUv;
  float illum = 1.0;
  float acc = 0.0;
  for (int i = 0; i < 64; i++) {
    coord -= delta;
    acc += emitter(coord) * illum * rayWeight;
    illum *= rayDecay;
  }
  acc *= (1.0 - rayDecay);
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  float dist = length((vUv - lightPos) * aspect);
  float near = exp(-dist * 22.0);
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  vec3 light = mix(accent, vec3(1.0), near) * acc * rayExposure;
  vec3 scene = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  fragColor = vec4(addLight(scene, light), 1.0);
}
