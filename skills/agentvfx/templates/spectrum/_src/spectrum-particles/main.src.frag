// spectrum-particles main: the particle-cloud box. A framed panel with corner brackets and a 0..5 ruler
// down the left edge; along its floor a hairline spectrum (one tick per bar, tip dot, peak dot). On every
// hit (an onset at or above hitFlux) a burst of dots launches from the bar tips of that instant with
// speed scaled by the hit's spectral flux; dots are clipped to the panel. Each of the last 8 hits owns a
// slot in partState and its particles are evaluated in closed form:
//   position = tip + v (1 - exp(-drag t)) / drag + (0, -gravity t^2 / 2)
// with hashed launch angle, speed and size, so a frame needs no simulation. Shapes: 0 square, 1 circle,
// 2 cross. Dots are ink-coloured (one tone), accent for the freshest ones; optional glow halo.
//@include stage.glsl
//@include hud.glsl

float shapeCover(vec2 d, float s) {
  if (sparkShape == 1) { return cov(length(d) - s); }
  if (sparkShape == 2) {
    vec2 a = abs(d);
    return max(cov(a.x - s * 0.18) * step(a.y, s), cov(a.y - s * 0.18) * step(a.x, s));
  }
  return cov(max(abs(d.x), abs(d.y)) - s);
}

void main() {
  vec2 res = RENDERSIZE;
  float U = hudU();
  vec4 clk = texelFetch(partState, ivec2(0, 9), 0);
  vec2 sp = vUv * res;
  vec2 px = stageUv(clk, vUv) * res;
  vec2 lo = vec2(0.14 * res.x, 0.12 * res.y);
  vec2 hi = vec2(0.94 * res.x, 0.84 * res.y);
  float W = hi.x - lo.x;
  float H = hi.y - lo.y;
  float n = float(bandCount);
  float span = introSpan();
  float grow = introK();
  float baseY = lo.y + 0.08 * H;
  float extent = 0.5 * H * grow;
  float pitch = W * 0.94 / n;
  float x0 = lo.x + W * 0.03;
  float inP = inRect(px, lo, hi);

  float fb = floor((px.x - x0) / pitch);
  float spec = 0.0;
  float tipD = 0.0;
  float capD = 0.0;
  if (fb >= 0.0 && fb < n && abs(px.x / res.x - 0.5) * 2.0 < span * 0.9 + 0.001) {
    vec4 st = texelFetch(partState, ivec2(int(fb), 8), 0);
    float bc = x0 + (fb + 0.5) * pitch;
    float hP = st.r * extent;
    spec = hair(px.x - bc) * step(baseY, px.y) * step(px.y, baseY + hP * 0.45) * barDim;
    tipD = cov(length(vec2(px.x - bc, px.y - baseY - hP * 0.45 - 3.0 * U)) - 1.4 * U) * step(0.012, st.r) * barDim;
    capD = cov(length(vec2(px.x - bc, px.y - baseY - st.g * extent * 0.45 - 6.0 * U)) - 1.2 * U) * step(0.03, st.g);
  }
  float floorLine = hair(px.y - baseY) * step(x0, px.x) * step(px.x, x0 + pitch * n) * span;

  float aspect = res.x / res.y;
  vec2 pp = vec2((px.x - lo.x) / H * 1.0, (px.y - lo.y) / H);
  float cloud = 0.0;
  float fresh = 0.0;
  float glowSum = 0.0;
  for (int j = 0; j < 8; j++) {
    vec4 meta = texelFetch(partState, ivec2(96, j), 0);
    float age = (float(FRAMEINDEX) - meta.x) * TIMEDELTA;
    if (meta.z < 0.5 || age < 0.0 || age > lifeSec) { continue; }
    float life01 = age / lifeSec;
    for (int p = 0; p < 64; p++) {
      if (p >= particleCount) { break; }
      vec2 h = hash22(vec2(float(p) * 1.618 + 3.0, meta.x * 0.731 + float(j)));
      vec2 h2 = hash22(vec2(meta.x * 1.31 + 7.0, float(p) * 2.17 + 1.0));
      int b = int(floor(h.x * n));
      float hb = texelFetch(partState, ivec2(b, j), 0).r;
      if (hb < 0.1) { continue; }
      vec2 o = vec2((x0 - lo.x + pitch * (float(b) + h.y)) / H, (baseY - lo.y + hb * extent * 0.45) / H);
      float ang = 1.5707963 + (h2.x - 0.5) * spread;
      float spd = speed * meta.y * (0.35 + 0.65 * h2.y) * (0.5 + hb);
      vec2 v = spd * vec2(cos(ang), sin(ang));
      vec2 pos = o + v * (1.0 - exp(-drag * age)) / drag + vec2(0.0, -0.5 * gravity * age * age);
      float s = particleSize * U * (0.4 + 0.6 * h.y) * (1.0 - life01 * 0.6) / H;
      vec2 d = (pp - pos) * H;
      float cv = shapeCover(d, s * H) * (1.0 - life01 * life01);
      cloud = max(cloud, cv);
      fresh = max(fresh, cv * step(age, 0.12));
      float hd = length(d) / max(s * H, 1.0);
      glowSum += (1.0 - life01) / (1.0 + hd * hd * hd * hd);
    }
  }
  cloud *= inP;
  fresh *= inP;

  float rows = 0.0;
  for (int r = 0; r <= 5; r++) {
    float yr = hi.y - float(r) * H / 5.0;
    float tk = hair(sp.y - yr) * step(lo.x - 14.0 * U, sp.x) * step(sp.x, lo.x - 4.0 * U);
    rows = max(rows, tk);
  }
  float ticksMinor = 0.0;
  for (int r = 0; r < 25; r++) {
    float yr = hi.y - float(r) * H / 25.0;
    ticksMinor = max(ticksMinor, hair(sp.y - yr) * step(lo.x - 8.0 * U, sp.x) * step(sp.x, lo.x - 4.0 * U));
  }
  float frame = boxLine(sp, lo, hi) * gridAmount;
  float brk = brackets(sp, lo - 10.0 * U, hi + 10.0 * U, 26.0 * U) * gridAmount;
  float dgrid = (hair(sp.y - (baseY + 0.25 * H)) + hair(sp.y - (baseY + 0.5 * H))) * dashes(sp.x, 8.0, 0.25) * inRect(sp, lo, hi) * 0.4 * gridAmount;
  float plus = 0.0;
  for (int c = 0; c < 4; c++) {
    vec2 centre = vec2((c & 1) == 0 ? 0.03 * res.x : 0.97 * res.x, (c & 2) == 0 ? 0.04 * res.y : 0.96 * res.y);
    plus = max(plus, plusAt(sp, centre, 8.0 * U));
  }

  vec3 ink = inkColor.rgb;
  vec3 acc = accentAt(0.5);
  vec3 col = stageBackground(vUv, ink, kickEnv(clk));
  col += acc * glowSum * glow * 0.05 * inP;
  col = mix(col, ink, max(max(rows, ticksMinor * 0.7), max(dgrid, floorLine * 0.8)) * span);
  col = mix(col, ink, max(spec, cloud));
  col = mix(col, acc, max(max(fresh, tipD), capD));
  col = mix(col, ink, max(frame, brk));
  if (marks) { col = mix(col, ink, plus); }
  col = mix(col, ink, textInk());
  fragColor = vec4(stageFinish(col, vUv), 1.0);
}
