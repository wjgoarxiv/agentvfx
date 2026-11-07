// bass-circle pass 0: bass-band pro-motion bars plus a shift register of past bar rows (one delayed copy per layer).
// ---- pro motion stage: spectrum -> bar values (shared by the spectrum family) ----
// Bin mapping: bar i covers startFreq + (endFreq - startFreq) * (i / n)^freqCurve, a power curve that
// gives the lows more bars (common bar visualisers use exponent 2.5). Each bar takes the
// maximum of four taps of the 512-bin audioFFT texture (bin s is centred near 29.3 + 46.875 * s Hz).
// The dB tilt (+tilt per octave above 200 Hz) offsets the 1/f slope of music. The value is windowed
// by floorLevel / ceilLevel, raised to a per-bar exponent (expLow for the lows ramping to expHigh for
// the highs, so quiet bars collapse and loud peaks pop), and the first headBars of the bars are weighted
// down to headMin so the sub-bass edge does not dominate. Peak-preserving neighbour smoothing keeps
// local maxima and lets each bar lift its neighbours by value / monsterSmooth^distance.
float specAt(float hz) {
  float s = (hz - 29.3) / 46.875;
  return texture(audioFFT, vec2(clamp((s + 0.5) / 512.0, 0.0, 1.0), 0.5)).r;
}

float binValue(int i, int n) {
  float t0 = float(i) / float(n);
  float f0 = startFreq + (endFreq - startFreq) * pow(t0, freqCurve);
  float f1 = startFreq + (endFreq - startFreq) * pow(float(i + 1) / float(n), freqCurve);
  float v = 0.0;
  for (int k = 0; k < 4; k++) {
    float fq = mix(f0, f1, (float(k) + 0.5) / 4.0);
    float a = specAt(fq);
    v = max(v, a > 0.001 ? a + tilt * log2(max(fq, 20.0) / 200.0) : 0.0);
  }
  float x = clamp((v - floorLevel) / max(ceilLevel - floorLevel, 0.01), 0.0, 1.0);
  x = pow(x, mix(expHigh, expLow, 1.0 - t0 * t0));
  float hb = headBars * float(n);
  return hb > 0.5 && float(i) < hb ? x * mix(headMin, 1.0, float(i) / hb) : x;
}

float smoothedBar(int i, int n) {
  float v = binValue(i, n);
  for (int d = 1; d <= 6; d++) {
    float w = 1.0 / pow(monsterSmooth, float(d));
    if (i - d >= 0) { v = max(v, binValue(i - d, n) * w); }
    if (i + d < n) { v = max(v, binValue(i + d, n) * w); }
  }
  return v;
}

// state texel of bar i: r = height, g = cap, b = cap fall speed, a = cap hold timer
vec4 barStep(vec4 prev, int i, int n) {
  float t0 = float(i) / float(n);
  float raw = smoothedBar(i, n);
  float rel = releaseMs * (1.0 + bassHold * (1.0 - t0));
  float k = 1.0 - exp(-TIMEDELTA / max((raw > prev.r ? attackMs : rel) * 0.001, 0.0005));
  float h = prev.r + (raw - prev.r) * k;
  float cap = prev.g;
  float vel = prev.b;
  float hold = prev.a;
  if (h >= cap) {
    cap = h;
    vel = 0.0;
    hold = capHoldMs * 0.001;
  } else if (hold > 0.0) {
    hold -= TIMEDELTA;
  } else {
    vel += capGravity * TIMEDELTA;
    cap = max(h, cap - vel * TIMEDELTA);
  }
  return vec4(h, cap, vel, hold);
}

// clock texel: (hit count, last hit frame, kick count, last kick frame). A hit is an onset whose spectral
// flux reaches hitFlux; a kick is an onset whose bass ratio reaches kickBass.
vec4 clockStep(vec4 ev) {
  if (AUDIO_ONSET > 0.5 && AUDIO_FLUX >= hitFlux) { ev.x += 1.0; ev.y = float(FRAMEINDEX); }
  if (AUDIO_ONSET > 0.5 && AUDIO_BASS >= kickBass) { ev.z += 1.0; ev.w = float(FRAMEINDEX); }
  return ev;
}
// state pass: bars in row 0 of barState, clock in texel (0, 1), history rows 4..27 where row 3 + d
// holds the bars as they were d frames ago (a shift register: each row copies the row below it from the
// previous frame), so templates can draw delayed echoes.
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(barState, px, 0);
  if (px.y == 0 && px.x < bandCount) {
    fragColor = barStep(prev, px.x, bandCount);
    return;
  }
  if (px.y == 1 && px.x == 0) {
    fragColor = clockStep(prev);
    return;
  }
  if (px.y >= 4 && px.y <= 27 && px.x < bandCount) {
    fragColor = texelFetch(barState, ivec2(px.x, px.y == 4 ? 0 : px.y - 1), 0);
    return;
  }
  fragColor = vec4(0.0);
}