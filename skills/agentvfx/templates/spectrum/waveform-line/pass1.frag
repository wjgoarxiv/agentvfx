// waveform-line pass 1: draw the 512-sample waveform (audio texture row 0, trigger aligned) into the
// persistent `trace` buffer. trace = max(previous * echo, this frame's line): the line leaves a fading
// echo of itself. rgb = colour * coverage, a = coverage. Display: 0 digital (LED columns filled from
// the centre line), 1 lines (thick polyline, exact distance to the 14 nearest segments), 2 dots.
float waveAt(float x, float x0, float span) {
  float w = 0.0;
  for (int k = -2; k <= 2; k++) {
    w += texture(audio, vec2(clamp((x - x0) / span + float(k) * smoothWin / 512.0, 0.0, 1.0), 0.25)).r;
  }
  return amplitude * tanh(gain * (w * 0.4 - 1.0));
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1.0e-6), 0.0, 1.0));
}

vec3 shade(float t, float u) {
  vec3 c = colorMode == 1 ? paletteCycle(u + paletteShift + TIME * 0.05) : (colorMode == 2 ? paletteRamp(t) : mix(insideColor.rgb, outsideColor.rgb, t));
  if (hueInterpolation != 0.0) {
    vec3 h = rgb2hsv(c);
    h.x = fract(h.x + hueInterpolation * u);
    c = hsv2rgb(h);
  }
  return c;
}

void main() {
  vec2 res = RENDERSIZE;
  vec2 px = vUv * res;
  float unit = res.y / 1080.0;
  vec4 ev = texelFetch(clock, ivec2(0, 0), 0);
  float since = ev.x > 0.5 ? (float(FRAMEINDEX) - ev.y) * TIMEDELTA : 99.0;
  float hit = step(0.5, exp(-since / 0.1)) * hitBoost;
  float x0 = res.x * 0.03;
  float span = res.x * 0.94;
  float mid = res.y * 0.5;
  float th = max(thickness * unit * (1.0 + hit), 1.0);
  float cov = 0.0;
  float amp = 0.0;
  float u = clamp((px.x - x0) / span, 0.0, 1.0);
  for (int side = 0; side < 2; side++) {
    float sgn = side == 0 ? 1.0 : -1.0;
    if (side == 1 && !mirror) break;
    if (displayMode == 1) {
      float step1 = max(span / 512.0, 1.0);
      float dmin = 1.0e9;
      vec2 prevPt = vec2(px.x - 7.0 * step1, mid + sgn * waveAt(px.x - 7.0 * step1, x0, span) * res.y);
      for (int k = -6; k <= 7; k++) {
        float xk = px.x + float(k) * step1;
        vec2 pt = vec2(xk, mid + sgn * waveAt(xk, x0, span) * res.y);
        dmin = min(dmin, segDist(px, prevPt, pt));
        prevPt = pt;
      }
      cov = max(cov, clamp(th * 0.5 - dmin + 0.5, 0.0, 1.0) * (px.x >= x0 && px.x <= x0 + span ? 1.0 : 0.0));
      amp = max(amp, abs(waveAt(px.x, x0, span)) / max(amplitude, 0.001));
    } else {
      float cell = max(span / float(columns), 2.0);
      float c = floor((px.x - x0) / cell);
      float xc = x0 + (c + 0.5) * cell;
      float w = sgn * waveAt(xc, x0, span) * res.y;
      float dyv = px.y - mid;
      vec2 lp = vec2(px.x - xc, dyv);
      amp = max(amp, abs(w) / max(amplitude * res.y, 1.0));
      if (px.x >= x0 && px.x <= x0 + span) {
        if (displayMode == 0) {
          float rowH = cell;
          float rr = floor(abs(dyv) / rowH);
          bool lit = dyv * w >= 0.0 && abs(dyv) <= abs(w) + rowH * 0.5;
          float inCell = abs(dyv) - rr * rowH;
          float blk = clamp(0.5 - max(abs(lp.x) - cell * (0.5 - 0.08), abs(inCell - rowH * 0.5) - rowH * 0.42), 0.0, 1.0);
          cov = max(cov, lit ? blk : 0.0);
        } else {
          float rad = max(cell * 0.5 * (0.35 + 0.65 * min(abs(w) / (amplitude * res.y), 1.0)), th * 0.5);
          cov = max(cov, clamp(rad - length(vec2(lp.x, dyv - w)) + 0.5, 0.0, 1.0));
        }
      }
    }
  }
  vec3 line = shade(clamp(amp * amp, 0.0, 1.0) * 0.6, u);
  line = mix(line, vec3(1.4), hit);
  vec4 prev = texelFetch(trace, ivec2(gl_FragCoord.xy), 0);
  vec4 cur = vec4(line * cov, cov);
  fragColor = max(prev * echo, cur);
}
