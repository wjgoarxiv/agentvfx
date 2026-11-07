// HDR gleam only. The picture is composited in the last pass, after this is bloomed.

void main() {
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  vec2 p = rot(-sweepAngle) * ((vUv - 0.5) * aspect);
  float travel = fract(TIME * sweepSpeed + SEED * 0.17);
  float pos = travel * 2.6 - 1.3;
  float sigma = max(bandFrac * RENDERSIZE.y, 0.75);
  float d = (p.x - pos) * RENDERSIZE.y;
  float band = exp(-0.5 * (d * d) / (sigma * sigma));
  band *= 1.0 - smoothstep(1.7 * sigma, 2.5 * sigma, abs(d));
  float kick = 1.0 + clamp(audioKick, 0.0, 2.0);
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  float core = smoothstep(0.45, 0.95, band);
  float halo = band * (1.0 - core);
  fragColor = vec4((vec3(core) + accent * halo) * gleamGain * kick, 1.0);
}
