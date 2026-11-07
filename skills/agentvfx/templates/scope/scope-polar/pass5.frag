// pass5: vertical blur at the wide stride. Output bv2 = the deep glow (about 20 px sigma at 1080p).
void main() {
  float st = 7.0 * (RENDERSIZE.y / 1080.0) * bloomSize / RENDERSIZE.y;
  vec4 acc = vec4(0.0);
  float wt = 0.0;
  for (int k = -6; k <= 6; k++) {
    float w = exp(-0.5 * float(k * k) / 9.0);
    acc += w * texture(bh2, vUv + vec2(0.0, float(k) * st));
    wt += w;
  }
  fragColor = acc / wt;
}
