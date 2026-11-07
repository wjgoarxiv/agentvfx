// lattice pass 0: sound events, persistent in `lat` (row 0). Written fresh.
// Attack is the frame of the onset: an event is stamped with this frame's TIME and full strength, and the
// only thing that ever fades is the release applied in main.frag (exp(-age / release)). The one running
// envelope here (highs) is max(raw, previous * exp(-dt / release)), so it also rises with no smoothing.
// texel (0,0): x highs envelope, y bass of the previous frame, z kick count, w tear count
// texels (2..5,0): kick slots   (birth time, origin x, origin y as frame fractions, strength)
// texels (6..8,0): tear slots   (birth time, line y as a frame fraction, strength, side sign)
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 st = texelFetch(lat, ivec2(0, 0), 0);
  vec4 out0 = texelFetch(lat, px, 0);
  float fall = exp(-TIMEDELTA / max(release, 0.004));
  bool kick = AUDIO_BASS >= kickBass && AUDIO_BASS > 1.5 * st.y;
  bool tear = AUDIO_ONSET > 0.5 && !kick;
  float kn = st.z;
  float tn = st.w;
  if (px == ivec2(0, 0)) {
    float hi = max(clamp((AUDIO_TREB - 0.8) * 0.2, 0.0, 1.0), st.x * fall);
    out0 = vec4(hi, AUDIO_BASS, kn + (kick ? 1.0 : 0.0), tn + (tear ? 1.0 : 0.0));
  } else if (px.y == 0 && kick && px.x == 2 + int(mod(kn, 4.0))) {
    float ox = fract(0.31 + kn * 0.6180339 + SEED) * 0.78 + 0.11;
    float oy = fract(0.67 + kn * 0.7548776 + SEED * 1.7) * 0.62 + 0.19;
    out0 = vec4(TIME, ox, oy, clamp((AUDIO_BASS - 1.0) * 0.25, 0.35, 1.0));
  } else if (px.y == 0 && tear && px.x == 6 + int(mod(tn, 3.0))) {
    float yc = fract(0.13 + tn * 0.4142136 + SEED * 3.1) * 0.8 + 0.1;
    out0 = vec4(TIME, yc, clamp(0.5 + AUDIO_FLUX * 0.6, 0.5, 1.0), mod(tn, 2.0) < 1.0 ? 1.0 : -1.0);
  }
  fragColor = out0;
}
