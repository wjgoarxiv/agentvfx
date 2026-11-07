// hud-deck pass 0: pro-smoothed spectrum columns, persistent in specState (row 0 of the buffer).
// 256 log-spaced columns startFreq..endFreq. Each column takes the maximum of four taps of the 512-bin
// audioFFT (bin s sits near 29.3 + 46.875 * s Hz), is windowed by floorLevel / ceilLevel and shaped by
// a power, lifts its neighbours by 0.78^distance (peak preserving), then follows with attack / release.
const int NCOL = 256;
float specAtHz(float hz) {
  float s = (hz - 29.3) / 46.875;
  return texture(audioFFT, vec2(clamp((s + 0.5) / 512.0, 0.0, 1.0), 0.5)).r;
}
float colRaw(int i) {
  float ratio = endFreq / startFreq;
  float f0 = startFreq * pow(ratio, float(i) / float(NCOL));
  float f1 = startFreq * pow(ratio, float(i + 1) / float(NCOL));
  float v = 0.0;
  for (int k = 0; k < 4; k++) v = max(v, specAtHz(mix(f0, f1, (float(k) + 0.5) / 4.0)));
  float x = clamp((v - floorLevel) / max(ceilLevel - floorLevel, 0.01), 0.0, 1.0);
  return pow(x, specExp);
}
float colSmooth(int i) {
  float v = colRaw(i);
  for (int d = 1; d <= 3; d++) {
    float w = pow(0.78, float(d));
    if (i - d >= 0) v = max(v, colRaw(i - d) * w);
    if (i + d < NCOL) v = max(v, colRaw(i + d) * w);
  }
  return v;
}
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(specState, px, 0);
  if (px.y == 0 && px.x < NCOL) {
    float raw = colSmooth(px.x);
    float k = 1.0 - exp(-TIMEDELTA / max((raw > prev.r ? attackMs : releaseMs) * 0.001, 0.0005));
    fragColor = vec4(prev.r + (raw - prev.r) * k, 0.0, 0.0, 1.0);
    return;
  }
  fragColor = vec4(0.0);
}
