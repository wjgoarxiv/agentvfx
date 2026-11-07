// clock texel: (hit count, last hit frame, kick count, last kick frame). A hit is an onset whose spectral
// flux reaches hitFlux; a kick is an onset whose bass ratio reaches kickBass.
vec4 clockStep(vec4 ev) {
  if (AUDIO_ONSET > 0.5 && AUDIO_FLUX >= hitFlux) { ev.x += 1.0; ev.y = float(FRAMEINDEX); }
  if (AUDIO_ONSET > 0.5 && AUDIO_BASS >= kickBass) { ev.z += 1.0; ev.w = float(FRAMEINDEX); }
  return ev;
}
