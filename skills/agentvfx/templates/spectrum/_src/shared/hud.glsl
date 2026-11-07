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
