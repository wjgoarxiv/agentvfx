// Kawase streak, pass p=2. Stride unit 16. This is the long cinema tail.

void main() {
  float unit = 16.0;
  float stepPx = unit * 4.0 * streakScale * (RENDERSIZE.y / 1080.0);
  vec2 dir = vec2(cos(streakAngle), sin(streakAngle));
  vec3 acc = texture(s1, vUv).rgb;
  float wsum = 1.0;
  for (int j = 1; j <= 5; j++) {
    float w = pow(streakFalloff, unit * float(j));
    vec2 o = dir * (stepPx * float(j)) / RENDERSIZE;
    acc += w * (texture(s1, vUv + o).rgb + texture(s1, vUv - o).rgb);
    wsum += 2.0 * w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}
