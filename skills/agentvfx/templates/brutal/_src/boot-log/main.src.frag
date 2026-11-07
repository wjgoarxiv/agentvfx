// boot-log: monospace boot log typing over a field, dot-matrix emblem, corner + marks, side readouts,
// progress bar, then a decode headline. Scanlines, slight bloom, phosphor flicker and beat tears.
//@include lib.glsl

// dot-matrix emblem: a mirrored 13x13 cell pattern that re-rolls on beats, inside a bracket frame
float emblem(vec2 p, vec2 o, float pitch, float rollSeed) {
  vec2 q = (p - o) / pitch;
  vec2 id = floor(q);
  if (id.x < 0.0 || id.y < 0.0 || id.x > 12.0 || id.y > 12.0) return 0.0;
  vec2 m = vec2(abs(id.x - 6.0), id.y);
  float reach = max(abs(id.x - 6.0), abs(id.y - 6.0));
  float body = step(0.5, hash12(m + vec2(rollSeed * 1.7, 3.0)));
  float rim = step(0.35, hash12(m + vec2(1.0, rollSeed)));
  float on = mix(body, rim, step(5.5, reach));
  on = max(on, step(reach, 1.5) * step(0.4, hash12(m + 9.0)));
  vec2 f = fract(q) - 0.5;
  return on * fillAA((length(f) - 0.34) * pitch);
}

// side readout column: rows of 4-digit codes that scroll and re-roll
float sideColumn(vec2 p, float x0, float y0, float seed, float cell) {
  float rowH = 7.4 * cell;
  float r = floor((p.y - y0) / rowH);
  if (r < 0.0 || r > 38.0) return 0.0;
  float scroll = floor(TIME * 6.0 + seed);
  float v = floor(hash12(vec2(r + scroll, seed)) * 9999.0);
  vec2 o = snapPx(vec2(x0, y0 + r * rowH));
  float fade = step(0.18, hash12(vec2(r, seed + 4.0)));
  return printNum(p - o, v, 4, 0, cell) * fade;
}

float bloomTaps(vec2 uv, float rad) {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236 + rad;
    s += texture(TEXTMASK, uv + vec2(cos(a), sin(a)) * rad * U / RENDERSIZE).r;
  }
  return s * 0.0833;
}

void main() {
  initDesign();
  float W = designWidth();
  float pulse = beatPulse(9.0);
  float beatOn = step(0.3, pulse);
  vec2 uv = vUv;
  // beat tear: row blocks slide
  float row = floor(D.y / 16.0);
  float f2 = float(FRAMEINDEX / 2);
  uv.x += beatOn * tearAmount * (hash12(vec2(row, f2)) - 0.5) * 0.06 * step(0.7, hash12(vec2(row, f2 + 5.0)));

  vec4 tm = HAS_TEXT ? texture(TEXTMASK, uv) : vec4(0.0);
  float bloom = HAS_TEXT ? 0.4 * bloomTaps(uv, 3.0) + 0.35 * bloomTaps(uv, 8.0) + 0.25 * bloomTaps(uv, 16.0) : 0.0;
  float tInk = tm.r;
  bool headlineZone = D.y > 740.0 && D.y < 930.0;

  vec3 col = fieldColor.rgb;
  float ink = 0.0;
  float dim = 0.0;

  // pixel dust (clustered) and glowing data streaks
  vec2 dc = floor(D / 8.0);
  float cluster = smoothstep(0.55, 0.8, fbm(dc * 0.07 + vec2(TIME * 0.05, 0.0), 3));
  dim = max(dim, cluster * step(0.955, hash12(dc + floor(TIME * 8.0))) * dustAmount);
  for (int k = 0; k < 3; k++) {
    float seedK = floor(TIME * 9.0) + float(k) * 13.0;
    float yS = 240.0 + 640.0 * hash12(vec2(seedK, 1.0));
    float x0 = W * hash12(vec2(seedK, 2.0));
    float len = 120.0 + 520.0 * hash12(vec2(seedK, 3.0));
    float on = step(0.45, hash12(vec2(seedK, 4.0))) * step(x0, D.x) * step(D.x, x0 + len);
    float core = strokeAA(D.y - yS, 1.6) * on;
    dim = max(dim, core * streakAmount);
    col += inkColor.rgb * exp(-abs(D.y - yS) * 0.12) * on * streakAmount * 0.18 * (1.0 + pulse);
  }

  // emblem + brackets
  float rv = clamp((TIME * 1000.0 - introMs * 0.2) / 140.0, 0.0, 1.0);
  float roll = floor(TIME * 2.0) + float(FRAMEINDEX / 8) * beatOn;
  ink = max(ink, emblem(D, vec2(64.0, 64.0), 10.0, roll) * rv);
  vec2 ec = vec2(64.0 + 65.0, 64.0 + 65.0);
  vec2 eq = abs(D - ec) / 74.0;
  ink = max(ink, strokeAA(sdBox(D - ec, vec2(74.0)), 1.5) * step(0.62, min(eq.x, eq.y)) * rv);

  // corner + marks
  for (int i = 0; i < 4; i++) {
    vec2 c = vec2(i % 2 == 0 ? 36.0 : W - 36.0, i < 2 ? 74.0 : 1006.0);
    ink = max(ink, plusMark(D - c, 10.0));
  }
  // side readouts (right and a thin left tick column)
  float cell = cellPx(2.6);
  dim = max(dim, sideColumn(D, W - 150.0, 262.0, 3.0, cell) * rv);
  dim = max(dim, sideColumn(D, W - 90.0, 262.0, 11.0, cell) * rv * 0.7);
  for (int i = 0; i < 24; i++) {
    float yT = 262.0 + float(i) * 29.6;
    dim = max(dim, strokeAA(sdSeg(D, vec2(W - 170.0, yT), vec2(W - 170.0 + (i % 4 == 0 ? 14.0 : 7.0), yT)), 1.2));
  }

  // progress bar: dot-matrix blocks, completes with the log
  float prog = clamp((TIME - 0.2) / max(logDone - 0.2, 0.1), 0.0, 1.0);
  vec2 bo = vec2(64.0, 936.0);
  vec2 bp = D - bo;
  float blocks = step(0.0, bp.x) * step(bp.x, 640.0) * step(0.0, bp.y) * step(bp.y, 16.0);
  float bi = floor(bp.x / 10.0);
  float full = step(bi, prog * 64.0 - 1.0);
  float cellIn = step(fract(bp.x / 10.0), 0.78) * step(2.0, bp.y) * step(bp.y, 14.0);
  ink = max(ink, blocks * cellIn * full);
  dim = max(dim, blocks * cellIn * (1.0 - full) * 0.6);
  ink = max(ink, strokeAA(sdBox(bp - vec2(320.0, 8.0), vec2(324.0, 12.0)), 1.3));
  ink = max(ink, printNum(D - snapPx(vec2(700.0, 936.0)), floor(prog * 100.0), 2, 0, cellPx(3.2)) * 1.0);

  col = mix(col, inkColor.rgb, clamp(dim, 0.0, 1.0) * 0.55);
  float t = tInk * clamp((TIME * 1000.0 - introMs * 0.05) / 100.0, 0.0, 1.0);
  vec3 textCol = headlineZone ? hotColor.rgb : inkColor.rgb;
  col = mix(col, inkColor.rgb, clamp(ink, 0.0, 1.0));
  col = mix(col, textCol, clamp(t, 0.0, 1.0));
  col = mix(col, inkColor.rgb, clamp(bloom * bloomAmount, 0.0, 1.0) * (1.0 - t) * 0.6);

  // CRT: scanlines, flicker, vignette, curved letterbox
  float scan = 1.0 - scanAmount * 0.5 * (1.0 + sin(gl_FragCoord.y * 3.14159));
  float flick = 1.0 - flickerAmount * hash12(vec2(float(FRAMEINDEX), 3.0)) * (0.4 + pulse);
  vec2 vq = vUv * 2.0 - 1.0;
  float vig = 1.0 - vignette * dot(vq * vec2(0.7, 0.9), vq * vec2(0.7, 0.9));
  col *= scan * flick * vig;
  float u2 = pow(2.0 * vUv.x - 1.0, 2.0);
  float edge = letterbox * (1.0 - 0.5 * (1.0 - u2));
  float yd = min(D.y, 1080.0 - D.y);
  col = mix(vec3(0.0), col, clamp((yd - edge) * U + 0.5, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}
