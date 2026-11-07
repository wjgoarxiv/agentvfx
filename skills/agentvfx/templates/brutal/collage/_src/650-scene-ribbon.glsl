// Scene 13 (variant 3, rot 1), ribbon-rays: an ochre field with a fan of white hairline rays (the ray count grows on every beat,
// every third ray is a thin wedge), and a twisted ribbon that crosses the frame: its front face is black with a heavy condensed word
// flowing along it (the flow steps on every beat), its back face is an ochre duotone of the plate; four echo copies trail behind in
// colour steps. One DIN Condensed label sits at the root of the rays. Palette: ground (ochre), ink (white), accent (black),
// tintA (dark ochre), tintB (pale ochre). Text set 14: r the ribbon line (Avenir Next Condensed), g the label.
float rbY(float x, float ph) { return 0.5 + 0.2 * sin(x * 2.6 + ph); }
float rbTw(float x) { return cos(x * 1.9 + 0.6); }

void sceneRibbon(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 white = inkColor.rgb;
  vec3 blk = accentColor.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // rays from the lower left, one more pair on every beat
  vec2 ro = vec2(0.14, 0.9);
  vec2 dr = c - ro;
  float a = atan(dr.y, dr.x);
  float nr = 6.0 + mod(cut, 14.0) * 2.0;
  float ra = a * nr / 6.28318;
  float da = (fract(ra) - 0.5) * 6.28318 / nr;
  float ray = scLine(da * length(dr), 1.0);
  float wedge = step(mod(floor(ra), 3.0), 0.5) * step(abs(da * length(dr)), 0.006 + 0.012 * length(dr));
  col = mix(col, white, max(ray * 0.85, wedge * 0.9));
  // the ribbon and its echoes, back to front
  float flow = cut * 0.07;
  for (int e = 4; e >= 0; e--) {
    float fe = float(e);
    float ph = cut * 0.35 - fe * 0.2;
    float yy = rbY(c.x, ph) + fe * 0.03;
    float tw = rbTw(c.x - fe * 0.08);
    float wd = 0.02 + 0.11 * abs(tw);
    float dy = c.y - yy;
    float inside = scAA(abs(dy) - wd);
    if (e > 0) {
      vec3 ec = e == 4 ? tintA.rgb : (e == 3 ? tintB.rgb : (e == 2 ? blk : white));
      col = mix(col, ec, scLine(abs(dy) - wd, 1.5) * 0.9);
      continue;
    }
    vec3 face;
    if (tw > 0.0) {
      float m = crisp(sheetC(vec2(fract(c.x * 0.45 + flow) * 0.96 * RENDERSIZE.x, (0.012 + (0.5 + 0.5 * dy / max(wd, 0.004)) * 0.07) * RENDERSIZE.y), 0), 1.0);
      face = mix(blk, white, m);
    } else {
      float l = clamp((luma(scPlate(q, vec2(0.0), S)) - 0.05) * 1.8, 0.0, 1.0);
      face = mix(blk, vec3(1.0, 0.82, 0.38), l);
    }
    col = mix(col, face, inside);
    col = mix(col, white, scLine(abs(dy) - wd, 1.0) * 0.9);
  }
  col = mix(col, blk, scAA(length(c - ro) - 0.012));
  col = mix(col, blk, scSheet(q, 1));
  col = mix(col, blk, max(scPlus(c, vec2(A - 0.07, 0.08), 0.02), scPlus(c, vec2(0.45 * A, 0.94), 0.02)));
}
