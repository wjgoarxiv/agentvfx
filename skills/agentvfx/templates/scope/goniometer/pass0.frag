// goniometer pass0: the segment table. Texel k (0..510) holds beam segment k as (a.xy, b.xy) in height
// units, origin at the screen centre, with x = (L-R)/sqrt2 and y = (L+R)/sqrt2 (scaled so full-scale mono
// reaches `scale`). Texel 511 holds the field statistics (correlation, balance) for the HUD.
// srcMode 0: audio L/R as is (a mono input is a vertical line). srcMode 1: Lissajous test signal as L/R.
// srcMode 2: audio with the right channel mixed toward its own delayed copy (widened mono).
const int NSEG = 511;
const float TAU = 6.28318530718;

float ch(int row, int i) { return texelFetch(audio, ivec2(clamp(i, 0, 511), row), 0).r * 2.0 - 1.0; }

vec2 stereoAt(int i);

vec3 fieldStats() {
  float ll = 0.0;
  float rr = 0.0;
  float lr = 0.0;
  for (int i = 0; i < 512; i++) {
    vec2 s = srcMode == 1 ? stereoAt(i) : vec2(ch(0, i), ch(1, i));
    ll += s.x * s.x;
    rr += s.y * s.y;
    lr += s.x * s.y;
  }
  float corr = ll * rr > 1e-9 ? lr / sqrt(ll * rr) : 1.0;
  float bal = ll + rr > 1e-9 ? (rr - ll) / (rr + ll) : 0.0;
  return vec3(corr, bal, 0.0);
}

vec2 stereoAt(int i) {
  if (srcMode == 1) {
    float th = TAU * lissFreq * (TIME + float(i) / 48000.0);
    return vec2(sin(float(lissA) * th + TAU * (lissDelta + lissDrift * TIME)), sin(float(lissB) * th));
  }
  float r = srcMode == 2 ? mix(ch(1, i), ch(1, i + embedDelay), widen) : ch(1, i);
  return tanh(gain * vec2(ch(0, i), r));
}

vec2 beamPoint(int i) {
  vec2 lr = stereoAt(i);
  vec2 v = vec2(lr.x - lr.y, lr.x + lr.y) * 0.5 * scale;
  if (swapSides) v.x = -v.x;
  return v + (hash22(vec2(float(i), float(FRAMEINDEX))) - 0.5) * noise;
}

void main() {
  ivec2 t = ivec2(gl_FragCoord.xy);
  int cols = int(min(RENDERSIZE.x, 512.0));
  int k = t.y * cols + t.x;
  if (k == NSEG) {
    fragColor = vec4(fieldStats(), 1.0);
    return;
  }
  int reach = srcMode == 2 ? embedDelay : 0;
  if (k > NSEG || k + 1 + reach > 511) {
    fragColor = vec4(1000.0);
    return;
  }
  fragColor = vec4(beamPoint(k), beamPoint(k + 1));
}
