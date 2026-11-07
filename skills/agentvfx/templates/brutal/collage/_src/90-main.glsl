vec3 panelBody(int role, vec2 q, vec2 S, float hs, vec4 clk) {
  if (role == 1) { return vec3(0.0); }
  if (role == 2) { return pSpectrum(q, S); }
  if (role == 3) { return pScope(q, S); }
  if (role == 4) { return pMeter(q, S); }
  if (role == 5) { return pReadout(q, S, clk); }
  if (role == 6) { return pCross(q, S, clk); }
  return pFiller(role, q, S, hs, clk);
}

// the old boxed panel (frame "tile"): gutter inset, opaque ground, header strip, hairline frame
void drawTile(int role, float hs, vec2 q, vec2 S, vec4 clk, float snap, inout vec3 col) {
  vec3 cov3 = vec3(0.0);
  bool plate = role == 8 && hs < 0.6 && plateAmount > 0.5;
  col = groundColor.rgb;
  if (role == 1 && q.y > HEAD * U && HAS_INPUT) { col = footageBody(q, S, HEAD * U, 0); }
  if (role == 1 && !HAS_INPUT) {
    vec2 dd = (q - vec2(0.0, HEAD * U));
    vec2 body = S - vec2(0.0, HEAD * U);
    cov3.x = max(hl((dd.x * body.y - dd.y * body.x) / length(body)), hl((dd.x * body.y - (body.y - dd.y) * body.x) / length(body))) * 0.35 * step(0.0, dd.y);
  }
  cov3 = max(cov3, panelBody(role, q, S, hs, clk));
  if (plate) {
    cov3.x = 0.0;
    cov3.y = 1.0;
    cov3.z = panelBody(role, q, S, hs, clk).z;
  } else {
    vec3 head = panelHead(role, hs, q, S, clk, snap);
    cov3.x = max(cov3.x, head.x);
    cov3.y = max(cov3.y, head.y);
  }
  col = mix(col, inkColor.rgb, cov3.x);
  col = mix(col, accentColor.rgb, cov3.y);
  col = mix(col, groundColor.rgb, cov3.z);
}

// an editorial cell: optional solid fill, then the role drawn straight onto what is below it, then the frame
void drawEditorial(int role, vec4 sty, vec4 aux, int ch, vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  int v = int(sty.x + 0.5);
  int tone = int(sty.w + 0.5);
  int fill = int(sty.z + 0.5);
  vec3 cInk = tone == 1 ? groundColor.rgb : (tone == 2 ? accentColor.rgb : inkColor.rgb);
  vec3 cHot = tone == 2 ? inkColor.rgb : accentColor.rgb;
  if (fill == 1) { col = groundColor.rgb; }
  if (fill == 2) { col = inkColor.rgb; }
  if (fill == 3) { col = accentColor.rgb; }
  vec3 cov = vec3(0.0);
  if (role == 1) {
    if (HAS_INPUT) { col = footageBody(q, S, 0.0, v); }
    else { cov.x = max(hl((q.x * S.y - q.y * S.x) / length(S)), hl((q.x * S.y - (S.y - q.y) * S.x) / length(S))) * 0.35; }
  }
  if (role == 2) { cov = v == 0 ? pSpectrum(q, S) : pSpecHair(q, S, v); }
  if (role == 3) { cov = v == 0 ? pScope(q, S) : pScopeLine(q, S, v); }
  if (role == 4) { cov = v == 0 ? pMeter(q, S) : pMeterEd(q, S); }
  if (role == 5) { cov = v == 0 ? pReadout(q, S, clk) : pReadEd(q, S, v, clk); }
  if (role == 6) { cov = v == 0 ? pCross(q, S, clk) : pRegMark(q, S, clk); }
  if (role >= 7 && role <= 9) { cov = pFiller(role, q, S, role == 9 ? 0.5 : 0.0, clk); }
  if (role == 11) { cov = pType(q, S, v, int(aux.x + 0.5), vec3(aux.yz, aux.w), ch, clk); }
  if (role == 12) { cov = pRule(q, S, v); }
  if (role == 13) { drawTypeFx(v, aux, ch, tone, q, S, clk, cInk, cHot, col); }
  if (role == 14) { drawScene(v + 10 * int(aux.x + 0.5), q, S, clk, col); }
  cov.x = max(cov.x, frameCov(int(sty.y + 0.5), q, S));
  col = mix(col, cInk, cov.x);
  col = mix(col, cHot, cov.y);
}

void main() {
  vec2 res = RENDERSIZE;
  U = res.y / 1080.0;
  HW = max(lineWidth * U, 1.0);
  vec2 P = vec2(vUv.x, 1.0 - vUv.y) * res;
  gP = P;
  if (sheetDebug) {
    vec2 cellPx = res / vec2(32.0, 18.0);
    vec2 gd = (fract(P / cellPx + 0.5) - 0.5) * cellPx;
    vec3 c = mix(groundColor.rgb, inkColor.rgb, max(hl(gd.x), hl(gd.y)) * 0.18);
    vec3 tm = texture(TEXTMASK, vUv).rgb;
    if (soloPanel > 0) { tm *= vec3(soloPanel == 1 ? 1.0 : 0.0, soloPanel == 2 ? 1.0 : 0.0, soloPanel == 3 ? 1.0 : 0.0); }
    c = mix(c, inkColor.rgb, tm.r);
    c = mix(c, accentColor.rgb, tm.g * 0.8);
    c = mix(c, vec3(0.25, 0.55, 1.0), tm.b * 0.8);
    fragColor = vec4(c, 1.0);
    return;
  }
  float m = margin * U;
  vec2 un = (res - 2.0 * m) / vec2(32.0, 18.0);
  UN = un;
  vec2 g = (P - vec2(m)) / un;
  vec4 clk = stClock();
  float snap = (layoutMode == 1 && construction && clk.x > 0.5 && float(FRAMEINDEX) - clk.y < 2.0) ? 1.0 : 0.0;
  float gut = gutter * U * 0.5;

  vec3 col = groundColor.rgb;
  float bg = cov(length((fract(g + 0.5) - 0.5) * un) - 1.1 * U) * gridDots * 0.45;
  for (int k = 0; k < MAXL; k++) {
    vec4 r = texelFetch(state, ivec2(k, 3), 0);
    if (r.z < 0.5 || texelFetch(state, ivec2(k, 5), 0).y > 0.5) { continue; }
    for (int c = 0; c < 4; c++) {
      vec2 corner = vec2(m) + vec2((c & 1) == 0 ? r.x : r.z, (c & 2) == 0 ? r.y : r.w) * un;
      bg = max(bg, plusAt(P, corner, 6.0 * U));
    }
  }
  col = mix(col, inkColor.rgb, bg);
  for (int k = 0; k < MAXL; k++) {
    vec4 r = texelFetch(state, ivec2(k, 3), 0);
    if (r.z < 0.5) { continue; }
    vec4 meta = texelFetch(state, ivec2(k, 4), 0);
    vec4 sty = texelFetch(state, ivec2(k, 5), 0);
    bool tile = sty.y < 0.5;
    vec2 plo = vec2(m) + r.xy * un + (tile ? vec2(gut) : vec2(0.0));
    vec2 S = vec2(m) + r.zw * un - (tile ? vec2(gut) : vec2(0.0)) - plo;
    vec2 q = P - plo;
    if (q.x < 0.0 || q.y < 0.0 || q.x > S.x || q.y > S.y) { continue; }
    int role = int(meta.x + 0.5);
    if (tile) { drawTile(role, meta.y, q, S, clk, snap, col); }
    else { drawEditorial(role, sty, texelFetch(state, ivec2(k, 6), 0), int(meta.y + 0.5), q, S, clk, col); }
  }
  float n = hash12(gl_FragCoord.xy + float(FRAMEINDEX) * 13.37) - 0.5;
  fragColor = vec4(max(col + n * grain, vec3(0.0)), 1.0);
}
