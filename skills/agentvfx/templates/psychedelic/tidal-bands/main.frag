// tidal-bands: fbm domain-warped luma, posterized into bandCount bands with
// rippling edges, coloured by a cyclic ramp. Generative fbm field when
// there is no input. (No builtin mix() calls: `blend` is an input name.)
vec3 tideThermal(float t) {
  t = fract(t);
  vec3 c = vec3(0.03, 0.02, 0.9) + (vec3(0.5, 0.0, 1.0) - vec3(0.03, 0.02, 0.9)) * smoothstep(0.0, 0.16, t);
  c = c + (vec3(1.0, 0.05, 0.85) - c) * smoothstep(0.16, 0.32, t);
  c = c + (vec3(1.0, 0.06, 0.1) - c) * smoothstep(0.32, 0.47, t);
  c = c + (vec3(1.0, 0.5, 0.0) - c) * smoothstep(0.47, 0.62, t);
  c = c + (vec3(0.95, 0.95, 0.1) - c) * smoothstep(0.62, 0.77, t);
  c = c + (vec3(0.1, 1.0, 0.7) - c) * smoothstep(0.77, 0.9, t);
  c = c + (vec3(0.03, 0.02, 0.9) - c) * smoothstep(0.9, 1.0, t);
  return c;
}

vec3 tidePal(float t, int mode) {
  if (mode == 1) {
    return tideThermal(t);
  }
  if (mode == 2) {
    return paletteCycle(fract(t));
  }
  return cosPalette(fract(t), vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
}

void main() {
  float aspect = RENDERSIZE.x / max(RENDERSIZE.y, 1.0);
  vec2 p = vUv * vec2(aspect, 1.0);
  float t = TIME * flowSpeed;
  vec2 w = vec2(
    fbm(p * flowScale + vec2(t * 0.11, t * 0.043), 3),
    fbm(p * flowScale + vec2(5.2, 1.3) - vec2(t * 0.037, 0.0), 3));
  float lum;
  if (HAS_INPUT) {
    lum = luma(texture(inputImage, vUv + (w - 0.5) * 0.35).rgb);
  } else {
    lum = fbm(p * 1.25 + (w - 0.5) * 1.5 + vec2(0.0, t * 0.05), 3);
  }
  float c = clamp((lum - 0.5) * contrast + 0.5, 0.0, 1.0);
  float nb = float(bandCount);
  float w1 = sin(dot(p, vec2(0.8, 0.6)) * 2.0 + t * 1.3) + sin(dot(p, vec2(-0.5, 0.9)) * 3.1 - t * 0.9);
  float drift2 = fbm(p * 0.9 + vec2(t * 0.12, -t * 0.07), 3) - 0.5;
  float bands = c * nb + (w1 * 0.5 + drift2 * 0.8) * nb * 0.22;
  float rip = fbm(vec2(fract(bands) * 2.0, dot(p, vec2(0.7, 0.7)) * 3.0 + t * 0.6), 2) - 0.5;
  float edge = smoothstep(0.5 - edgeSharp * 0.5, 0.5 + edgeSharp * 0.5, fract(bands) + rip * 0.45);
  float idx = (floor(bands) + edge) / nb;
  float kick = audioPush * AUDIO_BEAT * 0.35;
  vec3 col = tidePal(idx + paletteShift + t * 0.05 + kick, ramp);
  float cl = luma(col);
  col = vec3(cl) + (col - vec3(cl)) * clamp(saturation, 0.0, 3.0);
  vec3 src = texture(inputImage, vUv).rgb;
  float m = clamp(blend, 0.0, 1.0);
  fragColor = vec4(src + (col - src) * m, 1.0);
}
