// hud-deck: central media window (rect / rounded / chamfered octagon) with instrument columns drawn
// in GLSL hairlines, plus engine text for labels. Pass 0 (specState) holds the smoothed spectrum.
//@include lib.glsl
//@include icons.glsl

// staggered power-on: panel k (0..1) flickers in between k*introMs and k*introMs + 140 ms
float rev(float k) {
  float a = (TIME * 1000.0 - introMs * k) / 140.0;
  if (a >= 1.0) return 1.0;
  if (a <= 0.0) return 0.0;
  return step(0.45, hash12(vec2(k * 37.0, float(FRAMEINDEX))));
}

vec2 gWC;
vec2 gWH;

// beat tears: blocks of rows slide sideways for a couple of frames after each beat
vec2 tearP(vec2 p) {
  float on = step(0.3, beatPulse(8.0)) * tearAmount;
  if (on <= 0.0) return p;
  float row = floor(p.y / 20.0);
  float f = float(FRAMEINDEX / 2);
  p.x += (hash12(vec2(row, f)) - 0.5) * 2.0 * on * 150.0 * step(0.55, hash12(vec2(row, f + 1.7)));
  return p;
}
float lumAt(vec2 p) {
  vec2 uv = coverUV(tearP(p), gWC, gWH * 2.0);
  float L = pow(clamp(luma(mediaRaw(uv)), 0.0, 1.0), 0.4545);
  return clamp((L - 0.5) * mediaContrast + 0.5 + mediaBias, 0.0, 1.0);
}
//@include screen.glsl

float winSD(vec2 p) {
  vec2 q = p - gWC;
  if (winShape == 0) return sdRound(q, gWH, 8.0);
  if (winShape == 1) return sdRound(q, gWH, min(gWH.x, gWH.y) * 0.12);
  return sdChamfer(q, gWH, chamfer, 14.0);
}

vec3 windowColor(vec2 p) {
  if (mediaMode == 2) return mix(winBg.rgb, tone.rgb, dotScreen(p, dotSize, dotAngle, 1.18, 1.0));
  if (mediaMode == 3) return mix(winBg.rgb, tone.rgb, smoothstep(0.06, 0.94, lumAt(p)));
  vec3 c = mediaRaw(coverUV(tearP(p), gWC, gWH * 2.0));
  c = max((c - 0.18) * mediaContrast + 0.18 + (mediaBias * 0.2), 0.0);
  return mediaMode == 1 ? vec3(luma(c)) : c;
}

// white-hot horizontal light bar (eye flare) that breathes with the beat
vec3 flareAdd(vec2 p) {
  float amt = flare * (0.5 + 0.5 * mix(1.0, beatPulse(5.0), flareBeat));
  vec2 c = gWC + (vec2(flareX, flareY) - 0.5) * gWH * 2.0;
  float len = flareW * gWH.x * 2.0;
  float dx = (p.x - c.x) / len;
  float dy = p.y - c.y;
  float tap = clamp(1.0 - dx * dx, 0.0, 1.0);
  float s1 = 4.5 * tap + 0.8;
  float s2 = 28.0 * tap + 2.0;
  float core = exp(-dy * dy / (2.0 * s1 * s1)) * tap;
  float halo = exp(-dy * dy / (2.0 * s2 * s2)) * tap * 0.4;
  return (core * vec3(2.4) + halo * vec3(1.0, 0.78, 0.45)) * amt;
}

//@include deck-tiles.src.glsl
//@include deck-left.src.glsl
//@include deck-right.src.glsl

void main() {
  initDesign();
  float W = designWidth();
  gWC = vec2(winX * W, winY * 1080.0);
  gWH = vec2(winW * W, winH * 1080.0) * 0.5;
  float kick = clamp((AUDIO_BASS - 1.0) / 3.0, 0.0, 1.0);
  float drive = clamp(0.5 * AUDIO_BANDS[1] + 0.4 * AUDIO_BANDS[3] + 0.4 * kick, 0.0, 1.3) * reactivity;

  vec3 col = groundColor.rgb;
  float wd = winSD(D);
  float inside = fillAA(wd);
  if (inside > 0.0) {
    vec3 m = windowColor(D);
    if (flare > 0.0) m += flareAdd(D);
    col = mix(col, m, inside);
  }
  float ink = strokeAA(wd, 1.5 + 2.0 * beatPulse(10.0) * reactivity) * rev(0.1);
  float dim = 0.0;

  vec2 pan = vec2(0.0);
  if (deckLayout == 0) {
    pan = max(deckLeft(D, drive), deckRight(D, drive));
    if (marks) {
      vec2 o = gWH + 12.0;
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(-1.0, -1.0)), 6.0));
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(1.0, -1.0)), 6.0));
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(-1.0, 1.0)), 6.0));
      pan.x = max(pan.x, plusMark(D - (gWC + o * vec2(1.0, 1.0)), 6.0));
    }
  } else {
    pan = deckTiles(D, drive);
  }
  ink = max(ink, pan.x);
  dim = max(dim, pan.y);

  vec4 tm = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  bool micro = D.y > 395.0 && D.y < 720.0 && (D.x < 276.0 || D.x > W - 276.0);
  float gate = (deckLayout == 0) != micro ? 1.0 : 0.0;
  ink = max(ink, tm.r * gate * rev(0.25));

  col = mix(col, inkColor.rgb, clamp(dim, 0.0, 1.0) * dimAmount);
  col = mix(col, inkColor.rgb, clamp(ink, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}
