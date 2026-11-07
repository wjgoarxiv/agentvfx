// spectrum-radial main: a starburst instrument. The spectrum is mirrored and repeated `lobes` times
// around a centre as hairline spokes (a spoke per bar, length = bar height) with tip dots, older echoes
// of the bars as dim hairline ghosts (echoLayers), a tick ring (tickCount), a dashed outer circle, a
// bracketed square frame with corner + marks, and a centre disc. The ring spins at `spin` rad/s and snaps
// snapDeg on every hit (an onset at or above hitFlux), when the centre disc fills with ink for ~3 frames.
// displayMode 0 = hairline spokes, 1 = spokes with step ticks, 2 = dots. Labels come from the text layer.
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
const float TAU = 6.28318530718;

vec4 barAt(int i, int d) { return texelFetch(barState, ivec2(clamp(i, 0, bandCount - 1), d == 0 ? 0 : 3 + d), 0); }

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  float px1 = 1.0 / res.y;
  vec4 ev = texelFetch(barState, ivec2(0, 1), 0);
  vec2 sp = vUv * res;
  vec2 uv = stageUv(ev, vUv);
  vec2 p = (uv * res - res * 0.5) * px1;
  float n = float(bandCount);
  float since = stageSince(ev.x, ev.y);
  float hitOn = step(0.5, ev.x) * step(0.5, exp(-since / 0.11));
  float rot = TIME * spin + (ev.x > 0.5 ? radians(snapDeg) * (ev.x - exp(-since / 0.05)) : 0.0);
  float R0 = innerRadius * (1.0 + pulse * hitOn) * (0.4 + 0.6 * introSpan());
  float r = length(p);
  float a = atan(p.y, p.x) - rot - 1.5707963;
  float turns = fract(a / TAU * float(lobes));
  float m = abs(turns * 2.0 - 1.0);
  float fm = m * n;
  int i = int(clamp(floor(fm), 0.0, n - 1.0));
  float ap = TAU / (float(lobes) * 2.0 * n);
  float lx = (fract(fm) - 0.5) * ap * max(r, 0.02);
  float room = 0.4;
  float extent = (side == 1 ? R0 * 0.92 : room - R0) * maxHeight * introK();
  float dr = side == 1 ? R0 - r : r - R0;
  float wU = hudW() * px1;
  float spoke = abs(lx) < wU * 0.5 + px1 * 0.5 ? clamp(wU * 0.5 - abs(lx) + px1 * 0.5, 0.0, px1) / px1 : 0.0;
  vec4 bar = barAt(i, 0);
  float u1 = 1.0 / 1080.0;
  float hj = bar.r * extent + floorHeight * u1;
  float body = 0.0;
  if (displayMode == 0) {
    body = spoke * step(0.0, dr) * step(dr, hj);
  } else if (displayMode == 1) {
    float stepH = extent / 14.0;
    body = spoke * step(0.0, dr) * step(dr, hj) * (0.45 + 0.55 * step(0.5, fract(dr / stepH)));
  } else {
    float cellD = 9.0 * u1;
    float j = floor(dr / cellD);
    body = dr >= 0.0 && j * cellD < hj ? cov((length(vec2(lx, dr - (j + 0.5) * cellD)) - 1.4 * u1) / px1) : 0.0;
  }
  float tip = cov((length(vec2(lx, dr - hj - 5.0 * u1)) - 1.6 * u1) / px1) * step(0.012, bar.r);
  float capY = bar.g * extent;
  float cap = capY > hj + 9.0 * u1 ? cov((length(vec2(lx * 0.5, dr - capY - 6.0 * u1)) - 1.3 * u1) / px1) : 0.0;

  float ghosts = 0.0;
  for (int l = 6; l >= 1; l--) {
    if (l > echoLayers) { continue; }
    float hl = barAt(i, l * echoDelay).r * extent;
    ghosts = max(ghosts, spoke * step(0.0, dr) * step(dr, hl) * (0.4 - 0.05 * float(l)));
  }

  float ring0 = hair((r - R0 * 0.96) / px1);
  float ringO = hair((r - 0.43) / px1) * dashes(a * 0.43 / px1, 9.0, 0.5);
  float tickLen = 0.014;
  float tk = abs(fract(a / TAU * tickCount) - 0.5) * (TAU * 0.4 / tickCount);
  float ticks = step(abs(r - 0.4), tickLen * (mod(floor(a / TAU * tickCount), 5.0) < 0.5 ? 1.0 : 0.5)) * cov((tk - wU * 0.5) / px1);
  float discFill = hitOn * step(r, R0 * 0.88);

  float inner = hair((r - R0 * 0.88) / px1) * 0.7;
  vec2 qc = abs(p);
  float cross = max(hair(qc.y / px1) * step(qc.x, 0.014), hair(qc.x / px1) * step(qc.y, 0.014));
  vec2 flo = vec2(0.5 * res.x - 0.47 * res.y, 0.03 * res.y);
  vec2 fhi = vec2(0.5 * res.x + 0.47 * res.y, 0.97 * res.y);
  float brk = brackets(sp, flo, fhi, 30.0 * U);
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? flo.x - 18.0 * U : fhi.x + 18.0 * U, (c & 2) == 0 ? flo.y : fhi.y);
    plus = max(plus, plusAt(sp, centre, 7.0 * U));
  }

  float mk = max(max(body, ghosts), max(max(tip, cap), max(ring0, inner)));
  mk = max(mk, max(ringO * 0.6, ticks * 0.8));
  mk = max(mk, max(discFill, cross * 0.6 * float(marks)));
  mk = max(mk, max(brk * gridAmount, plus * float(marks)));
  mk = max(mk, textInk());
  vec3 ink = inkColor.rgb;
  vec3 gnd = stageBackground(vUv, ink, kickEnv(ev));
  vec3 acc = accentAt((float(i) + 0.5) / n);
  vec3 col = mix(gnd, ink, mk);
  col = mix(col, acc, max(tip, cap));
  col += acc * exp(-max(dr - hj, 0.0) / max(glowRadius, px1)) * glow * 0.25 * step(0.0, dr) * step(r, 0.45) * bar.r;
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
