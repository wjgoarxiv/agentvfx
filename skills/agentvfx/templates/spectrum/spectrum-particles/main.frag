// spectrum-particles main: the particle-cloud box. A framed panel with corner brackets and a 0..5 ruler
// down the left edge; along its floor a hairline spectrum (one tick per bar, tip dot, peak dot). On every
// hit (an onset at or above hitFlux) a burst of dots launches from the bar tips of that instant with
// speed scaled by the hit's spectral flux; dots are clipped to the panel. Each of the last 8 hits owns a
// slot in partState and its particles are evaluated in closed form:
//   position = tip + v (1 - exp(-drag t)) / drag + (0, -gravity t^2 / 2)
// with hashed launch angle, speed and size, so a frame needs no simulation. Shapes: 0 square, 1 circle,
// 2 cross. Dots are ink-coloured (one tone), accent for the freshest ones; optional glow halo.
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
float shapeCover(vec2 d, float s) {
  if (sparkShape == 1) { return cov(length(d) - s); }
  if (sparkShape == 2) {
    vec2 a = abs(d);
    return max(cov(a.x - s * 0.18) * step(a.y, s), cov(a.y - s * 0.18) * step(a.x, s));
  }
  return cov(max(abs(d.x), abs(d.y)) - s);
}

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  vec4 clk = texelFetch(partState, ivec2(0, 9), 0);
  vec2 sp = vUv * res;
  vec2 px = stageUv(clk, vUv) * res;
  vec2 lo = vec2(0.14 * res.x, 0.12 * res.y);
  vec2 hi = vec2(0.94 * res.x, 0.84 * res.y);
  float W = hi.x - lo.x;
  float H = hi.y - lo.y;
  float n = float(bandCount);
  float span = introSpan();
  float grow = introK();
  float baseY = lo.y + 0.08 * H;
  float extent = 0.5 * H * grow;
  float pitch = W * 0.94 / n;
  float x0 = lo.x + W * 0.03;
  float inP = inRect(px, lo, hi);

  float fb = floor((px.x - x0) / pitch);
  float spec = 0.0;
  float tipD = 0.0;
  float capD = 0.0;
  if (fb >= 0.0 && fb < n && abs(px.x / res.x - 0.5) * 2.0 < span * 0.9 + 0.001) {
    vec4 st = texelFetch(partState, ivec2(int(fb), 8), 0);
    float bc = x0 + (fb + 0.5) * pitch;
    float hP = st.r * extent;
    spec = hair(px.x - bc) * step(baseY, px.y) * step(px.y, baseY + hP * 0.45) * barDim;
    tipD = cov(length(vec2(px.x - bc, px.y - baseY - hP * 0.45 - 3.0 * U)) - 1.4 * U) * step(0.012, st.r) * barDim;
    capD = cov(length(vec2(px.x - bc, px.y - baseY - st.g * extent * 0.45 - 6.0 * U)) - 1.2 * U) * step(0.03, st.g);
  }
  float floorLine = hair(px.y - baseY) * step(x0, px.x) * step(px.x, x0 + pitch * n) * span;

  float aspect = res.x / res.y;
  vec2 pp = vec2((px.x - lo.x) / H * 1.0, (px.y - lo.y) / H);
  float cloud = 0.0;
  float fresh = 0.0;
  float glowSum = 0.0;
  for (int j = 0; j < 8; j++) {
    vec4 meta = texelFetch(partState, ivec2(96, j), 0);
    float age = (float(FRAMEINDEX) - meta.x) * TIMEDELTA;
    if (meta.z < 0.5 || age < 0.0 || age > lifeSec) { continue; }
    float life01 = age / lifeSec;
    for (int p = 0; p < 64; p++) {
      if (p >= particleCount) { break; }
      vec2 h = hash22(vec2(float(p) * 1.618 + 3.0, meta.x * 0.731 + float(j)));
      vec2 h2 = hash22(vec2(meta.x * 1.31 + 7.0, float(p) * 2.17 + 1.0));
      int b = int(floor(h.x * n));
      float hb = texelFetch(partState, ivec2(b, j), 0).r;
      if (hb < 0.1) { continue; }
      vec2 o = vec2((x0 - lo.x + pitch * (float(b) + h.y)) / H, (baseY - lo.y + hb * extent * 0.45) / H);
      float ang = 1.5707963 + (h2.x - 0.5) * spread;
      float spd = speed * meta.y * (0.35 + 0.65 * h2.y) * (0.5 + hb);
      vec2 v = spd * vec2(cos(ang), sin(ang));
      vec2 pos = o + v * (1.0 - exp(-drag * age)) / drag + vec2(0.0, -0.5 * gravity * age * age);
      float s = particleSize * U * (0.4 + 0.6 * h.y) * (1.0 - life01 * 0.6) / H;
      vec2 d = (pp - pos) * H;
      float cv = shapeCover(d, s * H) * (1.0 - life01 * life01);
      cloud = max(cloud, cv);
      fresh = max(fresh, cv * step(age, 0.12));
      float hd = length(d) / max(s * H, 1.0);
      glowSum += (1.0 - life01) / (1.0 + hd * hd * hd * hd);
    }
  }
  cloud *= inP;
  fresh *= inP;

  float rows = 0.0;
  for (int r = 0; r <= 5; r++) {
    float yr = hi.y - float(r) * H / 5.0;
    float tk = hair(sp.y - yr) * step(lo.x - 14.0 * U, sp.x) * step(sp.x, lo.x - 4.0 * U);
    rows = max(rows, tk);
  }
  float ticksMinor = 0.0;
  for (int r = 0; r < 25; r++) {
    float yr = hi.y - float(r) * H / 25.0;
    ticksMinor = max(ticksMinor, hair(sp.y - yr) * step(lo.x - 8.0 * U, sp.x) * step(sp.x, lo.x - 4.0 * U));
  }
  float frame = boxLine(sp, lo, hi) * gridAmount;
  float brk = brackets(sp, lo - 10.0 * U, hi + 10.0 * U, 26.0 * U) * gridAmount;
  float dgrid = (hair(sp.y - (baseY + 0.25 * H)) + hair(sp.y - (baseY + 0.5 * H))) * dashes(sp.x, 8.0, 0.25) * inRect(sp, lo, hi) * 0.4 * gridAmount;
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? 0.03 * res.x : 0.97 * res.x, (c & 2) == 0 ? 0.04 * res.y : 0.96 * res.y);
    plus = max(plus, plusAt(sp, centre, 8.0 * U));
  }

  vec3 ink = inkColor.rgb;
  vec3 acc = accentAt(0.5);
  vec3 col = stageBackground(vUv, ink, kickEnv(clk));
  col += acc * glowSum * glow * 0.05 * inP;
  col = mix(col, ink, max(max(rows, ticksMinor * 0.7), max(dgrid, floorLine * 0.8)) * span);
  col = mix(col, ink, max(spec, cloud));
  col = mix(col, acc, max(max(fresh, tipD), capD));
  col = mix(col, ink, max(frame, brk));
  if (marks) { col = mix(col, ink, plus); }
  col = mix(col, ink, textInk());
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
