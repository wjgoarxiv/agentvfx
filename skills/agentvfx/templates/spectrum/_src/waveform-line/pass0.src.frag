// waveform-line pass 0: persistent `wstate`.
//   texel (0, 0)        : clock (hit count, last hit frame, kick count, last kick frame)
//   row 1, column x     : the smoothed waveform value for screen column x (the live line)
//   rows 2 .. 25        : a shift register, row 1 + d holds the line as it was d frames ago
// The live line is the 512-sample trigger-aligned waveform (audio texture row 0) low-passed with a
// 65-tap triangular window of +-smoothWin samples, compressed with tanh(gain * w) and added to a slow
// travelling sine pair scaled by the RMS envelope, so it keeps flowing between frames instead of
// showing a raw 10 ms slice. The history rows give delayed copies for the multi-layer look.
//@include clock.glsl

float liveLine(float u) {
  float w = 0.0;
  float wsum = 0.0;
  for (int k = -32; k <= 32; k++) {
    float wt = 33.0 - abs(float(k));
    w += wt * (texture(audio, vec2(clamp(u + float(k) * smoothWin / 32.0 / 512.0, 0.0, 1.0), 0.25)).r * 2.0 - 1.0);
    wsum += wt;
  }
  float v = tanh(gain * w / wsum);
  float env = clamp(AUDIO_RMS * 2.5, 0.05, 1.0);
  float s1 = sin(6.2832 * (u * 2.0 - TIME * 0.9));
  float s2 = sin(6.2832 * (u * 3.3 + TIME * 0.6 + 0.3));
  return v + flow * env * 0.5 * (s1 + 0.6 * s2);
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(wstate, px, 0);
  if (px.y == 0) {
    fragColor = px.x == 0 ? clockStep(prev) : vec4(0.0);
    return;
  }
  if (px.y == 1) {
    float u = (float(px.x) + 0.5) / RENDERSIZE.x;
    fragColor = vec4(liveLine(clamp((u - 0.08) / 0.84, 0.0, 1.0)), 0.0, 0.0, 1.0);
    return;
  }
  if (px.y <= 25) {
    fragColor = texelFetch(wstate, ivec2(px.x, px.y - 1), 0);
    return;
  }
  fragColor = vec4(0.0);
}
