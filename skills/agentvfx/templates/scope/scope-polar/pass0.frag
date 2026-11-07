// scope-polar pass0: the ring table. Row 0, column j holds the screen position (height units, origin at the
// centre) of ring sample j as (xL, yL, xR, yR); row 1, column 0 holds (start/512, N/512, 0, 0) for the HUD.
// The waveform window [start, start+N] is wrapped `loops` times around the circle: mirror (seamless),
// raw (seamless only when the window is a whole number of periods) or close (linear detrend over the seam).
// Sync works as in scope-triggered: the engine aligns `audio` to a rising zero crossing, mode 1 refines it
// to a sub-sample position, mode 2 re-triggers at syncLevel, mode 3 shows syncCycles periods of syncHz.
const float TAU = 6.28318530718;

float rowv(int row, int i) { return texelFetch(audio, ivec2(clamp(i, 0, 511), row), 0).r * 2.0 - 1.0; }
float mono(int i) { return 0.5 * (rowv(0, i) + rowv(1, i)); }

float lanczos(float x) {
  x = abs(x);
  if (x < 1e-4) return 1.0;
  if (x >= 3.0) return 0.0;
  float px = 3.14159265 * x;
  return 3.0 * sin(px) * sin(px / 3.0) / (px * px);
}

float samp(int row, float s, int mode) {
  if (mode == 0) return rowv(row, int(floor(s + 0.5)));
  int i0 = int(floor(s));
  float f = s - float(i0);
  if (mode == 1) return mix(rowv(row, i0), rowv(row, i0 + 1), f);
  float acc = 0.0;
  float wsum = 0.0;
  for (int k = -2; k <= 3; k++) {
    float w = lanczos(f - float(k));
    acc += w * rowv(row, i0 + k);
    wsum += w;
  }
  return acc / wsum;
}

void sync(out float start, out float n) {
  n = float(window);
  if (syncMode == 3) n = clamp(float(syncCycles) * 48000.0 / syncHz, 8.0, 511.0);
  float v0 = mono(0);
  float v1 = mono(1);
  start = 0.0;
  if (v1 > v0 + 1e-4 && v0 >= 0.0 && v0 < 0.25) start = clamp(-v0 / (v1 - v0), -1.0, 0.0);
  if (syncMode == 0) start = mod(float(FRAMEINDEX) * 53.0, max(512.0 - n, 1.0));
  if (syncMode == 2) {
    for (int i = 0; i < 511; i++) {
      if (float(i) > 511.0 - n) break;
      float a = mono(i);
      float b = mono(i + 1);
      if (a < syncLevel && b >= syncLevel) {
        start = float(i) + (syncLevel - a) / (b - a);
        break;
      }
    }
  }
}

float ringValue(int row, float u, float start, float n) {
  float uk = fract(u * float(loops));
  float m = wrap == 0 ? 1.0 - abs(2.0 * uk - 1.0) : uk;
  float s = min(start + m * n, 511.0);
  float v = samp(row, s, interpolate);
  if (wrap == 2) v -= uk * (samp(row, min(start + n, 511.0), interpolate) - samp(row, start, interpolate));
  float tw = pinch > 0.0 ? pow(max(sin(3.14159265 * uk), 0.0), 2.0 * pinch) : 1.0;
  return depth * tanh(amplitude * v) * tw;
}

void main() {
  if (gl_FragCoord.y >= 2.0) {
    fragColor = vec4(0.0);
    return;
  }
  float start;
  float n;
  sync(start, n);
  if (gl_FragCoord.y >= 1.0) {
    fragColor = gl_FragCoord.x < 1.0 ? vec4(start / 512.0, n / 512.0, 0.0, 0.0) : vec4(0.0);
    return;
  }
  float u = (gl_FragCoord.x - 0.5) / RENDERSIZE.x;
  float th = TAU * u + spin * TIME;
  vec2 dir = vec2(cos(th), sin(th));
  float rL = ringRadius + 0.5 * stereoSeparation + ringValue(0, u, start, n);
  float rR = ringRadius - 0.5 * stereoSeparation + ringValue(1, u, start, n);
  fragColor = vec4(rL * dir, rR * dir);
}
