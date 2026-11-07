// scope-triggered pass1: the beam. Each pixel finds its distance to the L and R trace polylines (columns
// of the curve table, 1 px apart) and turns it into a Gaussian beam profile, dimmed where the trace is
// steep (an analog beam sweeps a steep edge fast). Phosphor: new = max(previous * persist, now).
// Channels: r = L beam, g = R beam, b = L fill, a = R fill.
const int K = 22;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float H = RENDERSIZE.y;
  float S = H / 1080.0;
  int wi = int(RENDERSIZE.x);
  vec2 P = gl_FragCoord.xy;
  int x0 = int(P.x);
  float sg = max(thickness * 0.5 * S, 0.45);
  vec2 best = vec2(1.0e6);
  vec2 slope = vec2(0.0);
  for (int j = -K; j < K; j++) {
    int xa = x0 + j;
    vec4 ca = texelFetch(curve, ivec2(clamp(xa, 0, wi - 1), 0), 0);
    vec4 cb = texelFetch(curve, ivec2(clamp(xa + 1, 0, wi - 1), 0), 0);
    if (ca.z < 0.5 || cb.z < 0.5) continue;
    float xA = float(xa) + 0.5;
    float yLa = (0.5 + ca.x) * H;
    float yLb = (0.5 + cb.x) * H;
    float yRa = (0.5 + ca.y) * H;
    float yRb = (0.5 + cb.y) * H;
    float dl = segDist(P, vec2(xA, yLa), vec2(xA + 1.0, yLb));
    float dr = segDist(P, vec2(xA, yRa), vec2(xA + 1.0, yRb));
    if (dl < best.x) { best.x = dl; slope.x = abs(yLb - yLa); }
    if (dr < best.y) { best.y = dr; slope.y = abs(yRb - yRa); }
  }
  float kick = 1.0 + audioKick * (0.4 * AUDIO_BASS_ATT + 0.8 * AUDIO_ONSET);
  vec2 heat = 2.0 * kick * exp(-0.5 * best * best / (sg * sg)) / (1.0 + speedDim * slope / S);
  vec4 here = texelFetch(curve, ivec2(clamp(x0, 0, wi - 1), 0), 0);
  vec2 fl = vec2(0.0);
  if (fill > 0.0 && here.z > 0.5) {
    vec2 yc = (0.5 + 0.5 * vec2(1.0, -1.0) * stereoSeparation) * H;
    vec2 yt = (0.5 + here.xy) * H;
    vec2 t = (P.y - yc) / (yt - yc + vec2(1.0e-3));
    fl = fill * step(vec2(0.0), t) * step(t, vec2(1.0)) * (0.15 + 0.85 * t * t);
  }
  vec4 prev = FRAMEINDEX == 0 ? vec4(0.0) : texture(beam, vUv);
  fragColor = max(prev * persist, vec4(heat, fl));
}
