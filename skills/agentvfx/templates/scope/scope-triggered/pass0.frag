// scope-triggered pass0: the trace table. Row 0, column x holds (yL, yR, valid, 0) in height units for
// the pixel column x; row 1, column 0 holds (start/512, N/512, 0, 0) for the HUD.
// The engine already hands over `audio` aligned to a rising zero crossing, so syncMode 1 refines that
// crossing to a sub-sample position (the crossing lands exactly on the left edge). Mode 2 re-triggers at
// syncLevel, mode 3 shows syncCycles periods of syncHz, mode 0 free-runs (the display jitters).
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

void main() {
  float W = RENDERSIZE.x;
  float start;
  float n;
  if (gl_FragCoord.y >= 2.0) {
    fragColor = vec4(0.0);
    return;
  }
  sync(start, n);
  if (gl_FragCoord.y >= 1.0) {
    fragColor = gl_FragCoord.x < 1.0 ? vec4(start / 512.0, n / 512.0, 0.0, 0.0) : vec4(0.0);
    return;
  }
  float x0 = 0.215 * W;
  float u = (gl_FragCoord.x - x0) / (W - 2.0 * x0);
  if (u < 0.0 || u > 1.0) {
    fragColor = vec4(0.0);
    return;
  }
  float s = min(start + u * n, 511.0);
  float tw = pinch > 0.0 ? pow(max(sin(3.14159265 * u), 0.0), 2.0 * pinch) : 1.0;
  float a = 0.3 - 0.5 * stereoSeparation;
  float yL = 0.5 * stereoSeparation + a * tanh(amplitude * samp(0, s, interpolate)) * tw;
  float yR = -0.5 * stereoSeparation + a * tanh(amplitude * samp(1, s, interpolate)) * tw;
  fragColor = vec4(yL, yR, 1.0, 0.0);
}
