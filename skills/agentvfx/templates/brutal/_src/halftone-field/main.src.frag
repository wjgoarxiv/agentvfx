// halftone-field: footage as one-tone dot matrix (dot screen, ordered dither or ASCII cells) on a full solid
// field, framed by a hairline with pink / cyan micro bars on the image edges and a tall thin headline.
//@include lib.glsl

vec2 gC;
vec2 gH;

// beat tears: rows of the image slide sideways for a couple of frames after a beat
vec2 tearP(vec2 p) {
  float on = step(0.3, beatPulse(8.0)) * tearAmount;
  if (on <= 0.0) return p;
  float row = floor(p.y / 18.0);
  float f = float(FRAMEINDEX / 2);
  p.x += (hash12(vec2(row, f)) - 0.5) * 2.0 * on * 120.0 * step(0.6, hash12(vec2(row, f + 2.3)));
  return p;
}
float lumAt(vec2 p) {
  vec2 uv = coverUV(tearP(p), gC, gH * 2.0);
  float L = pow(clamp(luma(mediaRaw(uv)), 0.0, 1.0), 0.4545);
  L = clamp((L - 0.5) * imgContrast + 0.5 + imgBias, 0.0, 1.0);
  return invert ? 1.0 - L : L;
}
//@include screen.glsl

// edge bars: short horizontal ticks hung inward from the left / right image edges, lengths ride the bands
float edgeBars(vec2 p, vec2 lo, vec2 hi, out vec3 tint) {
  tint = vec3(0.0);
  float m = 0.0;
  float slotH = 7.0;
  float y = p.y - lo.y;
  if (y < 0.0 || p.y > hi.y) return 0.0;
  float slot = floor(y / slotH);
  float fy = fract(y / slotH);
  for (int side = 0; side < 2; side++) {
    float sid = slot * 2.0 + float(side);
    float h1 = hash12(vec2(sid, 4.0));
    float h2 = hash12(vec2(sid, 9.0));
    float band = AUDIO_BANDS[int(mod(slot * 3.0 + float(side) * 7.0, 28.0))];
    float len = (6.0 + 70.0 * h2 * h2) * (0.45 + 1.1 * band * reactivity);
    float edge = side == 0 ? p.x - lo.x : hi.x - p.x;
    float on = step(0.0, edge) * step(edge, len) * step(0.1, fy) * step(fy, 0.62) * step(1.0 - barDensity, h1);
    if (on > m) tint = h2 > 0.5 ? barA.rgb : barB.rgb;
    m = max(m, on);
  }
  return m;
}

void main() {
  initDesign();
  float W = designWidth();
  gC = vec2(imgX * W, imgY * 1080.0);
  gH = vec2(imgW * W, imgH * 1080.0) * 0.5;
  float kick = clamp((AUDIO_BASS - 1.0) / 3.0, 0.0, 1.0);
  vec3 col = fieldColor.rgb;
  vec2 lo = gC - gH;
  vec2 hi = gC + gH;
  float inRect = step(lo.x, D.x) * step(D.x, hi.x) * step(lo.y, D.y) * step(D.y, hi.y);

  vec4 tm = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  float halo = 0.0;
  if (HAS_TEXT && inRect > 0.0) {
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      halo = max(halo, texture(TEXTMASK, vUv + vec2(cos(a), sin(a)) * 4.0 / RENDERSIZE).r);
    }
  }

  float dots = 0.0;
  if (inRect > 0.0) {
    float gain = dotGain * (1.0 + kickGain * kick * 0.3);
    if (screenMode == 0) dots = dotScreen(D, cell, dotAngle, gain, 1.0);
    else if (screenMode == 1) dots = orderedDither(D, max(2.0, cell * 0.36));
    else dots = asciiScreen(D, cell * 1.5);
    dots *= 1.0 - halo * textKnock;
  }
  col = mix(col, dotColor.rgb, dots);

  vec2 fc = 0.5 * (lo + hi);
  float ink = strokeAA(sdBox(D - fc, gH + 10.0), 1.5) * frameAmount;
  ink = max(ink, strokeAA(sdBox(D - fc, gH), 1.0) * frameAmount * 0.5);
  if (marks) {
    for (int i = 0; i < 4; i++) {
      vec2 corner = vec2(i % 2 == 0 ? lo.x : hi.x, i < 2 ? lo.y : hi.y);
      ink = max(ink, plusMark(D - (corner + (corner - fc) / gH * 28.0), 9.0));
    }
  }
  vec3 tint;
  float bars = edgeBars(D, lo, hi, tint) * clamp((TIME * 1000.0 - introMs * 0.4) / 160.0, 0.0, 1.0) * barAmount;
  col = mix(col, tint, bars);
  col = mix(col, inkColor.rgb, clamp(ink, 0.0, 1.0));
  float t = tm.r * clamp((TIME * 1000.0 - introMs * 0.1) / 120.0, 0.0, 1.0);
  col = mix(col, textColor.rgb, clamp(t, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}
