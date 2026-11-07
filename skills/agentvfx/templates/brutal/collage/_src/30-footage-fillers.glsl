// footage: cover-fit into the cell below `top` (the tile header height, 0 for editorial cells), contrast curve,
// optional single-tone mix, saturation and dim, scanlines. Variants 1..4 lay a dark scrim over it (bottom, top,
// left, vignette, bottom plus vignette) so type reads on top. Without an input the cell shows a crossed empty-media mark.
vec3 footageBody(vec2 q, vec2 S, float top, int variant) {
  vec2 lo = vec2(0.0, top);
  vec2 sz = S - lo;
  vec2 d = (q - (lo + S) * 0.5) / sz;
  vec2 tex = IMG_SIZE(inputImage);
  float ta = tex.x / tex.y;
  float wa = sz.x / sz.y;
  vec2 vis = wa > ta ? vec2(1.0, ta / wa) : vec2(wa / ta, 1.0);
  vec3 c = texture(inputImage, vec2(0.5 + d.x * vis.x, 0.5 - d.y * vis.y)).rgb;
  c = max((c - 0.18) * footageContrast + 0.18, 0.0);
  vec3 duo = mix(groundColor.rgb, inkColor.rgb, smoothstep(0.02, 0.6, luma(c)));
  c = mix(c, duo, footageTone);
  c = mix(vec3(luma(c)), c, footageSat) * (1.0 - footageDim);
  vec2 u = (q - lo) / sz;
  float scrim = 1.0;
  if (variant == 1) { scrim = smoothstep(0.32, 1.0, u.y); }
  if (variant == 2) { scrim = smoothstep(0.68, 0.0, u.y); }
  if (variant == 3) { scrim = smoothstep(0.7, 0.0, u.x); }
  if (variant == 4) { scrim = smoothstep(0.35, 1.0, length((u - 0.5) * vec2(1.0, 1.15)) * 1.6); }
  if (variant == 5) { scrim = max(smoothstep(0.3, 0.95, u.y), smoothstep(0.3, 1.0, length((u - 0.5) * vec2(1.0, 1.25)) * 1.5) * 0.85); }
  if (variant == 6) { scrim = 0.93; }
  if (variant == 7) { scrim = 0.55; }
  c *= mix(1.0, 0.1, scrim * step(0.5, float(variant)));
  return c * (1.0 - footageScan * step(0.5, fract(q.y / (3.0 * U))));
}

float hatch(vec2 q, float pitch) { return hl(mod(q.x + q.y, pitch * U) - pitch * 0.5 * U); }

// fillers: 7 = ruler or pixel cluster, 8 = accent plate with the cut number or hatching, 9 = sparse hatch
vec3 pFiller(int role, vec2 q, vec2 S, float hs, vec4 clk) {
  float pad = 10.0 * U;
  float top = HEAD * U;
  bool wide = S.x >= S.y;
  if (role == 7 && hs < 0.5) {
    float along = wide ? q.x : S.y - q.y;
    float across = wide ? S.y - q.y : q.x;
    float k = floor(along / (8.0 * U) + 0.5);
    float len = (mod(k, 5.0) < 0.5 ? 14.0 : 6.0) * U;
    float tk = step(abs(along - k * 8.0 * U), HW * 0.5 + 0.5) * step(across, len) * step(top, q.y) * step(pad * 0.5, along);
    float base = hl(across) * step(top, q.y);
    float c = cellPx(2.0 * U);
    float mj = floor((along - 3.0 * U) / (40.0 * U));
    vec2 o = wide ? vec2(mj * 40.0 * U + 3.0 * U, S.y - 18.0 * U - 5.0 * c) : vec2(18.0 * U, S.y - (mj * 40.0 * U + 3.0 * U) - 5.0 * c);
    float nTxt = mj >= 0.0 ? numTxt(q, o, c, mod(mj, 100.0), 2) * step(top + 3.0 * U, q.y) : 0.0;
    return vec3(max(max(tk, base) * 0.8, nTxt), 0.0, 0.0);
  }
  if (role == 7) {
    vec2 g = (q - vec2(pad, top + pad)) / (11.0 * U);
    vec2 id = floor(g + 0.5);
    float lit = step(0.72, fract(sin(dot(id + clk.x * 1.7, vec2(12.9898, 78.233))) * 43758.5453));
    float dotc = cov(length((g - id) * 11.0 * U) - (1.2 + 1.3 * lit) * U) * inBox(q, vec2(pad, top + pad), S - vec2(pad));
    return vec3(dotc * (1.0 - lit) * 0.7, dotc * lit, 0.0);
  }
  if (role == 8 && hs < 0.6 && plateAmount > 0.5) {
    float cn = cellPx(min(S.x * 0.78 / 11.0, S.y * 0.5 / 5.0));
    vec2 o = vec2(pad, S.y - pad - 5.0 * cn);
    return vec3(0.0, 1.0, numTxt(q, o, cn, mod(clk.x, 1000.0), 3));
  }
  float hp = role == 8 ? 9.0 : 16.0;
  float amt = role == 8 ? 0.5 : 0.28;
  float h = hatch(q, hp) * step(top, q.y) * amt;
  float cr = role == 9 ? plusAt(q, (vec2(0.0, top) + S) * 0.5, min(S.x, S.y) * 0.12) : 0.0;
  return vec3(max(h, cr), 0.0, 0.0);
}

// header strip: frame, rule under the label, role tag, and the cut number (or timecode for the footage panel)
vec3 panelHead(int role, float hs, vec2 q, vec2 S, vec4 clk, float snap) {
  float w = snap > 0.5 ? HW * 3.0 : HW;
  float frame = boxLnW(q, vec2(0.0), S, w);
  float rule = hl(q.y - HEAD * U) * step(0.0, q.x) * step(q.x, S.x);
  float c = cellPx(2.5 * U);
  vec2 o = vec2(8.0 * U, (HEAD * U - 5.0 * c) * 0.5);
  float tag = role == 1 ? txt4(q, o, c, 83, 82, 67, 0) : (role == 2 ? txt4(q, o, c, 70, 70, 84, 0) : (role == 3 ? txt4(q, o, c, 79, 83, 67, 0)
    : (role == 4 ? txt4(q, o, c, 76, 86, 76, 0) : (role == 5 ? txt4(q, o, c, 78, 85, 77, 0) : (role == 6 ? txt4(q, o, c, 88, 72, 82, 0)
    : (role == 7 ? (hs < 0.5 ? txt4(q, o, c, 82, 85, 76, 0) : txt4(q, o, c, 80, 73, 88, 0)) : txt4(q, o, c, 72, 67, 72, 0)))))));
  float right = 0.0;
  if (role == 1) {
    float tc = TIME;
    float x0 = S.x - 8.0 * U - 31.0 * c;
    vec2 p = vec2(x0, o.y);
    right = numTxt(q, p, c, floor(tc / 60.0), 2) + glyphAt(q - p - vec2(8.0 * c, 0.0), 58, c)
          + numTxt(q, p + vec2(12.0 * c, 0.0), c, mod(floor(tc), 60.0), 2) + glyphAt(q - p - vec2(20.0 * c, 0.0), 58, c)
          + numTxt(q, p + vec2(24.0 * c, 0.0), c, mod(float(FRAMEINDEX), 30.0), 2);
  } else {
    right = numTxt(q, vec2(S.x - 8.0 * U - numW(3, c), o.y), c, mod(clk.x, 1000.0), 3);
  }
  float ink = max(max(frame, rule * (role == 8 ? 0.0 : 1.0)), max(tag, min(right, 1.0)));
  return vec3(ink, snap > 0.5 ? frame : 0.0, 0.0);
}
