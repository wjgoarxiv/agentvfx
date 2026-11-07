// waveform-line main: the waveform strip instrument. A framed strip (panel) with a 0..5 ruler above it
// (major ticks with numerals from the text layer, minor ticks between), a dashed centre axis, and the
// smoothed waveform drawn as a hairline: `layers` delayed copies (layerDelay frames apart, from the shift
// register in wstate), older ones dimmer and thinner. displayMode 0 = polyline, 1 = hair columns (one
// vertical hairline per column from the axis, like a dense scope strip), 2 = dots. The line is pinched
// to nothing at both ends and grows from the centre at the start. A hit thickens and fills the strip
// frame for ~3 frames. Corner brackets, + marks and engine text complete the panel.
//@include stage.glsl
//@include hud.glsl

float lineVal(float x, int d, float lo, float wd, float halfH) {
  float u = (x - lo) / wd;
  if (u < 0.0 || u > 1.0 || abs(u - 0.5) * 2.0 > introSpan()) { return 0.0; }
  float v = texelFetch(wstate, ivec2(clamp(int(x), 0, int(RENDERSIZE.x) - 1), 1 + d), 0).r;
  return v * pow(sin(3.14159265 * u), pinch) * halfH * introK();
}

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  vec4 clk = texelFetch(wstate, ivec2(0, 0), 0);
  vec2 sp = vUv * res;
  vec2 px = stageUv(clk, vUv) * res;
  vec2 lo = vec2(0.08 * res.x, 0.3 * res.y);
  vec2 hi = vec2(0.92 * res.x, 0.66 * res.y);
  float wd = hi.x - lo.x;
  float mid = (lo.y + hi.y) * 0.5;
  float halfH = (hi.y - lo.y) * 0.5 * amplitude / 0.3 * 0.62;
  float t = (px.x - lo.x) / wd;
  float hit = step(0.5, hitEnv(clk, 0.1)) * step(0.5, clk.x) * hitBoost;
  float w = hudW();
  float inPanel = inRect(px, lo, hi);

  float cvr = 0.0;
  float dist = 1.0e4;
  for (int k = 7; k >= 0; k--) {
    if (k >= layers) { continue; }
    int d = k * layerDelay;
    float alpha = k == 0 ? 1.0 : 0.5 * pow(0.7, float(k - 1));
    if (displayMode == 0) {
      float f0 = lineVal(px.x, d, lo.x, wd, halfH);
      float slope = (lineVal(px.x + 2.0, d, lo.x, wd, halfH) - lineVal(px.x - 2.0, d, lo.x, wd, halfH)) * 0.25;
      for (int s = 0; s < 2; s++) {
        if (s == 1 && !mirror) { break; }
        float sg = s == 0 ? 1.0 : -1.0;
        float dd = abs(px.y - (mid + sg * f0)) / sqrt(1.0 + slope * slope);
        if (k == 0) { dist = min(dist, dd); }
        cvr = max(cvr, clamp(w * (1.0 + hit) * 0.5 - dd + 0.5, 0.0, 1.0) * alpha * inPanel);
      }
    } else if (displayMode == 1) {
      float cell = max(wd / float(columns), 2.0 * U);
      float xc = lo.x + (floor((px.x - lo.x) / cell) + 0.5) * cell;
      float fv = abs(lineVal(xc, d, lo.x, wd, halfH));
      float vline = hair(px.x - xc) * step(abs(px.y - mid), fv + w) * inPanel;
      cvr = max(cvr, vline * alpha);
      if (k == 0) { dist = abs(px.y - mid) - fv; }
    } else {
      float cell = max(wd / float(columns), 3.0 * U);
      float xc = lo.x + (floor((px.x - lo.x) / cell) + 0.5) * cell;
      float f0 = lineVal(xc, d, lo.x, wd, halfH);
      for (int s = 0; s < 2; s++) {
        if (s == 1 && !mirror) { break; }
        float sg = s == 0 ? 1.0 : -1.0;
        float dd = length(vec2(px.x - xc, px.y - (mid + sg * f0)));
        if (k == 0) { dist = min(dist, dd); }
        cvr = max(cvr, cov(dd - 1.7 * U * (1.0 + hit)) * alpha * inPanel);
      }
    }
  }

  float axis = hair(px.y - mid) * dashes(px.x, 8.0, 0.35) * inPanel * 0.55 * gridAmount;
  float tickT = abs(fract((px.x - lo.x) / (wd / 5.0) + 0.5) - 0.5) * (wd / 5.0);
  float minorT = abs(fract((px.x - lo.x) / (wd / 25.0) + 0.5) - 0.5) * (wd / 25.0);
  float rd = px.y - hi.y;
  float major = step(tickT, w * 0.6) * step(6.0 * U, rd) * step(rd, 22.0 * U);
  float minor = step(minorT, w * 0.6) * step(6.0 * U, rd) * step(rd, 12.0 * U);
  float baseRule = hair(px.y - hi.y - 6.0 * U) * step(lo.x, px.x) * step(px.x, hi.x);
  float ruler = max(max(major, minor * 0.8), baseRule) * gridAmount;

  float frame = boxLine(sp, lo, hi) * gridAmount;
  float brk = brackets(sp, lo - 12.0 * U, hi + 12.0 * U, 26.0 * U) * gridAmount;
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? 0.03 * res.x : 0.97 * res.x, (c & 2) == 0 ? 0.04 * res.y : 0.96 * res.y);
    plus = max(plus, plusAt(sp, centre, 8.0 * U));
  }

  vec3 ink = inkColor.rgb;
  vec3 acc = accentAt(t);
  vec3 col = stageBackground(vUv, ink, kickEnv(clk));
  col += acc * exp(-max(dist, 0.0) / max(glowRadius * res.y, 1.0)) * glow * 0.3 * inPanel;
  col = mix(col, ink, max(axis, ruler));
  col = mix(col, ink, cvr);
  col = mix(col, mix(ink, acc, hit), max(frame, brk));
  if (marks) { col = mix(col, ink, plus); }
  col = mix(col, ink, textInk());
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
