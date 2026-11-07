// vhs: analog tape. Luma/chroma separation in YIQ (chroma smears to the right and loses resolution),
// luma edge ringing, per-line wobble, a scrolling tracking-noise band of blocky static, bottom
// head-switching skew, scanlines, dropout streaks, flicker. Written fresh for agentvfx; the YIQ matrices
// are the standard NTSC ones (https://en.wikipedia.org/wiki/YIQ).
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h1(uint a) { return float(pcg(a)) / 4294967295.0; }
float h2(uint a, uint b) { return h1(a * 2654435761u + pcg(b + 1013904223u)); }
// SEED is the score seed / 2^32, so small integer seeds are tiny floats; recover the integer.
uint seedU() { return uint(min(SEED * 4294967296.0 + 0.5, 4294967040.0)); }

vec3 toYiq(vec3 c) {
  return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312)));
}
vec3 fromYiq(vec3 q) {
  return vec3(q.x + 0.956 * q.y + 0.621 * q.z, q.x - 0.272 * q.y - 0.647 * q.z, q.x - 1.106 * q.y + 1.703 * q.z);
}

void main() {
  float u = RENDERSIZE.y / 1080.0;
  uint fr = uint(FRAMEINDEX);
  uint sd = seedU();
  vec2 px = vUv * RENDERSIZE;
  float lineH = 3.0 * u;
  uint line = uint(floor(px.y / lineH));
  float kick = clamp(audioKick, 0.0, 2.0);

  // tracking band: scrolls upward, wraps; kicks make it wider and harder
  float yb = fract(trackSpeed * TIME + h1(sd + 5u));
  float hw = trackHeight * (1.0 + 0.5 * kick) * 0.5;
  float dd = abs(fract(vUv.y - yb + 0.5) - 0.5);
  float inBand = (1.0 - smoothstep(hw * 0.55, hw, dd)) * clamp(trackAmount + 0.4 * kick, 0.0, 1.5);

  // head switching: bottom rows skew sideways
  float ht = clamp(1.0 - vUv.y / max(headHeight, 0.001), 0.0, 1.0);

  float lineNoise = h2(line, fr + sd) - 0.5;
  float dx = wobble * u * (6.0 * sin(px.y / (u * 40.0) + TIME * 2.3) + 3.0 * sin(px.y / (u * 9.0) - TIME * 5.0) + 5.0 * lineNoise);
  dx += inBand * u * (140.0 * lineNoise + 50.0 * sin(px.y / (u * 7.0) + TIME * 9.0));
  dx += headSwitch * (ht * ht * ht * 0.09 * RENDERSIZE.x + ht * u * 30.0 * lineNoise);
  vec2 base = vec2(px.x + dx, px.y);

  // luma: small blur + ringing (unsharp)
  float lb = max(lumaBlur, 0.05) * u;
  float y0 = 0.0;
  float yw = 0.0;
  float yWide = 0.0;
  for (int i = -4; i <= 4; i++) {
    float w = 1.0 - abs(float(i)) / 5.0;
    vec3 s = texture(inputImage, (base + vec2(float(i) * lb, 0.0)) / RENDERSIZE).rgb;
    float yy = toYiq(s).x;
    y0 += w * yy;
    yw += w;
    yWide += yy / 9.0;
  }
  float Y = y0 / yw;
  Y += ringing * (Y - yWide);

  // chroma: exponential smear from the left, coarse
  vec2 iq = vec2(0.0);
  float cw = 0.0;
  for (int i = 0; i < 12; i++) {
    float w = exp(-float(i) * 0.3);
    vec3 s = texture(inputImage, (base - vec2(float(i) * chromaBleed * u / 12.0, 0.0)) / RENDERSIZE).rgb;
    iq += w * toYiq(s).yz;
    cw += w;
  }
  iq /= cw;
  iq *= saturation;
  iq += chromaNoise * vec2(h2(line, fr + sd + 7u) - 0.5, h2(line, fr + sd + 13u) - 0.5) * 0.25;

  vec3 col = fromYiq(vec3(Y, iq));

  // static inside the tracking band, blocky cells; head-switch noise
  float cell = 4.0 * u;
  vec2 cid = floor(px / vec2(cell * 3.0, cell));
  float sn = h2(uint(int(cid.x)) + uint(int(cid.y)) * 8209u, fr + sd);
  col = mix(col, vec3(sn * 0.9), clamp(inBand * 0.55 + ht * headSwitch * 0.5, 0.0, 0.95));
  col += inBand * 0.12 * step(0.985, h2(line, fr + sd + 3u));

  // dropout streaks
  uint chunk = uint(floor(px.x / (60.0 * u)));
  float dr = h2(line * 131u + chunk, fr + sd + 41u);
  col = mix(col, vec3(0.95), step(1.0 - dropouts * 0.008, dr) * 0.85);

  // scanlines, grain, flicker, contrast
  col *= 1.0 - scanlines * 0.5 * (0.5 + 0.5 * cos(6.2832 * px.y / lineH));
  float g = h2(uint(px.x) + uint(px.y) * 4099u, fr + sd + 91u);
  col += tapeNoise * (g - 0.5) * 0.45;
  col *= 1.0 + flicker * (h1(fr + sd) - 0.5) * 0.25;
  col = max((col - 0.18) * contrast + 0.18, 0.0);
  fragColor = vec4(col, 1.0);
}
