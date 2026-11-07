// Downsample level 2 from b1.

vec2 bloomTexel(float level) {
  float last = max(bloomRadius * RENDERSIZE.y / 3.0, 4.0);
  float s = level <= 0.0 ? 1.0 : max(pow(last, level / 4.0), 1.0);
  if (spread > 0.5) {
    float unit = max(bloomRadius * RENDERSIZE.y / 48.0, 1.0);
    s = level <= 0.0 ? 1.0 : unit * pow(2.0, level - 1.0);
  }
  return vec2(s) / RENDERSIZE;
}

vec3 tap(vec2 uv) { return max(texture(b1, uv).rgb, 0.0); }

void main() {
  vec2 t = bloomTexel(2.0);
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
