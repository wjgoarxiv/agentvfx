// label-bars main: the deck layout. A left column of outlined tab-box labels (artist, track, from the text
// layer; font display, style outline, box tab) over a four-cell level meter and a small
// starburst; a framed main panel holding 63 thin bars on a ruler baseline (major tick every 8 bars with
// numerals) with tip dots; a tall title top-right. The media window of the deck is the stage background:
// footage as one-tone halftone dots (bgMode 2) when there is an input. A strong onset thickens the bars
// and the emblem starburst for ~3 frames; a kick zooms the panel (both optional). All ink is hairline; a
// field colour (groundColor / inkColor presets) turns the whole deck acid, ultramarine or orange.
//@include stage.glsl
//@include hud.glsl

vec4 barAt(int i) { return texelFetch(barState, ivec2(clamp(i, 0, bandCount - 1), 0), 0); }

float starburst(vec2 p, float R, float spokes, float wpx) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float k = abs(fract(a / 6.2831853 * spokes) - 0.5) * 6.2831853 / spokes * r;
  return cov(k - wpx * 0.5) * step(R * 0.18, r) * step(r, R) + cov(r - R * 0.1);
}

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  vec4 clk = texelFetch(barState, ivec2(0, 1), 0);
  vec2 sp = vUv * res;
  vec2 px = stageUv(clk, vUv) * res;
  vec2 lo = vec2(0.24 * res.x, 0.12 * res.y);
  vec2 hi = vec2(0.97 * res.x, 0.78 * res.y);
  float W = hi.x - lo.x;
  float H = hi.y - lo.y;
  float n = float(bandCount);
  float span = introSpan();
  float pitch = W * 0.92 / n;
  float x0 = lo.x + W * 0.04;
  float baseY = lo.y + 0.12 * H;
  float extent = 0.8 * H * maxHeight * introK();
  float hitOn = step(0.5, hitEnv(clk, 0.1)) * step(0.5, clk.x);

  float fi = floor((px.x - x0) / pitch);
  int i = int(clamp(fi, 0.0, n - 1.0));
  float bc = x0 + (fi + 0.5) * pitch;
  bool inSpan = fi >= 0.0 && fi < n && abs(px.x / res.x - 0.5) * 2.0 < span * 0.95 + 0.001;
  vec4 bar = barAt(i);
  float hw = max(hudW() * 0.5, pitch * thickness * 0.5 * (1.0 + 0.5 * hitOn));
  float hP = bar.r * extent + floorHeight * U;
  float dy = px.y - baseY;
  float body = inSpan ? cov(abs(px.x - bc) - hw) * step(-0.5, dy) * cov(dy - hP) : 0.0;
  float tip = inSpan ? cov(length(vec2(px.x - bc, dy - hP - 4.0 * U)) - 1.5 * U) * step(0.012, bar.r) : 0.0;
  float cap = inSpan && bar.g * extent > hP + 8.0 * U ? cov(abs(dy - bar.g * extent - 6.0 * U) - 0.7 * U) * cov(abs(px.x - bc) - hw * 1.5) : 0.0;

  float baseLine = hair(dy) * step(x0, px.x) * step(px.x, x0 + pitch * n) * span;
  float tickX = abs(fract((px.x - x0) / pitch + 0.5) - 0.5) * pitch;
  float td = baseY - px.y;
  float major = mod(fi, 8.0) < 0.5 ? 1.0 : 0.0;
  float tick = inSpan && td > 3.0 * U && td < (3.0 + (major > 0.5 ? 14.0 : 6.0)) * U && tickX < hudW() * 0.5 ? 1.0 : 0.0;
  float gridH = 0.0;
  for (int r = 1; r <= 4; r++) {
    gridH = max(gridH, hair(px.y - (baseY + float(r) * extent / 4.0)));
  }
  gridH *= dashes(px.x, 8.0, 0.25) * inRect(px, vec2(x0, lo.y), vec2(x0 + pitch * n, hi.y)) * 0.45 * gridAmount;

  float frame = boxLine(sp, lo, hi) * gridAmount;
  float brk = brackets(sp, lo - 10.0 * U, hi + 10.0 * U, 24.0 * U) * gridAmount;

  // left column furniture: a four-cell level meter (low, low-mid, high-mid, high bands) and a framed sub-panel
  float icons = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 lo2 = vec2((0.03 + 0.04 * float(k)) * res.x, 0.62 * res.y);
    vec2 hi2 = lo2 + vec2(0.032 * res.x, 0.04 * res.y);
    float lvl = clamp(barAt(4 + k * 14).r, 0.0, 1.0);
    float fillTop = hi2.y - lvl * (hi2.y - lo2.y);
    icons = max(icons, max(boxLine(sp, lo2, hi2), inRect(sp, vec2(lo2.x + 3.0 * U, fillTop), hi2 - 3.0 * U)));
  }
  vec2 slo = vec2(0.03 * res.x, 0.4 * res.y);
  vec2 shi = vec2(0.19 * res.x, 0.58 * res.y);
  float sub = boxLine(sp, slo, shi) * gridAmount;
  float subTicks = 0.0;
  for (int r = 0; r < 12; r++) {
    float yr = slo.y + (float(r) + 0.5) * (shi.y - slo.y) / 12.0;
    float ln = (2.0 + 6.0 * hash12(vec2(float(r), 3.0))) * 0.012 * res.x * (0.4 + 0.6 * barAt(r * 5).r);
    subTicks = max(subTicks, hair(sp.y - yr) * step(slo.x + 6.0 * U, sp.x) * step(sp.x, slo.x + 6.0 * U + ln));
  }
  vec2 eblo = vec2(0.03 * res.x, 0.12 * res.y);
  vec2 ebhi = vec2(0.19 * res.x, 0.12 * res.y + 0.16 * res.x);
  float emblem = max(boxLine(sp, eblo, ebhi) * gridAmount, starburst(sp - (eblo + ebhi) * 0.5, 0.07 * res.x, 32.0, hudW() * (1.0 + hitOn)));
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? 0.015 * res.x : 0.985 * res.x, (c & 2) == 0 ? 0.04 * res.y : 0.96 * res.y);
    plus = max(plus, plusAt(sp, centre, 7.0 * U));
  }

  float mk = max(max(body, tip), max(cap, max(baseLine * 0.9, tick * 0.9)));
  mk = max(mk, max(gridH, max(frame, brk)));
  mk = max(mk, max(icons * gridAmount, max(sub, subTicks * 0.8)));
  mk = max(mk, max(emblem, plus * float(marks)));
  vec3 ink = inkColor.rgb;
  vec3 gnd = stageBackground(vUv, ink, kickEnv(clk));
  vec3 acc = accentAt((fi + 0.5) / n);
  vec3 col = mix(gnd, ink, mk);
  col = mix(col, acc, min(tip + cap, 1.0));
  col = mix(col, ink, textInk());
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
