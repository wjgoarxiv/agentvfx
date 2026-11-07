// Scene 10 (variant 0, rot 1), cube-wall: a salmon field and a 4 x 3 wall of cubes. On every beat every cube turns to its next face in
// three frames (even columns slide round sideways, odd columns upward); a face is a cobalt rounded tile with a cream letter, a cream
// tile with a cobalt letter, a cobalt Bayer dither of the plate, or a dot grid whose dot radius is the bass. Each onset swaps the letter
// of one cube. Palette: ground (salmon), ink (cream), accent (cobalt), tintA (dark salmon). Text set 11: r the four face letters
// (Big Shoulders Display Black, C U B E at 0, 0.2, 0.4, 0.6 of the sheet width), g the caption (MesloLGS NF).
float cwRound(vec2 p, float s, float r) { return length(max(abs(p) - (s - r), 0.0)) - r; }

vec4 cwFace(vec2 q, vec2 ctr, vec2 p, float s, int kind, int letter, float bass) {
  vec3 cobalt = accentColor.rgb;
  vec3 cream = inkColor.rgb;
  float cov = scAA(cwRound(p, s, 0.05));
  vec3 f = kind == 0 ? cobalt : (kind == 3 ? tintA.rgb : cream);
  float cx = (float(letter) * 0.2) * RENDERSIZE.x + 0.1167 * RENDERSIZE.y;
  vec2 sp = vec2(cx, 0.2361 * RENDERSIZE.y) + p / s * 0.1833 * RENDERSIZE.y;
  float m = crisp(sheetC(sp, 0), 1.0);
  if (kind == 0) { f = mix(f, cream, m); }
  if (kind == 1) { f = mix(f, cobalt, m); }
  if (kind == 2) {
    float px = scPx();
    vec2 pix = floor(q / px);
    float l = scTone((pix + 0.5) * px, (ctr - s) * scU, (ctr + s) * scU, 1.5, 0.08);
    f = mix(cream, cobalt, step(scBayer(pix), 1.0 - l));
  }
  if (kind == 3) {
    vec2 g = (p / s * 0.5 + 0.5) * 6.0;
    float dt = scAA((length(fract(g) - 0.5) - (0.12 + 0.34 * bass)) * s / 3.0);
    f = mix(f, cream, dt);
  }
  return vec4(f, cov);
}

void sceneCubeWall(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 cobalt = accentColor.rgb;
  vec3 cream = inkColor.rgb;
  float beat = floor(clk.x);
  float cut = floor(beat * 0.5);
  float age = float(FRAMEINDEX) - clk.y;
  float u = (cut < 0.5 || mod(beat, 2.0) > 0.5) ? 1.0 : clamp((age + 1.0) / 3.0, 0.0, 1.0);
  col = groundColor.rgb;
  vec2 o = vec2(0.5 * A - 0.6, 0.05);
  vec2 g = (c - o) / 0.3;
  vec2 id = floor(g);
  col = mix(col, tintA.rgb, scAA(sdBox(c, o - 0.01, o + vec2(1.2, 0.9) + 0.01)) * 0.5);
  if (id.x >= 0.0 && id.x < 4.0 && id.y >= 0.0 && id.y < 3.0) {
    vec2 ctr = o + (id + 0.5) * 0.3;
    vec2 p = c - ctr;
    float s = 0.135;
    bool horiz = mod(id.x, 2.0) < 0.5;
    float pitch = 2.0 * s + 0.03;
    float off = pitch * u;
    vec2 pPrev = horiz ? p + vec2(off, 0.0) : p + vec2(0.0, off);
    vec2 pNew = horiz ? p - vec2(pitch - off, 0.0) : p - vec2(0.0, pitch - off);
    float idx = id.x + 4.0 * id.y;
    float turns = floor((clk.z + 11.0 - idx) / 12.0);
    int letter = int(mod(idx + turns, 4.0));
    int kNew = int(mod(cut + id.x + 2.0 * id.y, 4.0));
    int kPrev = int(mod(cut + 3.0 + id.x + 2.0 * id.y, 4.0));
    bool inPrev = abs(horiz ? pPrev.x : pPrev.y) < s && abs(horiz ? pPrev.y : pPrev.x) < s;
    bool inNew = abs(horiz ? pNew.x : pNew.y) < s && abs(horiz ? pNew.y : pNew.x) < s;
    float bass = stLevel().r;
    if (u >= 0.99) {
      vec4 f2 = cwFace(q, ctr, p, s, kNew, letter, bass);
      col = mix(col, f2.rgb, f2.a);
    } else if (inNew) {
      vec4 fn = cwFace(q, ctr, pNew, s, kNew, letter, bass);
      col = mix(col, fn.rgb * (0.65 + 0.35 * u), fn.a);
    } else if (inPrev) {
      vec4 fp = cwFace(q, ctr, pPrev, s, kPrev, letter, bass);
      col = mix(col, fp.rgb * (1.0 - 0.35 * u), fp.a);
    }
  }
  // margins: cobalt bar with the caption, rules, crosses
  col = mix(col, cobalt, scAA(sdBox(c, vec2(0.0, 0.88), vec2(o.x - 0.03, 0.95))));
  col = mix(col, cream, scSheet(q, 1) * scBox(c, vec2(0.0, 0.88), vec2(o.x - 0.03, 0.95)));
  col = mix(col, cream, scLine(c.x - (o.x + 1.23), 1.0) * step(0.05, c.y) * step(c.y, 0.95) * 0.9);
  col = mix(col, cobalt, max(scPlus(c, vec2(0.08, 0.08), 0.02), scPlus(c, vec2(A - 0.08, 0.92), 0.02)));
  col = mix(col, cobalt, numTxt(q, vec2(A - 0.25, 0.08) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
}
