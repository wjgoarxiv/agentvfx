// bars-mirror main: the full-frame FIELD version. One saturated field colour (acid lime / ultramarine /
// signal orange / phosphor green on black) with black or white ink: a four-way mirrored spectrum of tiny
// hairline bars growing up and down from a centre slit (low frequencies meet in the middle), tip dots,
// a dashed centre axis with a tick ruler and numerals, an inset frame with corner brackets and + marks,
// and engine-text labels. mirrorMode 0 = four-way, 1 = full-width mirrored top / bottom, 2 = centre-out
// growing up from the floor. A strong onset (hitFlux) swaps field and ink for ~3 frames: the hard cut.
//@include stage.glsl
//@include hud.glsl

vec4 barAt(int i) { return texelFetch(barState, ivec2(clamp(i, 0, bandCount - 1), 0), 0); }

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  vec4 clk = texelFetch(barState, ivec2(0, 1), 0);
  vec2 sp = vUv * res;
  vec2 uv = stageUv(clk, vUv);
  vec2 px = uv * res;
  float n = float(bandCount);
  float cx = res.x * 0.5;
  float halfW = res.x * 0.42;
  float pitch = mirrorMode == 1 ? res.x * 0.84 / n : halfW / n;
  float coordX = mirrorMode == 1 ? px.x - res.x * 0.08 : abs(px.x - cx) - centreGap * res.x;
  float fi = floor(coordX / pitch);
  int i = int(clamp(fi, 0.0, n - 1.0));
  float span = introSpan();
  bool inSpan = fi >= 0.0 && fi < n && abs(uv.x - 0.5) * 2.0 < span * 0.86 + 0.001;
  float lx = coordX - (fi + 0.5) * pitch;
  float hwBar = max(hudW() * 0.5, pitch * thickness * 0.5);
  float baseY = mirrorMode == 2 ? 0.1 * res.y : 0.5 * res.y;
  float dy = mirrorMode == 2 ? px.y - baseY : abs(px.y - baseY) - 1.5 * U;
  float extent = res.y * (mirrorMode == 2 ? 0.74 : 0.36) * maxHeight * introK();
  vec4 bar = barAt(i);
  float hj = bar.r * extent + floorHeight * U;
  float body = inSpan ? cov(abs(lx) - hwBar) * step(-0.5, dy) * cov(dy - hj) : 0.0;
  float tipY = hj + 3.5 * U;
  float tip = inSpan && tipDots ? cov(length(vec2(lx, dy - tipY)) - 1.5 * U) * step(0.012, bar.r) : 0.0;
  float capY = bar.g * extent + 6.0 * U;
  float cap = inSpan && bar.g * extent > hj + 8.0 * U ? cov(abs(dy - capY) - 0.7 * U) * cov(abs(lx) - hwBar * 1.8) : 0.0;

  float axis = mirrorMode == 2 ? 0.0 : hair(px.y - baseY) * dashes(px.x, 10.0, 0.5) * step(abs(uv.x - 0.5) * 2.0, span * 0.92);
  float tickX = abs(fract(coordX / (pitch * 4.0) + 0.5) - 0.5) * pitch * 4.0;
  float tl = (mod(fi, 16.0) < 0.5 ? 14.0 : 6.0) * U;
  float rd = mirrorMode == 2 ? 14.0 * U - px.y : abs(px.y - baseY) - extent * 1.06 - 6.0 * U;
  float rtick = inSpan && rd > 0.0 && rd < tl && tickX < hudW() * 0.6 ? 1.0 : 0.0;

  float rowsG = 0.0;
  for (int r = 1; r <= 3; r++) {
    float yr = baseY + float(r) * extent / 3.0;
    float yr2 = baseY - float(r) * extent / 3.0;
    rowsG = max(rowsG, max(hair(px.y - yr), mirrorMode == 2 ? 0.0 : hair(px.y - yr2)));
  }
  rowsG *= dashes(px.x, 8.0, 0.25) * step(abs(uv.x - 0.5) * 2.0, span * 0.92) * 0.55;

  vec2 flo = vec2(0.035 * res.x, 0.05 * res.y);
  vec2 fhi = vec2(0.965 * res.x, 0.95 * res.y);
  float frame = boxLine(sp, flo, fhi) * 0.8 + brackets(sp, flo - 8.0 * U, fhi + 8.0 * U, 26.0 * U);
  vec2 qc = abs(sp - res * 0.5);
  float plus = max(hair(qc.y) * step(qc.x, 12.0 * U), hair(qc.x) * step(qc.y, 12.0 * U));

  float m = max(max(body, tip), max(cap, max(axis * 0.9, rtick * 0.9)));
  m = max(m, rowsG * gridAmount);
  m = max(m, max(frame * gridAmount, plus * float(marks)));
  m = max(m, textInk());
  vec3 gnd = stageBackground(vUv, inkColor.rgb, kickEnv(clk));
  float hit = step(0.5, hitEnv(clk, max(flashDecayMs * 0.001, 0.001))) * step(0.5, clk.x) * invertHit;
  vec3 ink = inkColor.rgb;
  vec3 straight = mix(gnd, mix(ink, accentAt((fi + 0.5) / n), min(cap + tip, 1.0)), m);
  vec3 swapped = mix(ink, gnd, m);
  vec3 col = mix(straight, swapped, hit);
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
