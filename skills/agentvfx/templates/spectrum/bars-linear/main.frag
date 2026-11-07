// bars-linear main: a thin-line spectrum graph in a framed panel. Dashed row grid (rows 0..6 numbered
// at the left, row 6 is the baseline), dashed vertical lines at the frequency labels (20Hz 100Hz 250Hz
// 500Hz 1200Hz for the default 20..1200 Hz power-curve mapping), corner brackets, + marks, a scan
// cursor and boxed code rows. Labels are engine text (TEXTMASK). The curve is the pro-motion bar state
// (power-curve bins, peak-preserving smoothing, per-bar exponent, attack / release) drawn as a hairline
// polyline (displayMode 0), steps (1), tiny hairline bars (2) or dots (3), with peak-hold dots in the
// accent colour. A strong onset (hitFlux) flashes the frame in the accent colour for ~3 frames.
// ---- stage (shared by the spectrum family) ----
// Camera: bass onsets (bass ratio >= kickBass) zoom the frame by kickZoom and shake it by up to `shake`
// pixels at 1080p, both decaying over kickDecayMs (both 0 by default: the HUD look is locked down).
// Background: the flat groundColor; with an input, bgMode 1 = blurred and dimmed footage, 2 = single-tone
// halftone dots of the footage in the ink colour (dot radius follows luminance). Optional field of
// drifting flecks (fieldAmount), vignette and film grain. The clock texel is (hit count, last hit frame,
// kick count, last kick frame), written by the template's state pass.
float stageSince(float count, float last) { return count > 0.5 ? (float(FRAMEINDEX) - last) * TIMEDELTA : 99.0; }
float kickEnv(vec4 clk) { return exp(-stageSince(clk.z, clk.w) / max(kickDecayMs * 0.001, 0.001)); }
float hitEnv(vec4 clk, float seconds) { return exp(-stageSince(clk.x, clk.y) / seconds); }

vec2 stageUv(vec4 clk, vec2 uv) {
  float ke = kickEnv(clk);
  vec2 sh = (hash22(vec2(clk.z, 3.7)) - 0.5) * 2.0 * shake * ke * (RENDERSIZE.y / 1080.0) / RENDERSIZE;
  return (uv - 0.5) / (1.0 + kickZoom * ke) + 0.5 + sh;
}

float introK() { return introMs > 0.5 ? smoothstep(introMs * 0.0005, introMs * 0.0012, TIME) : 1.0; }
float introSpan() { return introMs > 0.5 ? smoothstep(0.0, introMs * 0.0006, TIME) : 1.0; }

float stageField(vec2 uv, float lift) {
  float aspect = RENDERSIZE.x / RENDERSIZE.y;
  float acc = 0.0;
  for (int l = 0; l < 2; l++) {
    float fl = float(l);
    float sc = l == 0 ? 11.0 : 34.0;
    vec2 p = vec2(uv.x * aspect, uv.y) * sc - vec2(TIME * fieldSpeed * (0.35 + 0.3 * fl), -TIME * fieldSpeed * (0.05 + 0.04 * fl));
    vec2 c = floor(p);
    vec2 fr = fract(p);
    vec2 h = hash22(c + fl * 17.0);
    float h2 = hash12(c + 31.0 + fl * 5.0);
    float r = (l == 0 ? 0.05 : 0.035) * (0.5 + 0.7 * h2);
    float tw = 0.55 + 0.45 * sin(TIME * (1.0 + 3.0 * h2) + h.x * 6.2832);
    acc += step(length(fr - (0.3 + 0.4 * h)), r) * tw * step(0.45, h2);
  }
  return acc * (0.7 + 0.6 * lift);
}

float stageHalftone(vec2 uv) {
  float u = RENDERSIZE.y / 1080.0;
  float cell = max(halftoneSize * u, 2.0);
  mat2 m = mat2(0.9659, 0.2588, -0.2588, 0.9659);
  vec2 g = m * (uv * RENDERSIZE) / cell;
  vec2 f = fract(g) - 0.5;
  vec2 centre = (transpose(m) * ((floor(g) + 0.5) * cell)) / RENDERSIZE;
  float L = luma(texture(inputImage, centre).rgb);
  float rad = 0.62 * sqrt(clamp(L * 1.25, 0.0, 1.0));
  return clamp((rad - length(f)) * cell + 0.5, 0.0, 1.0);
}

vec3 stageBackground(vec2 uv, vec3 tint, float lift) {
  float aspect = RENDERSIZE.x / RENDERSIZE.y;
  vec3 g = groundColor.rgb;
  if (HAS_INPUT && bgMode == 1) {
    vec3 s = texture(inputImage, uv).rgb;
    float rad = 0.018;
    for (int k = 0; k < 12; k++) {
      float a = float(k) * 0.5236;
      s += texture(inputImage, uv + vec2(cos(a) / aspect, sin(a)) * rad * (k % 2 == 0 ? 1.0 : 0.5)).rgb;
    }
    g = mix(g, s / 13.0, bgDim);
  } else if (HAS_INPUT && bgMode == 2) {
    g = mix(g, inkColor.rgb, stageHalftone(uv) * bgDim);
  }
  return g + tint * stageField(uv, lift) * fieldAmount;
}

vec3 stageFinish(vec3 col, vec2 uv) {
  float aspect = RENDERSIZE.x / RENDERSIZE.y;
  float v = length((uv - 0.5) * vec2(aspect, 1.0)) / (0.5 * sqrt(aspect * aspect + 1.0));
  col *= 1.0 - vignette * smoothstep(0.35, 1.0, v);
  float n = hash12(gl_FragCoord.xy + float(FRAMEINDEX) * 13.37) - 0.5;
  return max(col + n * grain, vec3(0.0));
}
// ---- HUD line language (shared by the spectrum family) ----
// Ground and ink: near-black ground with off-white hairlines by default, or one full colour field with
// black / white ink (groundColor, inkColor, accentColor). Everything is drawn as 1-2 px hairlines
// (lineWidth, in pixels at 1080p): framed panels, dashed grids, corner brackets, + crosshairs, tick
// rulers. Labels come from the engine text layer (TEXTMASK: R = ink, G = box fill).
float hudU() { return RENDERSIZE.y / 1080.0; }
float hudW() { return max(lineWidth * hudU(), 1.0); }
float hair(float d) { return clamp(hudW() * 0.5 - abs(d) + 0.5, 0.0, 1.0); }
float cov(float d) { return clamp(0.5 - d, 0.0, 1.0); }
float dashes(float x, float period, float duty) { return step(fract(x / (period * hudU())), duty); }

// outline of the rectangle lo..hi (pixels)
float boxLine(vec2 p, vec2 lo, vec2 hi) {
  vec2 q = abs(p - (lo + hi) * 0.5) - (hi - lo) * 0.5;
  return hair(max(q.x, q.y));
}
float inRect(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }

// + crosshair centred on c with arm length len
float plusAt(vec2 p, vec2 c, float len) {
  vec2 q = abs(p - c);
  return max(hair(q.y) * step(q.x, len), hair(q.x) * step(q.y, len));
}

// four L-shaped corner brackets of the rectangle lo..hi, arm length len
float brackets(vec2 p, vec2 lo, vec2 hi, float len) {
  vec2 c = (lo + hi) * 0.5;
  vec2 q = abs(p - c);
  vec2 h = (hi - lo) * 0.5;
  float onV = hair(q.x - h.x) * step(h.y - len, q.y) * step(q.y, h.y + 0.5);
  float onH = hair(q.y - h.y) * step(h.x - len, q.x) * step(q.x, h.x + 0.5);
  return max(onV, onH);
}

vec3 accentAt(float u) { return colorMode == 1 ? paletteCycle(u + paletteShift) : accentColor.rgb; }

float textInk() { return HAS_TEXT ? texture(TEXTMASK, vUv).r : 0.0; }
float textFill() { return HAS_TEXT ? texture(TEXTMASK, vUv).g : 0.0; }

// frame chrome common to every instrument: corner + marks and an inset hairline frame
float hudChrome(vec2 sp) {
  vec2 res = RENDERSIZE;
  float u = hudU();
  float a = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? 22.0 * u : res.x - 22.0 * u, (c & 2) == 0 ? 22.0 * u : res.y - 22.0 * u);
    a = max(a, plusAt(sp, centre, 7.0 * u));
  }
  return a;
}
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
