// Kawase streak, pass p=0. Quarter-res stride unit is 1; full-res step is 4px at 1080p, scaled by height.

void main() {
  float unit = 1.0;
  float stepPx = unit * 4.0 * streakScale * (RENDERSIZE.y / 1080.0);
  vec2 dir = vec2(cos(streakAngle), sin(streakAngle));
  vec3 acc = texture(hi, vUv).rgb;
  float wsum = 1.0;
  for (int j = 1; j <= 6; j++) {
    float w = pow(streakFalloff, unit * float(j));
    vec2 o = dir * (stepPx * float(j)) / RENDERSIZE;
    acc += w * (texture(hi, vUv + o).rgb + texture(hi, vUv - o).rgb);
    wsum += 2.0 * w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}
