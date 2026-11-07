// First downsample, level 0. Karis weight 1/(1+luma) on every tap, then renormalise.
// Spacing is a fraction of frame height so the halo scales with resolution.

vec2 bloomTexel(float level) {
  float last = max(bloomRadius * RENDERSIZE.y / 3.0, 4.0);
  float s = level <= 0.0 ? 1.0 : max(pow(last, level / 4.0), 1.0);
  if (spread > 0.5) {
    float unit = max(bloomRadius * RENDERSIZE.y / 48.0, 1.0);
    s = level <= 0.0 ? 1.0 : unit * pow(2.0, level - 1.0);
  }
  return vec2(s) / RENDERSIZE;
}

vec4 ktap(vec2 uv) {
  vec3 c = max(texture(hi, uv).rgb, 0.0);
  // Karis tames fireflies. A one-pixel probe is the signal, not a firefly.
  float w = probeDot > 0.5 ? 1.0 : 1.0 / (1.0 + luma(c));
  return vec4(c * w, w);
}

void main() {
  if (probeDot > 0.5) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int j = -16; j <= 16; j++) {
      float x = float(j) / 8.0;
      float w = exp(-0.5 * x * x);
      acc += w * max(texture(hi, vUv + vec2(float(j), 0.0) / RENDERSIZE).rgb, 0.0);
      wsum += w;
    }
    fragColor = vec4(acc / max(wsum, 1e-4), 1.0);
    return;
  }
  vec2 t = bloomTexel(0.0);
  vec2 uv = vUv;
  vec4 a = ktap(uv) * 4.0;
  a += ktap(uv + t * vec2(-1.0, -1.0));
  a += ktap(uv + t * vec2( 1.0, -1.0));
  a += ktap(uv + t * vec2(-1.0,  1.0));
  a += ktap(uv + t * vec2( 1.0,  1.0));
  a += ktap(uv + t * vec2(-2.0,  0.0));
  a += ktap(uv + t * vec2( 2.0,  0.0));
  a += ktap(uv + t * vec2( 0.0, -2.0));
  a += ktap(uv + t * vec2( 0.0,  2.0));
  a += ktap(uv + t * vec2(-2.0, -2.0)) * 0.5;
  a += ktap(uv + t * vec2( 2.0, -2.0)) * 0.5;
  a += ktap(uv + t * vec2(-2.0,  2.0)) * 0.5;
  a += ktap(uv + t * vec2( 2.0,  2.0)) * 0.5;
  fragColor = vec4(a.rgb / max(a.a, 1e-4), 1.0);
}
