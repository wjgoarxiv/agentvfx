// bars-mirror main: the full-frame FIELD version. One saturated field colour (acid lime / ultramarine /
// signal orange / phosphor green on black) with black or white ink: a four-way mirrored spectrum of tiny
// hairline bars growing up and down from a centre slit (low frequencies meet in the middle), tip dots,
// a dashed centre axis with a tick ruler and numerals, an inset frame with corner brackets and + marks,
// and engine-text labels. mirrorMode 0 = four-way, 1 = full-width mirrored top / bottom, 2 = centre-out
// growing up from the floor. A strong onset (hitFlux) swaps field and ink for ~3 frames: the hard cut.
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
