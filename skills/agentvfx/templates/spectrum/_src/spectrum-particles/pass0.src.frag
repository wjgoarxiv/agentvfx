// spectrum-particles pass 0: persistent state in `partState` (one texel per value, read with texelFetch).
//   rows 0..7, x 0..bandCount-1 : spectrum snapshot (pro-motion bar values) taken at each hit, ring of 8 slots
//   rows 0..7, x 96             : (birth frame, strength = spectral flux, 1, 1) of the hit stored in that slot
//   row 8,   x 0..bandCount-1   : live bars, r = smoothed height, g = cap, b = cap speed, a = cap hold
//   texel (0, 9)                : clock (hit count, last hit frame, kick count, last kick frame); the next
//                                 slot is hit count mod 8
// A hit is an onset whose spectral flux reaches hitFlux. Particles are then evaluated analytically in
// main from the slot data, so they are exactly reproducible and never smear like advected sprites.
//@include bars-fn.glsl

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(partState, px, 0);
  vec4 clk = texelFetch(partState, ivec2(0, 9), 0);
  bool hit = AUDIO_ONSET > 0.5 && AUDIO_FLUX >= hitFlux;
  if (px.y == 8 && px.x < bandCount) {
    fragColor = barStep(prev, px.x, bandCount);
    return;
  }
  if (px.y < 8 && px.x <= 96) {
    if (hit && px.y == int(mod(clk.x, 8.0))) {
      fragColor = px.x < 96 ? vec4(px.x < bandCount ? smoothedBar(px.x, bandCount) : 0.0, 0.0, 0.0, 1.0) : vec4(float(FRAMEINDEX), clamp(AUDIO_FLUX, 0.4, 1.6), 1.0, 1.0);
    } else {
      fragColor = prev;
    }
    return;
  }
  if (px.x == 0 && px.y == 9) {
    fragColor = clockStep(prev);
    return;
  }
  fragColor = vec4(0.0);
}
