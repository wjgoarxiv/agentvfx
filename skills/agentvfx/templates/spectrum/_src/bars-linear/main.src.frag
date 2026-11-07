// bars-linear main: a thin-line spectrum graph in a framed panel. Dashed row grid (rows 0..6 numbered
// at the left, row 6 is the baseline), dashed vertical lines at the frequency labels (20Hz 100Hz 250Hz
// 500Hz 1200Hz for the default 20..1200 Hz power-curve mapping), corner brackets, + marks, a scan
// cursor and boxed code rows. Labels are engine text (TEXTMASK). The curve is the pro-motion bar state
// (power-curve bins, peak-preserving smoothing, per-bar exponent, attack / release) drawn as a hairline
// polyline (displayMode 0), steps (1), tiny hairline bars (2) or dots (3), with peak-hold dots in the
// accent colour. A strong onset (hitFlux) flashes the frame in the accent colour for ~3 frames.
//@include stage.glsl
//@include hud.glsl

vec4 barAt(int i) { return texelFetch(barState, ivec2(clamp(i, 0, bandCount - 1), 0), 0); }

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  vec4 clk = texelFetch(barState, ivec2(0, 1), 0);
  vec2 sp = vUv * res;
  vec2 px = stageUv(clk, vUv) * res;
  vec2 lo = vec2(0.16 * res.x, 0.21 * res.y);
  vec2 hi = vec2(0.94 * res.x, 0.73 * res.y);
  float W = hi.x - lo.x;
  float H = hi.y - lo.y;
  float n = float(bandCount);
  float pitch = W / n;
  float span = introSpan();
  float grow = introK();
  float inX = step(lo.x, px.x) * step(px.x, hi.x);
  float t = (px.x - lo.x) / W;
  float seen = inX * step(abs(t - 0.5) * 2.0, span);
  float ext = H * 0.94 * grow;
  float floorPx = floorHeight * U;
  float w = hudW();

  float fi = t * n - 0.5;
  int i0 = int(floor(fi));
  float fr = fi - floor(fi);
  vec4 b0 = barAt(i0);
  vec4 b1 = barAt(i0 + 1);
  float hs = mix(b0.r, b1.r, fr);
  float yv = lo.y + hs * ext + floorPx;
  float slope = (b1.r - b0.r) * ext * n / W;
  float u = clamp(t, 0.0, 1.0);

  float curve = 0.0;
  float dist = 1.0e4;
  if (displayMode == 0) {
    dist = abs(px.y - yv) / sqrt(1.0 + slope * slope);
    curve = hair(dist);
  } else if (displayMode == 1) {
    int b = int(clamp(floor(t * n), 0.0, n - 1.0));
    float yb = lo.y + barAt(b).r * ext + floorPx;
    float yp = lo.y + barAt(b - 1).r * ext + floorPx;
    float xl = px.x - (lo.x + float(b) * pitch);
    dist = abs(px.y - yb);
    curve = max(hair(dist), hair(xl) * step(min(yb, yp) - w, px.y) * step(px.y, max(yb, yp) + w));
  } else if (displayMode == 2) {
    float bc = (floor(t * n) + 0.5) * pitch + lo.x;
    int b = int(clamp(floor(t * n), 0.0, n - 1.0));
    float yb = lo.y + barAt(b).r * ext + floorPx;
    dist = max(abs(px.x - bc) * 1.0, max(px.y - yb, lo.y - px.y));
    curve = hair(px.x - bc) * step(px.y, yb) * step(lo.y, px.y);
  } else {
    float bc = (floor(t * n) + 0.5) * pitch + lo.x;
    int b = int(clamp(floor(t * n), 0.0, n - 1.0));
    float yb = lo.y + barAt(b).r * ext + floorPx;
    dist = length(vec2(px.x - bc, px.y - yb));
    curve = cov(dist - 2.0 * U);
  }
  curve *= seen * step(lo.y - 1.0, px.y);

  int bc = int(clamp(floor(t * n), 0.0, n - 1.0));
  float capY = lo.y + barAt(bc).g * ext + floorPx;
  float capX = lo.x + (float(bc) + 0.5) * pitch;
  float capDot = cov(length(vec2(px.x - capX, px.y - capY)) - 1.7 * U) * seen * step(0.012, barAt(bc).g);

  float area = displayMode == 0 ? areaFill * 0.5 * step(px.y, yv) * step(lo.y, px.y) * step(0.5, fract(px.x / (4.0 * U))) * step(0.5, fract(px.y / (4.0 * U))) * seen : 0.0;

  float rows = 0.0;
  float ticks = 0.0;
  for (int r = 0; r <= 6; r++) {
    float yr = hi.y - float(r) * H / 6.0;
    float onRow = hair(sp.y - yr);
    rows = max(rows, onRow * inRect(sp, lo, hi) * dashes(sp.x, 7.0, 0.3));
    ticks = max(ticks, onRow * step(lo.x - 16.0 * U, sp.x) * step(sp.x, lo.x - 6.0 * U));
  }
  float cols = 0.0;
  for (int k = 0; k < 5; k++) {
    float tk = k == 0 ? 0.0 : (k == 1 ? 0.30 : (k == 2 ? 0.47 : (k == 3 ? 0.66 : 1.0)));
    float xk = lo.x + tk * W;
    cols = max(cols, hair(sp.x - xk) * inRect(sp, lo, hi) * dashes(sp.y, 7.0, 0.3));
  }

  float hit = step(0.5, hitEnv(clk, 0.1)) * step(0.5, clk.x);
  float frame = boxLine(sp, lo, hi);
  float brk = brackets(sp, lo - 9.0 * U, hi + 9.0 * U, 22.0 * U);
  float cursor = scanCursor ? hair(px.x - (lo.x + fract(TIME * 0.5) * W)) * inRect(px, lo, hi) * 0.55 * seen : 0.0;
  float glowTerm = glow > 0.0 ? exp(-dist / max(glowRadius * res.y, 1.0)) * glow * seen : 0.0;

  vec3 ink = inkColor.rgb;
  vec3 acc = accentAt(u);
  vec3 col = stageBackground(vUv, ink, kickEnv(clk));
  col = mix(col, ink, max(rows, cols) * 0.5 * span * gridAmount);
  col = mix(col, ink, max(ticks, cursor) * span * gridAmount);
  col = mix(col, ink, area * 0.8);
  col += acc * glowTerm * 0.4;
  col = mix(col, ink, curve);
  col = mix(col, acc, capDot);
  col = mix(col, mix(ink, acc, hit), max(frame, brk) * gridAmount);
  if (marks) { col = mix(col, ink, hudChrome(sp)); }
  col = mix(col, ink, textInk());
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
