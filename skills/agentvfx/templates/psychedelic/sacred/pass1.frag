// Sacred pass1: temporal smoothing. smoothLuma is persistent; each frame moves toward the new
// luminance by `settle` (1 = no smoothing), which keeps the colour bands flowing instead of flickering.
// g and b hold the print palette's tide clock (main reads clock = TIME * g + b): when the speed changes, b takes
// up the difference, so the tide keeps its position and only its rate changes. The clock is a speed and an offset
// because a running total would stall in these half-float buffers.
const float PRINT_SPEED_MAX = 1.0;

void main() {
  float now = texture(lumaNow, vUv).r;
  vec4 last = texture(smoothLuma, vUv);
  float k = FRAMEINDEX == 0 ? 1.0 : clamp(settle, 0.05, 1.0);
  float speed = min(tideSpeed * (1.0 + audioKick * AUDIO_BASS * 1.5), PRINT_SPEED_MAX);
  float held = last.g;
  float offset = last.b;
  if (FRAMEINDEX == 0) {
    held = speed;
    offset = 0.0;
  } else if (abs(speed - held) > 0.001) {
    offset += TIME * (held - speed);
    held = speed;
  }
  fragColor = vec4(mix(last.r, now, k), held, offset, 1.0);
}
