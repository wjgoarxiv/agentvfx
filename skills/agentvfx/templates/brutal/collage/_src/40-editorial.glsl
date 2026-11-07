// Editorial roles. The engine text layer (TEXTMASK) is a "sheet" of type slots (see fx.json X_AGENTVFX.text);
// a type cell shows a window of that sheet, scaled and optionally turned 90 degrees, and the shader only
// colours it. Live numbers and labels come from the mono "atlas" row of the sheet (digits, colon, A..Z).
// Every role below returns vec3(ink, hot, 0) coverage in the cell's own pixel space (q from its top-left).
const float ATLAS_X = 0.35938;
const float ATLAS_Y = 0.93333;
const float ATLAS_PX = 0.05;
const float MONO_ADV = 0.602;
vec2 UN;

// one text-sheet channel (0 R the editorial sheet, 1 G, 2 B) at sheet pixel sp (origin top left)
float sheetC(vec2 sp, int ch) {
  vec2 res = RENDERSIZE;
  if (!HAS_TEXT || sp.x < 0.0 || sp.y < 0.0 || sp.x >= res.x || sp.y >= res.y) { return 0.0; }
  vec3 t = texture(TEXTMASK, vec2(sp.x, res.y - sp.y) / res).rgb;
  return ch == 1 ? t.g : (ch == 2 ? t.b : t.r);
}
float sheetAt(vec2 sp) { return sheetC(sp, 0); }

int aIdx(int ch) {
  if (ch >= 48 && ch <= 57) { return ch - 48; }
  if (ch == 58) { return 10; }
  if (ch >= 65 && ch <= 90) { return ch - 54; }
  return -1;
}
// one atlas glyph; p is in pixels from the top-left of its character box (MONO_ADV * fs wide, fs high)
float aGlyph(vec2 p, int ch, float fs) {
  int idx = aIdx(ch);
  if (idx < 0 || p.x < 0.0 || p.y < 0.0 || p.x >= MONO_ADV * fs || p.y >= fs) { return 0.0; }
  float apx = ATLAS_PX * RENDERSIZE.y;
  vec2 o = vec2(ATLAS_X * RENDERSIZE.x + float(idx) * MONO_ADV * apx, ATLAS_Y * RENDERSIZE.y);
  return sheetAt(o + p * (apx / fs));
}
float aTxt(vec2 p, float fs, int a, int b, int c, int d) {
  if (p.x < 0.0) { return 0.0; }
  float adv = MONO_ADV * fs;
  int i = int(floor(p.x / adv));
  if (i > 3) { return 0.0; }
  int ch = i == 0 ? a : (i == 1 ? b : (i == 2 ? c : d));
  return aGlyph(vec2(p.x - float(i) * adv, p.y), ch, fs);
}
float aNum(vec2 p, float fs, float v, int nd) {
  if (p.x < 0.0) { return 0.0; }
  float adv = MONO_ADV * fs;
  int i = int(floor(p.x / adv));
  if (i >= nd) { return 0.0; }
  int dg = int(mod(floor(v / pow(10.0, float(nd - 1 - i)) + 0.001), 10.0));
  return aGlyph(vec2(p.x - float(i) * adv, p.y), 48 + dg, fs);
}

float bandAt(float x) {
  float f = x * float(bands) - 0.5;
  float i0 = floor(f);
  return mix(stBand(clamp(int(i0), 0, bands - 1)), stBand(clamp(int(i0) + 1, 0, bands - 1)), f - i0);
}

// spectrum, hairline family. 1: one line over the bands; 2: comb of single-pixel bars. Both stand on a
// baseline with a tick scale under it and an accent dot on the loudest band.
vec3 pSpecHair(vec2 q, vec2 S, int v) {
  float y0 = S.y - 14.0 * U;
  float amp = y0 - 2.0 * U;
  float inx = step(0.0, q.x) * step(q.x, S.x);
  float pitch = S.x / float(bands);
  float ink = hl(q.y - y0) * inx * 0.85;
  float tk = floor(q.x / pitch + 0.5);
  float isMaj = mod(tk, 5.0) < 0.5 ? 1.0 : 0.0;
  ink = max(ink, step(abs(q.x - tk * pitch), HW * 0.5 + 0.25) * step(y0, q.y) * step(q.y, y0 + (3.0 + 3.5 * isMaj) * U) * 0.8);
  float hot = 0.0;
  if (v == 2) {
    int b = int(clamp(floor(q.x / pitch), 0.0, float(bands - 1)));
    float top = y0 - stBand(b) * amp;
    float bar = hl(q.x - (float(b) + 0.5) * pitch) * step(top, q.y) * step(q.y, y0) * inx;
    ink = max(ink, bar * 0.8);
    hot = max(hot, bar * step(q.y, top + 3.0 * U));
  } else {
    float yA = y0 - bandAt((q.x - 0.5) / S.x) * amp;
    float yB = y0 - bandAt((q.x + 0.5) / S.x) * amp;
    float d = max(max(min(yA, yB) - q.y, q.y - max(yA, yB)), 0.0);
    ink = max(ink, hlw(d, HW * 1.15) * inx);
  }
  vec4 pk = texelFetch(state, ivec2(2, 0), 0);
  vec2 pp = vec2((pk.x + 0.5) * pitch, y0 - pk.y * amp);
  float lit = step(0.06, pk.y);
  hot = max(hot, lit * max(inBox(q - pp, vec2(-3.0 * U), vec2(3.0 * U)), hl(q.x - pp.x) * step(q.y, pp.y - 3.0 * U) * step(pp.y - 12.0 * U, q.y)));
  return vec3(ink, hot, 0.0);
}

// scope as one line crossing the cell: faint axis, trigger-free wave trace. 1: trace hot; 2: trace ink
vec3 pScopeLine(vec2 q, vec2 S, int v) {
  float yc = S.y * 0.5;
  float inx = step(0.0, q.x) * step(q.x, S.x);
  float dx = 0.5 / S.x * 511.0;
  float t = q.x / S.x * 511.0;
  float yA = yc - waveI(t - dx) * scopeGain * S.y;
  float yB = yc - waveI(t + dx) * scopeGain * S.y;
  float d = max(max(clamp(min(yA, yB), 0.0, S.y) - q.y, q.y - clamp(max(yA, yB), 0.0, S.y)), 0.0);
  float tr = hlw(d, HW * 1.15) * inx;
  float axis = hl(q.y - yc) * inx * 0.22;
  return vec3(max(axis, v == 2 ? tr : 0.0), v == 2 ? 0.0 : tr, 0.0);
}

// hairline track with a heavier fill up to the level and a cap tick, along the long side of the cell
vec3 levelBar(vec2 q, vec2 S, int ch) {
  float lv = stLevel()[ch];
  bool wide = S.x >= S.y;
  float len = wide ? S.x : S.y;
  float along = wide ? q.x : S.y - q.y;
  float across = wide ? q.y - S.y * 0.5 : q.x - S.x * 0.5;
  if (along < -1.0 || along > len + 1.0) { return vec3(0.0); }
  float track = hl(across) * 0.3;
  float fillv = hlw(across, HW * 2.4) * step(0.0, along) * step(along, lv * len);
  float cap = step(abs(along - lv * len), HW * 0.75 + 0.5) * step(abs(across), 5.0 * U) * step(0.04, lv);
  float ends = step(abs(along), HW * 0.5 + 0.25) * step(abs(across), 3.0 * U);
  return vec3(max(max(track, fillv), ends * 0.6), cap, 0.0);
}

// four thin level bars (bass, mid, treble, rms) with mono labels: rows in a wide cell, columns in a tall one
vec3 pMeterEd(vec2 q, vec2 S) {
  bool wide = S.x >= S.y * 1.2;
  if (wide) {
    float rh = S.y / 4.0;
    int ch = int(clamp(floor(q.y / rh), 0.0, 3.0));
    vec2 lq = vec2(q.x, q.y - float(ch) * rh);
    float fs = min(rh * 0.8, 15.0 * U);
    float lw = 4.2 * MONO_ADV * fs;
    vec2 gp = lq - vec2(0.0, (rh - fs) * 0.5);
    float lab = ch == 0 ? aTxt(gp, fs, 66, 83, 83, 0) : (ch == 1 ? aTxt(gp, fs, 77, 73, 68, 0) : (ch == 2 ? aTxt(gp, fs, 84, 82, 66, 0) : aTxt(gp, fs, 82, 77, 83, 0)));
    vec3 b = levelBar(lq - vec2(lw, 0.0), vec2(S.x - lw, rh), ch);
    return vec3(max(lab * 0.9, b.x), b.y, 0.0);
  }
  float cw = S.x / 4.0;
  int ch = int(clamp(floor(q.x / cw), 0.0, 3.0));
  float fs = min(cw * 0.7, 15.0 * U);
  float lh = fs * 1.5;
  vec2 lq = vec2(q.x - float(ch) * cw, q.y);
  vec2 gp = lq - vec2((cw - 3.0 * MONO_ADV * fs) * 0.5, S.y - lh);
  float lab = ch == 0 ? aTxt(gp, fs, 66, 83, 83, 0) : (ch == 1 ? aTxt(gp, fs, 77, 73, 68, 0) : (ch == 2 ? aTxt(gp, fs, 84, 82, 66, 0) : aTxt(gp, fs, 82, 77, 83, 0)));
  vec3 b = levelBar(lq, vec2(cw, S.y - lh), ch);
  return vec3(max(lab * 0.9, b.x), b.y, 0.0);
}

// live number, left aligned and sized to the cell width: 1 rms, 2 cut count (flashes hot for 4 frames), 3 frame, 4 timecode, 5 bpm
vec3 pReadEd(vec2 q, vec2 S, int v, vec4 clk) {
  int nch = v == 4 ? 8 : (v == 3 ? 4 : 3);
  float fs = min(S.x / (float(nch) * MONO_ADV), S.y / 0.86);
  vec2 p = q - vec2(0.0, S.y * 0.5 - fs * 0.455);
  float ink = 0.0;
  if (v == 1) { ink = aNum(p, fs, floor(stLevel().a * 999.0), 3); }
  if (v == 2) { ink = aNum(p, fs, mod(clk.x, 1000.0), 3); }
  if (v == 3) { ink = aNum(p, fs, mod(float(FRAMEINDEX), 10000.0), 4); }
  if (v == 5) { ink = aNum(p, fs, floor(AUDIO_BPM), 3); }
  if (v == 4) {
    float adv = MONO_ADV * fs;
    ink = aNum(p, fs, mod(floor(TIME / 60.0), 100.0), 2) + aGlyph(p - vec2(2.0 * adv, 0.0), 58, fs)
        + aNum(p - vec2(3.0 * adv, 0.0), fs, mod(floor(TIME), 60.0), 2) + aGlyph(p - vec2(5.0 * adv, 0.0), 58, fs)
        + aNum(p - vec2(6.0 * adv, 0.0), fs, mod(float(FRAMEINDEX), 30.0), 2);
  }
  ink = min(ink, 1.0);
  float pulse = v == 2 && clk.x > 0.5 && float(FRAMEINDEX) - clk.y < 3.5 ? 1.0 : 0.0;
  return vec3(ink, ink * pulse, 0.0);
}

// registration mark: ring, inner ring and a cross reaching past the ring; an accent dot follows the spectral
// balance (x) and loudness (y) and an onset throws a second ring for three frames
vec3 pRegMark(vec2 q, vec2 S, vec4 clk) {
  vec4 lv = stLevel();
  vec2 c = S * 0.5;
  float R = min(S.x, S.y) * 0.5;
  vec2 d = q - c;
  float r = length(d);
  float r0 = R * 0.6;
  float ink = max(hl(r - r0), hl(r - r0 * 0.28)) * 0.9;
  ink = max(ink, max(hl(d.y) * step(abs(d.x), R * 0.96), hl(d.x) * step(abs(d.y), R * 0.96)) * 0.9);
  vec2 tp = c + vec2(0.5 * r0 * (lv.b - lv.r), -0.6 * r0 * (lv.a * 1.8 - 0.7));
  float hitF = float(FRAMEINDEX) - clk.w;
  float ringB = hitF < 3.0 && clk.z > 0.5 ? hl(r - r0 * (1.0 + 0.22 * (hitF + 1.0))) : 0.0;
  float hot = max(inBox(q - tp, vec2(-3.5 * U), vec2(3.5 * U)), ringB);
  return vec3(ink, hot, 0.0);
}

// a type cell: window of the text sheet; 1..4 level fill (bass, mid, treble, rms) with a level hairline; 5 hot sweep per onset
vec3 pType(vec2 q, vec2 S, int v, int rot, vec3 src, int ch, vec4 clk) {
  vec2 tq = rot == 1 ? vec2(S.y - q.y, q.x) : (rot == 2 ? vec2(q.y, S.x - q.x) : q);
  float m = sheetC(src.xy * (RENDERSIZE / vec2(32.0, 18.0)) + tq / src.z, ch);
  float hot = 0.0;
  float line = 0.0;
  if (v >= 1 && v <= 4) {
    float lv = stLevel()[v - 1];
    float yl = S.y * (1.0 - lv);
    hot = m * step(yl, q.y);
    line = hl(q.y - yl) * 0.55 * step(0.03, lv);
  }
  if (v == 5) {
    float age = float(FRAMEINDEX) - clk.w;
    float x0 = S.x * (age / 7.0 - 0.18);
    hot = m * step(0.0, age) * step(age, 7.5) * step(x0, q.x) * step(q.x, x0 + S.x * 0.18) * step(0.5, clk.z);
  }
  return vec3(m, max(hot, line), 0.0);
}

// rules. 1: horizontal hairline; 2: vertical hairline; 3: baseline with a tick scale; 4..7: level bar (bass, mid, treble, rms);
// 8: ruled rows, one hairline per grid unit
vec3 pRule(vec2 q, vec2 S, int v) {
  float inx = step(-0.5, q.x) * step(q.x, S.x + 0.5);
  float iny = step(-0.5, q.y) * step(q.y, S.y + 0.5);
  if (v == 1) { return vec3(hl(q.y - S.y * 0.5) * inx, 0.0, 0.0); }
  if (v == 2) { return vec3(hl(q.x - S.x * 0.5) * iny, 0.0, 0.0); }
  if (v == 3) {
    float k = floor(q.x / (8.0 * U) + 0.5);
    float len = (mod(k, 5.0) < 0.5 ? 12.0 : 5.0) * U;
    float tk = step(abs(q.x - k * 8.0 * U), HW * 0.5 + 0.25) * step(S.y - len, q.y) * step(q.y, S.y);
    return vec3(max(hl(q.y - (S.y - HW * 0.5)) * inx, tk) * 0.85, 0.0, 0.0);
  }
  if (v >= 4 && v <= 7) { return levelBar(q, S, v - 4); }
  if (v == 8) {
    float rows = max(floor(S.y / UN.y + 0.5), 1.0);
    float k = floor(q.y / (S.y / rows) + 0.5);
    return vec3(hl(q.y - k * S.y / rows) * inx * 0.7, 0.0, 0.0);
  }
  return vec3(0.0);
}

float frameCov(int frame, vec2 q, vec2 S) {
  if (frame == 2) { return boxLnW(q, vec2(0.5 * HW), S - vec2(0.5 * HW), HW); }
  if (frame == 3) {
    vec2 a = min(q, S - q);
    float arm = 16.0 * U;
    float inb = step(-0.5, q.x) * step(q.x, S.x + 0.5) * step(-0.5, q.y) * step(q.y, S.y + 0.5);
    return max(hl(a.y - 0.5 * HW) * step(a.x, arm), hl(a.x - 0.5 * HW) * step(a.y, arm)) * inb;
  }
  return 0.0;
}
