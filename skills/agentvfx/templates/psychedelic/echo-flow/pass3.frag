// echo-flow prev: stash this frame's luma for next frame's It term.
void main() {
  fragColor = vec4(luma(texture(inputImage, vUv).rgb), 0.0, 0.0, 1.0);
}
