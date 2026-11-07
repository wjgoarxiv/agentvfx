// Add the three streak levels in linear light, then the display fit.

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
  vec3 tight = texture(s0, vUv).rgb;
  vec3 streak = tight + texture(s1, vUv).rgb * 0.38 + texture(s2, vUv).rgb * 0.14;
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  float hot = smoothstep(0.12, 0.7, luma(tight));
  vec3 light = mix(accent, vec3(1.0), hot) * streak * streakMix * streakGain;
  if (dashAmt > 0.5) {
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float row = 0.18 + 0.1 * fi;
      float shift = hash12(vec2(fi + 1.0, 2.7));
      float x = fract(vUv.x - TIME * (0.22 + 0.08 * fi) + shift);
      float len = 0.04 + 0.035 * fract(shift * 5.0);
      float on = 1.0 - step(len, x);
      float yy = abs(vUv.y - row) * RENDERSIZE.y;
      float dashCore = exp(-0.5 * yy * yy / 0.7) * on;
      float dashHalo = exp(-0.5 * yy * yy / 5.0) * on * (1.0 - dashCore);
      light += vec3(dashCore) * 2.4 + accent * dashHalo * 1.3;
    }
  }
  vec3 scene = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  fragColor = vec4(addLight(scene, light), 1.0);
}
