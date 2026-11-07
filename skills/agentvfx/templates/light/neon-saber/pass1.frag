// Cheap bloom of the beam so the Lorentzian wing blooms again instead of stopping hard.

void main() {
  vec2 t = vec2(max(RENDERSIZE.y * 0.006, 1.0)) / RENDERSIZE;
  vec3 a = texture(beam, vUv).rgb * 4.0;
  a += texture(beam, vUv + t * vec2(-1.0,  0.0)).rgb * 2.0;
  a += texture(beam, vUv + t * vec2( 1.0,  0.0)).rgb * 2.0;
  a += texture(beam, vUv + t * vec2( 0.0, -1.0)).rgb * 2.0;
  a += texture(beam, vUv + t * vec2( 0.0,  1.0)).rgb * 2.0;
  a += texture(beam, vUv + t * vec2(-1.0, -1.0)).rgb;
  a += texture(beam, vUv + t * vec2( 1.0, -1.0)).rgb;
  a += texture(beam, vUv + t * vec2(-1.0,  1.0)).rgb;
  a += texture(beam, vUv + t * vec2( 1.0,  1.0)).rgb;
  fragColor = vec4(a / 16.0, 1.0);
}
