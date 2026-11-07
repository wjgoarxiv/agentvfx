// signal-cut pass 0: slab energies, slab edges and the beat clock, all persistent in sigState.
// Texel map (row 0 is the bottom row):
//   (i, 0) i < 32 : r = slab energy (instant attack, exponential release), g = previous raw spectrum value
//   (i, 1) i <= 32: r = right-hand edge fraction of slab i-1 (edge 0 = 0.0, edge n = 1.0), widths follow energy
//   (40, 0)       : r = frames since the last beat (255 = none yet), g = beat counter
// Energy per slab = max(level, rise): the raw per-frame spectrum (audioFFT, no attack filter) of the slab's
// log-spaced band. Rise is the frame-to-frame jump, so an onset lands on the frame it happens.
const int MAXS = 32;

float specAtHz(float hz) {
  float s = (hz - 29.3) / 46.875;
  return texture(audioFFT, vec2(clamp((s + 0.5) / 512.0, 0.0, 1.0), 0.5)).r;
}
float bandRaw(int i) {
  float ratio = endFreq / startFreq;
  float f0 = startFreq * pow(ratio, float(i) / float(slabs));
  float f1 = startFreq * pow(ratio, float(i + 1) / float(slabs));
  float v = 0.0;
  for (int k = 0; k < 3; k++) v = max(v, specAtHz(mix(f0, f1, (float(k) + 0.5) / 3.0)));
  return v;
}
// follower: instant attack, release in seconds
float follow(int i, out float raw) {
  raw = bandRaw(i);
  vec4 prev = texelFetch(sigState, ivec2(i, 0), 0);
  float lvl = clamp((raw - floorLevel) / max(ceilLevel - floorLevel, 0.01), 0.0, 1.0) * levelGain;
  float rise = clamp((raw - prev.g) * riseGain, 0.0, 1.0);
  float target = max(lvl, rise);
  float held = prev.r * exp(-TIMEDELTA / max(release, 0.001));
  return max(target, held);
}
float weight(int i) {
  float raw;
  return minWidth + widthGain * follow(i, raw);
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(sigState, px, 0);
  if (px.y == 0 && px.x < MAXS) {
    if (px.x >= slabs) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    float raw;
    float e = follow(px.x, raw);
    fragColor = vec4(e, raw, 0.0, 1.0);
    return;
  }
  if (px.y == 1 && px.x <= MAXS) {
    float total = 0.0;
    float upto = 0.0;
    for (int i = 0; i < MAXS; i++) {
      if (i >= slabs) break;
      float w = weight(i);
      total += w;
      if (i < px.x) upto += w;
    }
    fragColor = vec4(px.x >= slabs ? 1.0 : upto / max(total, 1e-4), 0.0, 0.0, 1.0);
    return;
  }
  if (px.y == 0 && px.x == 40) {
    bool beat = AUDIO_BEAT > 0.5;
    float since = FRAMEINDEX == 0 ? 255.0 : min(prev.r + 1.0, 255.0);
    float cnt = prev.g;
    if (beat) { since = 0.0; cnt = mod(cnt + 1.0, 1024.0); }
    fragColor = vec4(since, cnt, 0.0, 1.0);
    return;
  }
  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
