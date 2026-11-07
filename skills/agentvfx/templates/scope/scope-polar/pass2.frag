// pass2: horizontal blur of the beam, tight scale (13 taps, stride 2 px at 1080p). Half-res style bloom, level 1.
void main() {
  float st = 2.0 * (RENDERSIZE.y / 1080.0) * bloomSize / RENDERSIZE.x;
  vec4 acc = vec4(0.0);
  float wt = 0.0;
  for (int k = -6; k <= 6; k++) {
    float w = exp(-0.5 * float(k * k) / 9.0);
    acc += w * texture(beam, vUv + vec2(float(k) * st, 0.0));
    wt += w;
  }
  fragColor = acc / wt;
}
