// strobe-burst: a hit layer. Pulse k of the burst starts at frame k * period, where
// period = fps * 60 / tempo * 4 / division frames (tempo 0 = the track's AUDIO_BPM, else 120).
// A pulse is lit for round(period * duty) frames (at least one); unlit frames show the layer below
// dimmed by offDim. The accent pattern picks pulses that use accentMode instead of mode. After the
// last pulse the layer below passes through untouched. Stage mode renders every pulse at full level.
vec3 pulseLook(int m, vec3 src, vec3 tint, float lvl) {
  vec3 s = clamp(src, 0.0, 1.0);
  if (m == 1) {
    return mix(s, tint, lvl);
  }
  if (m == 2) {
    return srgbToLinear(vec3(1.0) - linearToSrgb(s));
  }
  if (m == 3) {
    return vec3(step(0.5, luma(linearToSrgb(s))));
  }
  if (m == 4) {
    return vec3(0.0);
  }
  return mix(s, vec3(1.0), lvl);
}

void main() {
  vec3 src = texture(inputImage, vUv).rgb;
  float fps = 1.0 / TIMEDELTA;
  float n = floor(TIME / TIMEDELTA + 0.5);
  float bpm = tempo > 0.0 ? tempo : (AUDIO_BPM > 1.0 ? AUDIO_BPM : 120.0);
  float period = fps * 60.0 / bpm * 4.0 / float(division);
  float p = floor(n / period + 1e-4);
  if (p >= float(pulses)) {
    fragColor = vec4(src, 1.0);
    return;
  }
  float pos = n - p * period;
  float onFrames = max(1.0, floor(period * duty + 0.5));
  bool lit = pos < onFrames - 1e-4;
  int pi = int(p);
  bool accent = ((accentPattern >> (pi % accentLen)) & 1) == 1;
  int m = accent ? accentMode : mode;
  vec3 tint = useScorePalette ? PALETTE[pi % max(PALETTE_COUNT, 1)] : color.rgb;
  vec3 col = lit ? pulseLook(m, src, tint, level) : src * (1.0 - offDim);
  fragColor = vec4(col, 1.0);
}
