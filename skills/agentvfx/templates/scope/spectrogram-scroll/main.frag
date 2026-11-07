// spectrogram-scroll main: the buffer inside the central panel as a one-tone halftone (dot radius follows the
// level) on the field colour, with scrolling second ticks, onset ticks and a playhead; colorMap 0..4 keep the
// older colour ramps for the glow preset. The HUD chrome mask and the engine text layer go on top.
vec3 sc(vec3 s) { return srgbToLinear(s); }

void fieldColors(out vec3 bg, out vec3 ink) {
  if (fieldMode == 1) { bg = sc(vec3(0.784, 1.0, 0.0)); ink = sc(vec3(0.043)); }
  else if (fieldMode == 2) { bg = sc(vec3(0.078, 0.078, 1.0)); ink = sc(vec3(0.95, 0.95, 0.93)); }
  else if (fieldMode == 3) { bg = sc(vec3(0.016)); ink = sc(vec3(0.224, 1.0, 0.078)); }
  else if (fieldMode == 4) { bg = sc(vec3(1.0, 0.235, 0.0)); ink = sc(vec3(0.04, 0.04, 0.62)); }
  else { bg = sc(vec3(0.043)); ink = sc(vec3(0.914, 0.914, 0.894)); }
}

vec3 ramp(float u, vec3 a, vec3 b, vec3 c) {
  vec3 col = mix(vec3(0.0), a, smoothstep(0.0, 0.33, u));
  col = mix(col, b, smoothstep(0.33, 0.66, u));
  return mix(col, c, smoothstep(0.66, 1.0, u));
}

vec3 cmap(float u) {
  if (colorMap == 1) return ramp(u, vec3(0.45, 0.0, 0.02), vec3(1.0, 0.16, 0.0), vec3(1.0, 0.92, 0.55));
  if (colorMap == 2) return ramp(u, vec3(0.08, 0.0, 0.5), vec3(0.62, 0.0, 1.0), vec3(1.0, 0.45, 0.95));
  if (colorMap == 3) return paletteRamp(u);
  if (colorMap == 4) return vec3(u);
  return ramp(u, vec3(0.0, 0.22, 0.02), vec3(0.78, 1.0, 0.0), vec3(1.0, 1.0, 0.85));
}

void main() {
  vec3 bg;
  vec3 ink;
  fieldColors(bg, ink);
  vec2 res = RENDERSIZE;
  float S = res.y / 1080.0;
  int W = int(res.x);
  int H = int(res.y);
  vec2 pl = vec2(0.21, 0.12) * res;
  vec2 ph = vec2(0.79, 0.88) * res;
  int shift = max(1, int(floor(float(scrollPx) * res.x / 1920.0 + 0.5)));
  float k = 0.0;
  vec3 legacy = vec3(0.0);
  bool area = gl_FragCoord.x >= pl.x && gl_FragCoord.x < ph.x && gl_FragCoord.y >= pl.y && gl_FragCoord.y < ph.y;
  if (area) {
    int pw = int(ph.x - pl.x);
    int bx = int(gl_FragCoord.x - pl.x) + (W - pw);
    int cellPx = max(1, int(floor(float(cell) * S + 0.5)));
    float py = gl_FragCoord.y - pl.y;
    float cy = (floor(py / float(cellPx)) + 0.5) * float(cellPx);
    float yy = cy / (ph.y - pl.y);
    if (mirror) yy = abs(2.0 * clamp(yy, 0.0, 1.0) - 1.0);
    vec4 s = texelFetch(specBuf, ivec2(bx, clamp(int(yy * float(H)), 0, H - 1)), 0);
    float u = pow(s.r, gamma);
    if (colorMap == 5) {
      if (cellPx >= 3 && shift >= 3) {
        float cx = float(W - 1 - ((W - 1 - bx) / shift) * shift) - 0.5 * float(shift) + 0.5;
        vec2 off = vec2((float(bx) + 0.5 - cx) / float(shift), (py - cy) / float(cellPx));
        float r = 0.58 * sqrt(u);
        k = (1.0 - smoothstep(r - 1.2 / float(min(shift, cellPx)), r, length(off))) * step(0.02, u);
      } else {
        k = u;
      }
    } else {
      legacy = cmap(u);
      k = 1.0;
    }
    float topBand = step(ph.y - 22.0 * S, gl_FragCoord.y);
    k = max(k, topBand * s.g * onsetTicks * hud);
    k = max(k, hud * playhead * step(ph.x - 3.0 * S, gl_FragCoord.x));
  }
  int bxs = (W - 1 - (int(gl_FragCoord.x - pl.x) + (W - int(ph.x - pl.x)))) / shift;
  float tickK = 0.0;
  if (gl_FragCoord.y < pl.y && gl_FragCoord.y > pl.y - 22.0 * S && gl_FragCoord.x >= pl.x && gl_FragCoord.x < ph.x && (W - 1 - (int(gl_FragCoord.x - pl.x) + (W - int(ph.x - pl.x)))) % shift == 0 && FRAMEINDEX - bxs >= 0) {
    int fb = FRAMEINDEX - bxs;
    float hgt = pl.y - gl_FragCoord.y;
    tickK = fb % 60 == 0 ? step(hgt, 20.0 * S) : (fb % 15 == 0 ? step(hgt, 9.0 * S) : 0.0);
  }
  vec4 h = texture(hudMask, vUv);
  vec4 t = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  float chrome = clamp(h.r + 0.4 * h.g * grid, 0.0, 1.0) * hud;
  float kk = 1.0 - (1.0 - k) * (1.0 - chrome) * (1.0 - t.r * hud) * (1.0 - tickK * hud);
  vec3 col = mix(bg, ink, kk);
  if (colorMap != 5 && area) col = mix(col, legacy, 1.0 - chrome);
  fragColor = vec4(col, 1.0);
}
