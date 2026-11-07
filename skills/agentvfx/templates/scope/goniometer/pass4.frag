// pass4: horizontal blur of bv1 at a wide stride (7 px at 1080p): the deep glow tail, level 2.
void main() {
  float st = 7.0 * (RENDERSIZE.y / 1080.0) * bloomSize / RENDERSIZE.x;
  vec4 acc = vec4(0.0);
  float wt = 0.0;
  for (int k = -6; k <= 6; k++) {
    float w = exp(-0.5 * float(k * k) / 9.0);
    acc += w * texture(bv1, vUv + vec2(float(k) * st, 0.0));
    wt += w;
  }
  fragColor = acc / wt;
}
