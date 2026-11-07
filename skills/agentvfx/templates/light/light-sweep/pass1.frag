// 3x3 tent of the gleam. Radius is a fraction of frame height.

void main() {
  vec2 t = vec2(max(bloomFrac * RENDERSIZE.y, 1.0)) / RENDERSIZE;
  vec3 c = texture(gleam, vUv).rgb * 4.0;
  c += texture(gleam, vUv + t * vec2(-1.0,  0.0)).rgb * 2.0;
  c += texture(gleam, vUv + t * vec2( 1.0,  0.0)).rgb * 2.0;
  c += texture(gleam, vUv + t * vec2( 0.0, -1.0)).rgb * 2.0;
  c += texture(gleam, vUv + t * vec2( 0.0,  1.0)).rgb * 2.0;
  c += texture(gleam, vUv + t * vec2(-1.0, -1.0)).rgb;
  c += texture(gleam, vUv + t * vec2( 1.0, -1.0)).rgb;
  c += texture(gleam, vUv + t * vec2(-1.0,  1.0)).rgb;
  c += texture(gleam, vUv + t * vec2( 1.0,  1.0)).rgb;
  fragColor = vec4(c / 16.0, 1.0);
}
