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
