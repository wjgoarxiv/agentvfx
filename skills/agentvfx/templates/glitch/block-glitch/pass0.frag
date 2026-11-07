// block-glitch pass0: persistent trigger counter (one value everywhere, read with texelFetch at 0,0).
//   r = onsets seen so far, g = beats seen so far,
//   b = frames since the last trigger of the locked kind (lock 1 = onset, lock 2 = beat), saturating.
// Frames are rendered strictly in order, so the counter is deterministic.
void main() {
  vec4 prev = FRAMEINDEX == 0 ? vec4(0.0, 0.0, 255.0, 0.0) : texelFetch(counter, ivec2(0), 0);
  float onset = AUDIO_ONSET > 0.5 ? 1.0 : 0.0;
  float beat = AUDIO_BEAT > 0.5 ? 1.0 : 0.0;
  float trig = lockMode == 1 ? onset : (lockMode == 2 ? beat : 0.0);
  float age = trig > 0.5 ? 0.0 : min(prev.b + 1.0, 255.0);
  fragColor = vec4(prev.r + onset, prev.g + beat, age, 1.0);
}
