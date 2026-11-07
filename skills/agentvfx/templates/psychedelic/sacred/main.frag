// Sacred main pass: luminance -> colour phase, shifted by a travelling tide.
// phase = contrasted luma * bandDensity + tide + paletteShift (+ audio kick).
// tide = 1-3 travelling sine waves along tideAngle plus fbm drift.
// Hard print bands flip whole areas between ink and paper, so palette 3 bounds the tide: its clock comes from pass1
// (a speed change moves the rate, never the bands) and its swing spans about two band steps. Both limits sit above
// what sacred-thermal and sacred-halo reach, and the other palettes never touch them.
const float PRINT_SWING_MAX = 0.26;

vec3 sacredThermal(float t) {
  t = fract(t);
  vec3 c = vec3(0.02, 0.05, 1.0) + (vec3(0.55, 0.0, 1.0) - vec3(0.02, 0.05, 1.0)) * smoothstep(0.0, 0.15, t);
  c = c + (vec3(1.0, 0.0, 1.0) - c) * smoothstep(0.15, 0.30, t);
  c = c + (vec3(1.0, 0.02, 0.08) - c) * smoothstep(0.30, 0.45, t);
  c = c + (vec3(1.0, 0.45, 0.0) - c) * smoothstep(0.45, 0.60, t);
  c = c + (vec3(1.0, 0.92, 0.08) - c) * smoothstep(0.60, 0.75, t);
  c = c + (vec3(0.05, 1.0, 0.85) - c) * smoothstep(0.75, 0.90, t);
  c = c + (vec3(0.02, 0.05, 1.0) - c) * smoothstep(0.90, 1.0, t);
  return c;
}

// Print palette (mode 3): four hard screenprint steps, ink -> acid -> signal -> paper. Not cyclic:
// the phase is clamped, so low luma stays ink instead of wrapping to a coloured field.
vec3 sacredPrint(float t) {
  int i = int(floor(clamp(t, 0.0, 0.9999) * 4.0));
  if (i == 0) return vec3(0.01, 0.009, 0.008);
  if (i == 1) return vec3(0.42, 1.0, 0.0);
  if (i == 2) return vec3(1.0, 0.55, 0.0);
  return vec3(0.9, 0.86, 0.74);
}

vec3 sacredPal(float t, int mode) {
  if (mode == 3) {
    return sacredPrint(t);
  }
  if (mode == 1) {
    return sacredThermal(t);
  }
  if (mode == 2) {
    return paletteCycle(fract(t));
  }
  return cosPalette(fract(t), vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
}

void main() {
  float aspect = RENDERSIZE.x / max(RENDERSIZE.y, 1.0);
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  bool print = palette == 3;
  float spd = tideSpeed * (1.0 + audioKick * AUDIO_BASS * 1.5);
  vec2 printClock = texelFetch(smoothLuma, ivec2(0), 0).gb;
  float clock = print ? TIME * printClock.x + printClock.y : TIME;
  float rate = print ? 1.0 : spd;
  // Ripple: the luminance is read through a slowly travelling water-surface displacement, so the
  // colour shapes undulate like waves instead of sitting still on the footage.
  float rt = print ? TIME * 0.6 + clock : TIME * (0.6 + tideSpeed);
  vec2 wob = vec2(sin(p.y * 9.0 + rt * 2.1) + 0.5 * sin(p.y * 17.0 - rt * 1.3 + p.x * 3.0),
                  cos(p.x * 7.0 - rt * 1.7) + 0.5 * cos(p.x * 13.0 + rt * 1.1 - p.y * 2.0));
  float L = texture(smoothLuma, vUv + ripple * wob).r;
  float Lc = clamp((L - 0.5) * contrast + 0.5, 0.0, 1.0);

  vec2 dir = vec2(cos(tideAngle), sin(tideAngle));
  float s = dot(p, dir) * tideScale;
  float wsum = 0.0;
  for (int k = 1; k <= 3; k++) {
    if (k <= tideWaves) {
      float fk = float(k);
      wsum += sin(s * (1.3 + 0.7 * fk) + clock * rate * (1.0 + 0.35 * fk) + fk * 1.7);
    }
  }
  float drift = fbm(p * 0.9 + vec2(clock * rate * 0.12, -clock * rate * 0.07), 3) - 0.5;
  float tide = wsum / 3.0 * 0.5 + drift * 0.6;
  float kick = audioKick * AUDIO_BEAT * 0.6;
  float phase = Lc * bandDensity + tide * tideAmount + paletteShift + kick;
  if (print) phase = Lc * bandDensity + clamp(tide * tideAmount + kick, -PRINT_SWING_MAX, PRINT_SWING_MAX) + paletteShift;

  vec2 texel = vec2(1.0) / vec2(textureSize(smoothLuma, 0));
  float gx = texture(smoothLuma, vUv + vec2(texel.x, 0.0)).r - texture(smoothLuma, vUv - vec2(texel.x, 0.0)).r;
  float gy = texture(smoothLuma, vUv + vec2(0.0, texel.y)).r - texture(smoothLuma, vUv - vec2(0.0, texel.y)).r;
  float e = clamp(length(vec2(gx, gy)) * 4.0, 0.0, 1.0);

  vec3 col;
  if (fringe > 0.0001) {
    float fe = e * fringe;
    col = vec3(sacredPal(phase + fe, palette).r, sacredPal(phase, palette).g, sacredPal(phase - fe, palette).b);
  } else {
    col = sacredPal(phase, palette);
  }
  col = col + vec3(1.0) * (e * haloAmount * 0.35);
  float cl = luma(col);
  col = vec3(cl) + (col - vec3(cl)) * clamp(saturation, 0.0, 3.0);
  vec3 src = texture(inputImage, vUv).rgb;
  // Readability: take part of the brightness from the source itself (faces, folds, text stay legible)
  // and add back the high-frequency detail the luminance blur removed.
  float Ls = HAS_INPUT ? luma(src) : L;
  float target = clamp(Ls * 1.15 + 0.04, 0.0, 1.0);
  col *= mix(1.0, target / max(luma(col), 0.02), clamp(keepLuma, 0.0, 1.0));
  col += vec3((Ls - L) * detail * 1.5);
  col = max(col, vec3(0.0));
  col *= 1.0 - clamp(baseDim, 0.0, 1.0);
  // Stroke: a thick, hard, single-colour (acid) line on luma edges. The gradient is taken across
  // +-strokeWidth px (540p-relative), so the line width follows strokeWidth and holds at any size.
  if (stroke > 0.0001) {
    vec2 sr = texel * max(strokeWidth, 0.5) * RENDERSIZE.y / 540.0;
    float sx = texture(smoothLuma, vUv + vec2(sr.x, 0.0)).r - texture(smoothLuma, vUv - vec2(sr.x, 0.0)).r;
    float sy = texture(smoothLuma, vUv + vec2(0.0, sr.y)).r - texture(smoothLuma, vUv - vec2(0.0, sr.y)).r;
    float m = smoothstep(0.07, 0.09, length(vec2(sx, sy)));
    col = mix(col, vec3(0.42, 1.0, 0.0), m * clamp(stroke, 0.0, 1.0));
  }
  fragColor = vec4(mix(src, col, clamp(blend, 0.0, 1.0)), 1.0);
}
