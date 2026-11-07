// rgb-split: spectral channel split with burst gating, direction jitter and horizontal band tears.
// Idea: chromatic aberration as a smear of spectral taps along an offset path (taps = 3 is the classic
// three-copy split; more taps blend the copies into a rainbow smear). Written fresh for agentvfx.
// Bursts: every 1/burstRate seconds a burst may fire (seeded by SEED); during `burstFrames` frames the
// offset is multiplied by burstBoost, the direction jumps around and rows tear sideways.
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h1(uint a) { return float(pcg(a)) / 4294967295.0; }
float h2(uint a, uint b) { return h1(a * 2654435761u + pcg(b + 1013904223u)); }
// SEED is the score seed / 2^32, so small integer seeds are tiny floats; recover the integer.
uint seedU() { return uint(min(SEED * 4294967296.0 + 0.5, 4294967040.0)); }

void main() {
  float u = RENDERSIZE.y / 1080.0;
  float fps = 1.0 / TIMEDELTA;
  uint sd = seedU();
  vec2 px = vUv * RENDERSIZE;

  // burst gate
  float ph = TIME * burstRate;
  uint bi = uint(floor(ph));
  float age = fract(ph) / max(burstRate, 0.001) * fps;
  float env = (h2(bi, sd) < burstProb && age < float(burstFrames)) ? 1.0 : 0.0;
  float k = clamp(env + audioKick, 0.0, 1.6);

  // jitter step: the offset direction and size re-roll jitterRate times per second
  uint js = uint(floor(TIME * jitterRate));
  float jr = h2(js, sd + 11u);
  float jd = h2(js, sd + 29u);
  float amt = splitAmount * u * (1.0 + burstBoost * k) * (1.0 + jitter * (jr * 2.0 - 1.0) * 0.6);

  // sample position with optional band tear
  vec2 pos = px;
  if (tear > 0.0 && k > 0.0) {
    float bandH = max(2.0, (10.0 + 90.0 * h2(js, sd + 3u))) * u;
    uint band = uint(floor(px.y / bandH));
    float on = step(h2(band, js * 31u + sd), 0.35 * min(k, 1.0));
    pos.x += on * (h2(band, js + sd + 77u) * 2.0 - 1.0) * tear * 0.12 * RENDERSIZE.x * min(k, 1.0);
  }

  // direction of the split
  vec2 dir;
  float aspect = RENDERSIZE.x / RENDERSIZE.y;
  if (splitMode == 1) {
    vec2 p = (vUv - center) * vec2(aspect, 1.0);
    float r = length(p);
    dir = p / max(r, 1e-4) * (0.35 + 1.4 * r);
  } else {
    float ang = splitAngle + (jd - 0.5) * jitter * (3.1416 * 1.2 * k + 0.5);
    dir = vec2(cos(ang), sin(ang));
  }

  vec3 acc = vec3(0.0);
  vec3 ws = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= splitTaps) break;
    float t = splitTaps > 1 ? float(i) / float(splitTaps - 1) : 0.5;
    vec3 w = vec3(max(0.0, 1.0 - 2.0 * t), 1.0 - abs(2.0 * t - 1.0), max(0.0, 2.0 * t - 1.0));
    vec2 q = pos + dir * amt * (t - 0.5) * 2.0;
    acc += w * texture(inputImage, q / RENDERSIZE).rgb;
    ws += w;
  }
  vec3 col = acc / max(ws, vec3(1e-4));

  // punch: saturation + contrast, scanlines, grain
  float lm = luma(col);
  col = mix(vec3(lm), col, saturation);
  col = max((col - 0.18) * punch + 0.18, 0.0);
  col *= 1.0 - scanlines * (0.5 + 0.5 * sin(px.y * 3.14159 / max(u, 0.25)));
  float g = h2(uint(px.x) + uint(px.y) * 4099u, uint(FRAMEINDEX) + sd);
  col += grain * (g - 0.5) * (0.4 + 0.6 * k);
  fragColor = vec4(max(col, 0.0), 1.0);
}
