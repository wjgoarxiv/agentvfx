// Role 13, typefx: type that the shader warps every frame. The text sheet is a static mask, so every effect below samples
// it through a changed coordinate (slices, stretch, history shear, smear taps, echo copies, band-cut fills). The cell holds
// its place; the letters inside it move on the music. Variants: 1 micro-type field, 2 glyph window, 3 slit-scan word,
// 4 echo stack, 5 echo ripple, 6 type equalizer. A cell reads one text-sheet channel (0 R, 1 G, 2 B) through its src window.
// Hits (stHit): x is an onset pulse, y a beat pulse; both jump on the event frame and fall in `release` seconds.
// The input typeWarp scales every audio-driven warp below (0 holds the type still, 1 default, 1.5 harder).
vec2 gP;

float winM(vec2 tq, vec3 src, int ch) { return sheetC(src.xy * (RENDERSIZE / vec2(32.0, 18.0)) + tq / src.z, ch); }
// re-sharpen a magnified glyph edge back to about one pixel
float crisp(float m, float s) {
  float k = 0.5 / max(s, 1.0);
  return smoothstep(0.5 - k, 0.5 + k, m);
}
float edgeOf(float raw) { return clamp(4.0 * raw * (1.0 - raw), 0.0, 1.0); }
// history (x beat pulse signed per hit, y mid, z treble, w rms), delay in frames, linear between frames
vec4 stHist(float delay) {
  float d = clamp(delay, 0.0, 62.0);
  float i0 = floor(d);
  return mix(texelFetch(state, ivec2(63 - int(i0), 7), 0), texelFetch(state, ivec2(62 - int(i0), 7), 0), d - i0);
}
vec3 fxFootage(vec2 p) {
  if (!HAS_INPUT) { return inkColor.rgb * 0.4; }
  return footageBody(p, RENDERSIZE, 0.0, 0);
}

// micro-type lines live in the bottom band of the G sheet (5 lines from 84 percent of the height) and the B sheet (8 lines
// from 78 percent), one line per 2.5 percent of the height, as the text items microK and microM
vec3 microBand(int ch) { return ch == 1 ? vec3(0.84, 5.0, 0.025) : vec3(0.78, 8.0, 0.025); }

// rows of real text (system fonts through the sheet); each row is one spectrum band (bass at the bottom), lit up to its level,
// the front glyphs hot. Active rows pick another line and start on every onset. Returns (ink coverage, hot coverage).
vec2 microCov(vec2 q, vec2 S, vec4 clk, vec3 src, int ch) {
  if (ch == 0) { return vec2(0.0); }
  vec3 band = microBand(ch);
  float rowH = band.z * RENDERSIZE.y * src.z;
  float row = floor(q.y / rowH);
  float lvl = bandAt(clamp(1.0 - (row + 0.5) * rowH / S.y, 0.0, 1.0));
  float seed = row * 1.7 + step(0.3, lvl) * clk.z * 3.1;
  float line = floor(hash12(vec2(seed, 2.0)) * band.y);
  float xo = hash12(vec2(seed, 5.0)) * RENDERSIZE.x;
  vec2 sp = vec2(mod(q.x / src.z + xo, RENDERSIZE.x), band.x * RENDERSIZE.y + line * band.z * RENDERSIZE.y + (q.y - row * rowH) / src.z);
  float g = crisp(sheetC(sp, ch), src.z);
  float lit = step(q.x, lvl * S.x);
  float front = lit * step(lvl * S.x - q.x, 28.0 * U + 12.0) * step(0.25, lvl);
  return vec2(g * mix(0.2, 0.85, lit), g * front);
}

// 2: giant glyph window. Footage (or, with tone accent, a solid fill) shows through the letter with the micro-type running on
// over it; a hard extrusion (darker the deeper it goes) runs down-left behind it and grows on each onset; the letter stretches
// taller on the onset and tears into horizontal slices that jump sideways on every beat.
void fxGlyph(vec2 q, vec2 S, vec3 src, int ch, int tone, vec4 clk, vec3 cInk, vec3 cHot, inout vec3 col) {
  vec4 hit = stHit() * typeWarp;
  float band = floor(q.y / (S.y / 9.0));
  float h = hash12(vec2(band, clk.z * 1.37 + 5.0));
  float dx = (fract(h * 7.0) * 2.0 - 1.0) * step(0.4, h) * max(hit.y, hit.x * 0.45) * S.x * 0.13;
  vec2 qq = vec2(q.x - dx, S.y * 0.5 + (q.y - S.y * 0.5) / (1.0 + 0.2 * hit.x));
  float raw = winM(qq, src, ch);
  float m = crisp(raw, src.z);
  float reach = (30.0 + 90.0 * hit.x) * U;
  for (int i = 10; i >= 1; i--) {
    float t = float(i) / 10.0;
    float me = crisp(winM(qq - vec2(-0.8, 0.6) * reach * t, src, ch), src.z);
    col = mix(col, cHot * (1.0 - 0.6 * t), me);
  }
  bool solid = tone == 2;
  vec2 mc = microCov(gP, RENDERSIZE, clk, vec3(0.0, 0.0, 1.0), 2);
  vec3 f = solid ? cInk : mix(fxFootage(gP), groundColor.rgb, mc.x * 0.6);
  col = mix(col, f, m);
  col = mix(col, solid ? groundColor.rgb : cInk, edgeOf(raw) * 0.9);
}

// 3: slit-scan word. Every row reads the hit history (beat pulse, onsets at 0.4) at its own delay, so each hit enters at the
// bottom row and travels up the letters as a sideways shear (direction chosen per hit); rows inside a shear jitter; the word
// smears into a streak on the beat (onsets smear at 0.3). The footage stays still behind the moving letter window.
void fxSlit(vec2 q, vec2 S, vec3 src, int ch, vec4 clk, vec3 cInk, vec3 cHot, inout vec3 col) {
  vec4 hits = stHit() * typeWarp;
  float hp = max(hits.y, 0.3 * hits.x);
  float delay = (1.0 - clamp(q.y / S.y, 0.0, 1.0)) * 22.0;
  float sh = 0.0;
  for (int i = -2; i <= 2; i++) { sh += stHist(delay + float(i)).x * (i == 0 ? 0.32 : (abs(i) == 1 ? 0.22 : 0.12)); }
  sh *= typeWarp;
  float jit = (hash12(vec2(floor(q.y / max(U * 6.0, 2.0)), clk.z)) - 0.5) * abs(sh);
  float dx = sh * S.x * 0.075 + jit * S.x * 0.04;
  float dir = hash12(vec2(clk.z, 4.0)) < 0.5 ? 1.0 : -1.0;
  float len = S.x * 0.2 * hp;
  float streak = 0.0;
  for (int i = 1; i < 13; i++) {
    float t = float(i) / 12.0;
    streak = max(streak, crisp(winM(vec2(q.x - dx - dir * t * len, q.y), src, ch), src.z) * (1.0 - t));
  }
  float raw = winM(vec2(q.x - dx, q.y), src, ch);
  float m = crisp(raw, src.z);
  col = mix(col, cHot, streak * (1.0 - m));
  col = mix(col, fxFootage(gP), m);
  col = mix(col, cInk, edgeOf(raw) * 0.9);
}

// 4: echo stack. The word repeats 2..10 times (the count follows the rms and jumps by up to 4 on the beat frame, by 1.6 on
// an onset), each copy stepped up-right and a little larger, painted back to front: odd copies solid hot, even copies knocked
// out to the ground, every edge in ink, and the footage in the front copy.
void fxEcho(vec2 q, vec2 S, vec3 src, int ch, vec3 cInk, vec3 cHot, vec3 cGnd, inout vec3 col) {
  vec4 hits = stHit();
  int n = min(2 + int(floor(typeWarp * (4.0 * stLevel().a + 4.0 * max(hits.y, 0.4 * hits.x)) + 0.5)), 11);
  vec2 c = S * 0.5;
  vec2 stp = vec2(S.x * 0.017, -S.y * 0.034);
  for (int j = 0; j < 11; j++) {
    int k = n - 1 - j;
    if (k < 0) { break; }
    float sk = 1.0 + 0.05 * float(k);
    float raw = winM((q - c - stp * float(k)) / sk + c, src, ch);
    float m = crisp(raw, src.z * sk);
    bool odd = mod(float(k), 2.0) > 0.5;
    col = mix(col, odd ? cHot : cGnd, m);
    col = mix(col, cInk, edgeOf(raw) * (odd ? 0.95 : 0.8));
    if (k == 0) { col = mix(col, fxFootage(gP), m); }
  }
}

// 5: echo ripple. The word is ringed by 2..12 hairline outlines growing out of it from the centre of the cell (alternate rings
// hot, ink), the count following the rms and the beat as in the stack; the footage fills the word itself.
void fxRipple(vec2 q, vec2 S, vec3 src, int ch, vec3 cInk, vec3 cHot, inout vec3 col) {
  vec4 hits = stHit();
  int n = min(2 + int(floor(typeWarp * (5.0 * stLevel().a + 5.0 * max(hits.y, 0.4 * hits.x)) + 0.5)), 12);
  vec2 c = S * 0.5;
  for (int j = 0; j < 12; j++) {
    int k = n - 1 - j;
    if (k < 0) { break; }
    float raw = winM((q - c) / (1.0 + 0.11 * float(k)) + c, src, ch);
    if (k > 0) { col = mix(col, mod(float(k), 2.0) > 0.5 ? cHot : cInk, edgeOf(raw) * 0.9); continue; }
    col = mix(col, fxFootage(gP), crisp(raw, src.z));
    col = mix(col, cInk, edgeOf(raw) * 0.9);
  }
}

// 6: type equalizer. The word is the analyzer: every column of the letters is filled solid up to the level of the spectrum band
// under it (bass at the left); above the level the letters are only an outline over a dim footage ghost.
void fxEq(vec2 q, vec2 S, vec3 src, int ch, vec3 cInk, vec3 cHot, inout vec3 col) {
  float raw = winM(q, src, ch);
  float m = crisp(raw, src.z);
  float lv = clamp(bandAt(clamp(q.x / S.x, 0.0, 1.0)) + 0.3 * stHit().y * typeWarp, 0.0, 1.0);
  float on = step(S.y * (1.0 - lv), q.y);
  col = mix(col, fxFootage(gP), m * (1.0 - on) * 0.45);
  col = mix(col, cHot, m * on);
  col = mix(col, cInk, edgeOf(raw) * mix(0.9, 0.35, on));
}

void drawTypeFx(int v, vec4 aux, int ch, int tone, vec2 q, vec2 S, vec4 clk, vec3 cInk, vec3 cHot, inout vec3 col) {
  int rot = int(aux.x + 0.5);
  vec3 src = vec3(aux.yz, aux.w);
  vec2 tq = rot == 1 ? vec2(S.y - q.y, q.x) : (rot == 2 ? vec2(q.y, S.x - q.x) : q);
  vec2 TS = rot == 0 ? S : S.yx;
  if (v == 1) {
    vec2 mc = microCov(tq, TS, clk, src, ch);
    col = mix(col, cInk, mc.x);
    col = mix(col, cHot, mc.y);
  }
  if (v == 2) { fxGlyph(tq, TS, src, ch, tone, clk, cInk, cHot, col); }
  if (v == 3) { fxSlit(tq, TS, src, ch, clk, cInk, cHot, col); }
  if (v == 4) { fxEcho(tq, TS, src, ch, cInk, cHot, groundColor.rgb, col); }
  if (v == 5) { fxRipple(tq, TS, src, ch, cInk, cHot, col); }
  if (v == 6) { fxEq(tq, TS, src, ch, cInk, cHot, col); }
}
