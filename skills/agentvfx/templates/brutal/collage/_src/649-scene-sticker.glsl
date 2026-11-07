// Scene 12 (variant 2, rot 1), sticker-slap: a black field and a pile of cream stickers. Every beat a new sticker slaps on with an
// overshoot (scale 1.35, 1.12, 0.97, 1); the pile keeps the last eight. Every onset flips one sticker over to a 1-bit dither of the plate.
// Stickers are filled Impact words, outlined Impact words, round Georgia tags, dither plates and small mustard pills (mustard stays under
// about 15 percent); two rows of Impact text run along the top, filled and outlined in turn. Palette: ground (black), ink (cream),
// accent (mustard), tintA (lilac). Text set 13: r the sticker words (centred anchors), g the two rows.
vec2 stRot(vec2 p, float a) { float cs = cos(a); float sn = sin(a); return vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y); }

vec4 stSticker(vec2 q, vec2 c, float j, float cut, float age, float A, float flipJ) {
  vec2 h1 = hash22(vec2(j, 1.7));
  vec2 h2 = hash22(vec2(j, 8.3));
  vec2 pos = vec2(0.22 + (A - 0.44) * h1.x, 0.22 + 0.56 * h1.y);
  float rot = (h2.x - 0.5) * 0.6;
  float sz = 0.17 + 0.1 * h2.y;
  int type = int(floor(hash12(vec2(j, 4.4)) * 5.0));
  if (j == flipJ) { type = 3; }
  float sc = 1.0;
  if (j == cut) { sc = age < 0.5 ? 1.35 : (age < 1.5 ? 1.12 : (age < 2.5 ? 0.97 : 1.0)); }
  vec2 p = stRot(c - pos, rot) / sc;
  vec3 cream = inkColor.rgb;
  vec3 blk = groundColor.rgb;
  vec2 hs = vec2(sz, sz * 0.62);
  float cov = 0.0;
  vec3 f = cream;
  float k = RENDERSIZE.y;
  if (type == 2) {
    cov = scAA(length(p) - sz * 0.8);
    f = tintA.rgb;
    float m = crisp(sheetC(vec2(0.25 * RENDERSIZE.x, 0.774 * k) + p * (0.34 * k / (sz * 0.8)), 0), 1.0);
    f = mix(f, blk, m);
    f = mix(f, blk, scLine(length(p) - sz * 0.68, 1.5));
  } else if (type == 4) {
    vec2 hm = vec2(sz * 0.55, sz * 0.3);
    cov = scAA(sdBox(p, -hm, hm) - 0.03);
    f = accentColor.rgb;
    f = mix(f, blk, step(0.5, fract(p.x * 14.0)) * 0.9 * step(abs(p.y), hm.y * 0.5));
  } else {
    cov = scAA(sdBox(p, -hs, hs) - 0.03);
    if (type == 0 || type == 1) {
      vec2 anchor = type == 0 ? vec2(0.25 * RENDERSIZE.x, 0.252 * k) : vec2(0.75 * RENDERSIZE.x, 0.252 * k);
      float m = crisp(sheetC(anchor + p * (0.34 * k / sz), 0), 1.0);
      f = mix(f, blk, m);
    }
    if (type == 3) {
      float px = scPx();
      vec2 pix = floor(q / px);
      float l = scTone((pix + 0.5) * px, (pos - hs) * scU, (pos + hs) * scU, 1.6, 0.05);
      f = mix(blk, cream, step(scBayer(pix), l));
    }
  }
  return vec4(f, cov);
}

void sceneSticker(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  float beat = floor(clk.x);
  float cut = floor(beat * 0.5);
  float age = mod(beat, 2.0) < 0.5 ? float(FRAMEINDEX) - clk.y : 9.0;
  vec3 cream = inkColor.rgb;
  col = groundColor.rgb;
  // two rows of Impact text, filled then outlined
  float rows = scSheet(q, 2);
  col = mix(col, cream, rows * step(c.y, 0.17));
  float flipJ = cut - mod(floor(clk.z / 3.0), 4.0);
  for (int i = 7; i >= 0; i--) {
    float j = cut - float(i);
    vec4 s = stSticker(q, c, j, cut, age, A, flipJ);
    col = mix(col, s.rgb, s.a);
  }
  col = mix(col, cream, max(scPlus(c, vec2(0.06, 0.94), 0.02), scPlus(c, vec2(A - 0.06, 0.94), 0.02)));
  col = mix(col, cream, numTxt(q, vec2(A - 0.2, 0.9) * scU, scCell() * 2.0, mod(cut, 100.0), 2));
}
