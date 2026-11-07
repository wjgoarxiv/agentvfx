// Scene 20 (variant 0, rot 2), panel-grid: an ice-white sheet with a 6 x 4 grid of small square panels, each a thin-line instrument
// (plate isolines, spectrum comb, bass gauge, big number, starburst, waveform, checker, reticle). On every onset one panel (in turn)
// swings a quarter turn in three frames and shows its next instrument. Brick accents; Optima and SF Mono type. Palette: ground (ice),
// ink (black), accent (brick), tintA (grey). Text set 21: r the Optima caption, g the SF Mono caption.
vec2 pgPanel(int kind, vec2 p, vec2 ctr, vec4 clk) {
  float h = 0.1;
  vec2 pp = (p + h) * scU;
  float cell = scCell();
  if (kind == 0) {
    float l = scTone((ctr + p) * scU, (ctr - h) * scU, (ctr + h) * scU, 1.4, 0.05);
    return vec2(smoothstep(0.38, 0.46, abs(fract(l * 7.0) - 0.5)), 0.0);
  }
  if (kind == 1) {
    float i = floor((p.x + h) / (2.0 * h) * 12.0);
    float lv = bandAt((i + 0.5) / 12.0);
    float bar = step(abs(fract((p.x + h) / (2.0 * h) * 12.0) - 0.5), 0.3) * step(h - lv * 2.0 * h * 0.9, p.y + h) * step(p.y, h * 0.9);
    return vec2(bar * step(0.3, lv + 0.2), bar * step(0.7, lv));
  }
  if (kind == 2) {
    float r = length(p);
    float a = atan(p.x, -p.y);
    float na = -2.3 + 4.6 * stLevel().r;
    float needle = scLine(sdSeg(p, vec2(0.0), 0.075 * vec2(sin(na), -cos(na))), 1.5);
    float tk = step(abs(fract(a * 3.8197) - 0.5), 0.12) * step(0.065, r) * step(r, 0.085) * step(abs(a), 2.4);
    return vec2(max(scLine(r - 0.085, 1.0), tk), needle);
  }
  if (kind == 3) { return vec2(numTxt(pp, vec2(0.04, 0.07) * scU, cell * 2.0, mod(clk.x * 7.0, 100.0), 2), 0.0); }
  if (kind == 4) { return vec2(scBurst(p, 0.09, 0.012, 0.0, 24.0), scAA(length(p) - 0.01)); }
  if (kind == 5) {
    float y = waveI((p.x + h) / (2.0 * h) * 400.0) * scopeGain * 0.3;
    return vec2(scLine(p.y - y, 1.2) * step(abs(p.x), 0.09), scLine(p.y, 1.0) * 0.0);
  }
  if (kind == 6) {
    vec2 g = floor(p / 0.033);
    return vec2(step(1.0, mod(g.x + g.y, 2.0)) * step(abs(p.x), 0.09) * step(abs(p.y), 0.09), 0.0);
  }
  float rr = length(p);
  return vec2(max(max(scLine(rr - 0.05, 1.0), scLine(p.x, 1.0) * step(abs(p.y), 0.085)), scLine(p.y, 1.0) * step(abs(p.x), 0.085)), 0.0);
}

void scenePanelGrid(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 ink = inkColor.rgb;
  vec3 brick = accentColor.rgb;
  col = groundColor.rgb;
  vec2 o = vec2((A - 1.38) * 0.5, 0.04);
  vec2 g = (c - o) / 0.23;
  vec2 id = floor(g);
  if (id.x >= 0.0 && id.x < 6.0 && id.y >= 0.0 && id.y < 4.0) {
    vec2 ctr = o + (id + 0.5) * 0.23;
    vec2 p = c - ctr;
    float i = id.x + 6.0 * id.y;
    if (abs(p.x) < 0.105 && abs(p.y) < 0.105) {
      float mine = mod(clk.z, 24.0) == i ? 1.0 : 0.0;
      float age = float(FRAMEINDEX) - clk.w;
      float u = (mine > 0.5 && clk.z > 0.5) ? clamp((age + 1.0) / 3.0, 0.0, 1.0) : 1.0;
      float turns = floor((clk.z + 24.0 - i) / 24.0);
      float ang = (turns - (1.0 - u)) * 1.5708;
      float tcount = u < 0.5 ? turns - 1.0 : turns;
      int kind = int(floor(hash12(vec2(i, 3.3 + tcount)) * 8.0));
      vec2 pr = stRot(p, ang);
      vec2 res = pgPanel(kind, pr, ctr, clk);
      col = mix(col, tintA.rgb * 1.5, 0.0);
      col = mix(col, ink, res.x * step(abs(pr.x), 0.1) * step(abs(pr.y), 0.1));
      col = mix(col, brick, res.y);
    }
    col = mix(col, ink, scLine(sdBox(p, vec2(-0.105), vec2(0.105)), 1.0));
  }
  col = mix(col, brick, scAA(sdBox(c, vec2(0.0, 0.04), vec2(o.x - 0.04, 0.14))));
  col = mix(col, ink, scLine(c.x - (o.x - 0.02), 1.0) * step(0.2, c.y) * step(c.y, 0.96) * 0.7);
  col = mix(col, ink, scSheet(q, 0));
  col = mix(col, ink, scSheet(q, 1));
  col = mix(col, brick, scLine(c.y - 0.975, 2.0) * step(0.0, c.x) * step(c.x, A * (0.2 + 0.8 * stLevel().a)));
}
