// waveform-line main: the waveform strip instrument. A framed strip (panel) with a 0..5 ruler above it
// (major ticks with numerals from the text layer, minor ticks between), a dashed centre axis, and the
// smoothed waveform drawn as a hairline: `layers` delayed copies (layerDelay frames apart, from the shift
// register in wstate), older ones dimmer and thinner. displayMode 0 = polyline, 1 = hair columns (one
// vertical hairline per column from the axis, like a dense scope strip), 2 = dots. The line is pinched
// to nothing at both ends and grows from the centre at the start. A hit thickens and fills the strip
// frame for ~3 frames. Corner brackets, + marks and engine text complete the panel.
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
