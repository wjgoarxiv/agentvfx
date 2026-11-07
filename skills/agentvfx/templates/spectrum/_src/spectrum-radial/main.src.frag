// spectrum-radial main: a starburst instrument. The spectrum is mirrored and repeated `lobes` times
// around a centre as hairline spokes (a spoke per bar, length = bar height) with tip dots, older echoes
// of the bars as dim hairline ghosts (echoLayers), a tick ring (tickCount), a dashed outer circle, a
// bracketed square frame with corner + marks, and a centre disc. The ring spins at `spin` rad/s and snaps
// snapDeg on every hit (an onset at or above hitFlux), when the centre disc fills with ink for ~3 frames.
// displayMode 0 = hairline spokes, 1 = spokes with step ticks, 2 = dots. Labels come from the text layer.
//@include stage.glsl
//@include hud.glsl
const float TAU = 6.28318530718;

vec4 barAt(int i, int d) { return texelFetch(barState, ivec2(clamp(i, 0, bandCount - 1), d == 0 ? 0 : 3 + d), 0); }

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  float px1 = 1.0 / res.y;
  vec4 ev = texelFetch(barState, ivec2(0, 1), 0);
  vec2 sp = vUv * res;
  vec2 uv = stageUv(ev, vUv);
  vec2 p = (uv * res - res * 0.5) * px1;
  float n = float(bandCount);
  float since = stageSince(ev.x, ev.y);
  float hitOn = step(0.5, ev.x) * step(0.5, exp(-since / 0.11));
  float rot = TIME * spin + (ev.x > 0.5 ? radians(snapDeg) * (ev.x - exp(-since / 0.05)) : 0.0);
  float R0 = innerRadius * (1.0 + pulse * hitOn) * (0.4 + 0.6 * introSpan());
  float r = length(p);
  float a = atan(p.y, p.x) - rot - 1.5707963;
  float turns = fract(a / TAU * float(lobes));
  float m = abs(turns * 2.0 - 1.0);
  float fm = m * n;
  int i = int(clamp(floor(fm), 0.0, n - 1.0));
  float ap = TAU / (float(lobes) * 2.0 * n);
  float lx = (fract(fm) - 0.5) * ap * max(r, 0.02);
  float room = 0.4;
  float extent = (side == 1 ? R0 * 0.92 : room - R0) * maxHeight * introK();
  float dr = side == 1 ? R0 - r : r - R0;
  float wU = hudW() * px1;
  float spoke = abs(lx) < wU * 0.5 + px1 * 0.5 ? clamp(wU * 0.5 - abs(lx) + px1 * 0.5, 0.0, px1) / px1 : 0.0;
  vec4 bar = barAt(i, 0);
  float u1 = 1.0 / 1080.0;
  float hj = bar.r * extent + floorHeight * u1;
  float body = 0.0;
  if (displayMode == 0) {
    body = spoke * step(0.0, dr) * step(dr, hj);
  } else if (displayMode == 1) {
    float stepH = extent / 14.0;
    body = spoke * step(0.0, dr) * step(dr, hj) * (0.45 + 0.55 * step(0.5, fract(dr / stepH)));
  } else {
    float cellD = 9.0 * u1;
    float j = floor(dr / cellD);
    body = dr >= 0.0 && j * cellD < hj ? cov((length(vec2(lx, dr - (j + 0.5) * cellD)) - 1.4 * u1) / px1) : 0.0;
  }
  float tip = cov((length(vec2(lx, dr - hj - 5.0 * u1)) - 1.6 * u1) / px1) * step(0.012, bar.r);
  float capY = bar.g * extent;
  float cap = capY > hj + 9.0 * u1 ? cov((length(vec2(lx * 0.5, dr - capY - 6.0 * u1)) - 1.3 * u1) / px1) : 0.0;

  float ghosts = 0.0;
  for (int l = 6; l >= 1; l--) {
    if (l > echoLayers) { continue; }
    float hl = barAt(i, l * echoDelay).r * extent;
    ghosts = max(ghosts, spoke * step(0.0, dr) * step(dr, hl) * (0.4 - 0.05 * float(l)));
  }

  float ring0 = hair((r - R0 * 0.96) / px1);
  float ringO = hair((r - 0.43) / px1) * dashes(a * 0.43 / px1, 9.0, 0.5);
  float tickLen = 0.014;
  float tk = abs(fract(a / TAU * tickCount) - 0.5) * (TAU * 0.4 / tickCount);
  float ticks = step(abs(r - 0.4), tickLen * (mod(floor(a / TAU * tickCount), 5.0) < 0.5 ? 1.0 : 0.5)) * cov((tk - wU * 0.5) / px1);
  float discFill = hitOn * step(r, R0 * 0.88);

  float inner = hair((r - R0 * 0.88) / px1) * 0.7;
  vec2 qc = abs(p);
  float cross = max(hair(qc.y / px1) * step(qc.x, 0.014), hair(qc.x / px1) * step(qc.y, 0.014));
  vec2 flo = vec2(0.5 * res.x - 0.47 * res.y, 0.03 * res.y);
  vec2 fhi = vec2(0.5 * res.x + 0.47 * res.y, 0.97 * res.y);
  float brk = brackets(sp, flo, fhi, 30.0 * U);
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? flo.x - 18.0 * U : fhi.x + 18.0 * U, (c & 2) == 0 ? flo.y : fhi.y);
    plus = max(plus, plusAt(sp, centre, 7.0 * U));
  }

  float mk = max(max(body, ghosts), max(max(tip, cap), max(ring0, inner)));
  mk = max(mk, max(ringO * 0.6, ticks * 0.8));
  mk = max(mk, max(discFill, cross * 0.6 * float(marks)));
  mk = max(mk, max(brk * gridAmount, plus * float(marks)));
  mk = max(mk, textInk());
  vec3 ink = inkColor.rgb;
  vec3 gnd = stageBackground(vUv, ink, kickEnv(ev));
  vec3 acc = accentAt((float(i) + 0.5) / n);
  vec3 col = mix(gnd, ink, mk);
  col = mix(col, acc, max(tip, cap));
  col += acc * exp(-max(dr - hj, 0.0) / max(glowRadius, px1)) * glow * 0.25 * step(0.0, dr) * step(r, 0.45) * bar.r;
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
