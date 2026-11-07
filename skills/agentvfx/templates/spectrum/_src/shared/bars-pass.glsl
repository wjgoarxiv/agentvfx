//@include bars-fn.glsl

// state pass: bars in row 0 of barState, clock in texel (0, 1), history rows 4..27 where row 3 + d
// holds the bars as they were d frames ago (a shift register: each row copies the row below it from the
// previous frame), so templates can draw delayed echoes.
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 prev = texelFetch(barState, px, 0);
  if (px.y == 0 && px.x < bandCount) {
    fragColor = barStep(prev, px.x, bandCount);
    return;
  }
  if (px.y == 1 && px.x == 0) {
    fragColor = clockStep(prev);
    return;
  }
  if (px.y >= 4 && px.y <= 27 && px.x < bandCount) {
    fragColor = texelFetch(barState, ivec2(px.x, px.y == 4 ? 0 : px.y - 1), 0);
    return;
  }
  fragColor = vec4(0.0);
}
