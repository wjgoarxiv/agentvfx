// spectrogram-scroll pass0: the persistent scrolling buffer. Every frame the image moves left by `shift`
// whole texels (an exact integer fetch, no resampling blur) and a fresh column of `shift` texels is written
// at the right edge from the audioFFT spectrum: frequency on the vertical axis (log, linear or square-root),
// a dB window [dbMin, dbMax] with a pink tilt, a max over several taps where one pixel covers many bins.
// Frame 0 pre-rolls the buffer with a ghost history (noise-modulated, spectrally tilted, fading to the left)
// scaled by `preroll`, so the first second is not an empty screen; it scrolls away like any older data.
// Channels: r = level 0..1, g = onset flag, b = beat flag.
float freqAt(float v) {
  if (freqScale == 1) return fMin + v * (fMax - fMin);
  if (freqScale == 2) {
    float s = mix(sqrt(fMin), sqrt(fMax), v);
    return s * s;
  }
  return fMin * pow(fMax / fMin, v);
}

// audioFFT bin i holds 4 FFT bins of 11.72 Hz: it is centred on 46.875 * i + 29.3 Hz.
float dbAt(float f) {
  float bin = (f - 29.3) / 46.875;
  float v = texture(audioFFT, vec2((bin + 0.5) / 512.0, 0.5)).r;
  return v * 70.0 - 70.0 + tilt * log2(max(f, 1.0) / 1000.0);
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  int W = int(RENDERSIZE.x);
  int shift = max(1, int(floor(float(scrollPx) * RENDERSIZE.x / 1920.0 + 0.5)));
  float f0 = freqAt((gl_FragCoord.y - 0.5) / RENDERSIZE.y);
  float f1 = freqAt((gl_FragCoord.y + 0.5) / RENDERSIZE.y);
  float db = -200.0;
  for (int i = 0; i < 4; i++) db = max(db, dbAt(mix(f0, f1, (float(i) + 0.5) / 4.0)));
  float u = clamp((db - dbMin) / (dbMax - dbMin), 0.0, 1.0);
  if (px.x < W - shift) {
    if (FRAMEINDEX > 0) {
      fragColor = texelFetch(specBuf, ivec2(px.x + shift, px.y), 0);
      return;
    }
    float v = (gl_FragCoord.y - 0.5) / RENDERSIZE.y;
    float ago = float((W - 1 - px.x) / shift);
    float n = vnoise(vec2(ago * 0.16, v * 14.0));
    float n2 = vnoise(vec2(ago * 0.9, v * 40.0 + 7.0));
    float env = 0.55 + 0.45 * vnoise(vec2(ago * 0.05, 3.0));
    float ghost = (pow(1.0 - v, 1.3) * 0.8 * env + 0.25 * u) * (0.3 + 0.7 * n) + 0.18 * n2 - 0.12;
    float fade = 1.0 - 0.55 * float(W - 1 - px.x) / float(W);
    float onset = step(0.94, hash12(vec2(floor(ago / 3.0), 5.0))) * step(mod(ago, 3.0), 0.5);
    fragColor = vec4(clamp(ghost * fade, 0.0, 1.0) * preroll, onset * preroll, 0.0, 1.0);
    return;
  }
  float prev = FRAMEINDEX == 0 ? 0.0 : texelFetch(specBuf, ivec2(W - 1, px.y), 0).r;
  u = mix(u, prev, smoothing);
  fragColor = vec4(u, AUDIO_ONSET > 0.5 ? 1.0 : 0.0, AUDIO_BEAT > 0.5 ? 1.0 : 0.0, 1.0);
}
