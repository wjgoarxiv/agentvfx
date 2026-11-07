// Downsample level 3 from b2.

vec2 bloomTexel(float level) {
  float last = max(bloomRadius * RENDERSIZE.y / 3.0, 4.0);
  float s = level <= 0.0 ? 1.0 : max(pow(last, level / 4.0), 1.0);
  if (spread > 0.5) {
    float unit = max(bloomRadius * RENDERSIZE.y / 48.0, 1.0);
    s = level <= 0.0 ? 1.0 : unit * pow(2.0, level - 1.0);
  }
  return vec2(s) / RENDERSIZE;
}

vec3 tap(vec2 uv) { return max(texture(b2, uv).rgb, 0.0); }

void main() {
  // Dense gaussian, so a one-pixel probe has a continuous falloff. The pyramid steps
  // are wider than one pixel once the radius is a fraction of the frame.
  if (probeDot > 0.5) {
    float sigma = max(bloomRadius, 0.08) * RENDERSIZE.y * 0.5;
    float stepPx = max(sigma / 48.0, 1.0);
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int j = -48; j <= 48; j++) {
      float x = float(j) / 48.0;
      float w = exp(-0.5 * x * x);
      acc += w * max(texture(b1, vUv + vec2(float(j) * stepPx, 0.0) / RENDERSIZE).rgb, 0.0);
      wsum += w;
    }
    fragColor = vec4(acc / max(wsum, 1e-4), 1.0);
    return;
  }
  vec2 t = bloomTexel(3.0);
  vec2 uv = vUv;
  vec3 a = tap(uv) * 4.0;
  a += tap(uv + t * vec2(-1.0, -1.0));
  a += tap(uv + t * vec2( 1.0, -1.0));
  a += tap(uv + t * vec2(-1.0,  1.0));
  a += tap(uv + t * vec2( 1.0,  1.0));
  a += tap(uv + t * vec2(-2.0,  0.0));
  a += tap(uv + t * vec2( 2.0,  0.0));
  a += tap(uv + t * vec2( 0.0, -2.0));
  a += tap(uv + t * vec2( 0.0,  2.0));
  a += tap(uv + t * vec2(-2.0, -2.0)) * 0.5;
  a += tap(uv + t * vec2( 2.0, -2.0)) * 0.5;
  a += tap(uv + t * vec2(-2.0,  2.0)) * 0.5;
  a += tap(uv + t * vec2( 2.0,  2.0)) * 0.5;
  fragColor = vec4(a / 14.0, 1.0);
}
