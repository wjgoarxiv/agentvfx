// xy-phosphor pass0: the beam segment table. Texel k holds segment k as (a.xy, b.xy) in height
// units with the origin at the screen centre; unused texels hold 1000 (off screen).
// srcMode 0: audio L -> X, R -> Y (a mono input is delay-embedded: Y = the signal a few samples later).
// srcMode 1: Lissajous test signal x = sin(a*th + delta), y = sin(b*th). srcMode 2: the same, driven by the audio.
const int NSEG = 511;
const float TAU = 6.28318530718;

float ch(int row, int i) { return texelFetch(audio, ivec2(clamp(i, 0, 511), row), 0).r * 2.0 - 1.0; }

bool monoInput() {
  float d = 0.0;
  for (int i = 0; i < 512; i += 4) d = max(d, abs(ch(0, i) - ch(1, i)));
  return d < 0.002;
}

vec2 lissajous(int i) {
  float th = TAU * lissFreq * (TIME + float(i) / 48000.0);
  float dl = lissDelta + lissDrift * TIME;
  float amp = 1.0;
  if (srcMode == 2) {
    amp = 0.45 + 0.75 * clamp(AUDIO_RMS * 5.0, 0.0, 1.0);
    dl += 0.2 * AUDIO_TREB_ATT;
  }
  vec2 v = vec2(sin(float(lissA) * th + TAU * dl), sin(float(lissB) * th));
  vec2 f = sin(v * (1.0 + 3.0 * lissFold) * 1.57079633);
  return mix(v, f, min(lissFold * 2.0, 1.0)) * amp;
}

vec2 beamPoint(int i, bool mono) {
  vec2 v;
  if (srcMode == 0) {
    float r = mix(ch(1, i), ch(1, i + embedDelay), mono ? monoWiden : 0.0);
    v = tanh(gain * vec2(ch(0, i), r));
  } else {
    v = lissajous(i);
  }
  v = rot(angle) * v * scale;
  return v + (hash22(vec2(float(i), float(FRAMEINDEX))) - 0.5) * noise;
}

void main() {
  ivec2 t = ivec2(gl_FragCoord.xy);
  int cols = int(min(RENDERSIZE.x, 512.0));
  int k = t.y * cols + t.x;
  if (k >= NSEG) {
    fragColor = vec4(1000.0);
    return;
  }
  bool mono = srcMode == 0 && monoInput();
  int reach = mono ? int(monoWiden * float(embedDelay)) : 0;
  if (k + 1 + reach > 511) {
    fragColor = vec4(1000.0);
    return;
  }
  fragColor = vec4(beamPoint(k, mono), beamPoint(k + 1, mono));
}
