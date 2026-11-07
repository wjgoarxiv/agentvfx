// Scene dispatcher: variant 1..9 and 0 are the first ten scenes, rot 1 adds 10 (variant 0..5 + 10 are the round 9 scenes).
void drawScene(int v, vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  scS = S;
  scU = S.y;
  if (v == 1) { sceneSpecimen(q, S, clk, col); }
  if (v == 2) { sceneWiring(q, S, clk, col); }
  if (v == 3) { sceneFieldCut(q, S, clk, col); }
  if (v == 4) { scenePattern(q, S, clk, col); }
  if (v == 5) { sceneAnatomy(q, S, clk, col); }
  if (v == 6) { sceneDeck(q, S, clk, col); }
  if (v == 7) { sceneBootlog(q, S, clk, col); }
  if (v == 8) { sceneTunnel(q, S, clk, col); }
  if (v == 9) { sceneRunner(q, S, clk, col); }
  if (v == 0) { sceneAscii(q, S, clk, col); }
  if (v == 10) { sceneCubeWall(q, S, clk, col); }
  if (v == 11) { sceneVortex(q, S, clk, col); }
  if (v == 12) { sceneSticker(q, S, clk, col); }
  if (v == 13) { sceneRibbon(q, S, clk, col); }
  if (v == 14) { sceneSlab(q, S, clk, col); }
  if (v == 15) { sceneFrameDial(q, S, clk, col); }
  if (v == 16) { sceneTilt(q, S, clk, col); }
  if (v == 17) { sceneMarquee(q, S, clk, col); }
  if (v == 18) { sceneLens(q, S, clk, col); }
  if (v == 19) { sceneLiquid(q, S, clk, col); }
  if (v == 20) { scenePanelGrid(q, S, clk, col); }
  if (v == 21) { sceneMirror(q, S, clk, col); }
}
