// scope-polar pass1: the beam. Each pixel walks the ring table around its own polar angle (stride chosen so
// the walk spans a fixed pixel distance), takes the distance to the L and R ring polylines and turns it into
// a Gaussian beam profile. Phosphor: new = max(previous * persist, now).
// Channels: r = L beam, g = R beam, b = L fill, a = R fill.
const int K = 20;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float H = RENDERSIZE.y;
  float S = H / 1080.0;
  int wc = int(RENDERSIZE.x);
  vec2 P = gl_FragCoord.xy - 0.5 * RENDERSIZE;
  float r = length(P);
  float u = fract((atan(P.y, P.x) - spin * TIME) / 6.28318530718);
  int j0 = int(floor(u * float(wc)));
  float pxPerCol = 6.28318530718 * max(r, 8.0 * S) / float(wc);
  int stride = int(clamp(floor(1.2 / pxPerCol), 1.0, 8.0));
  float sg = max(thickness * 0.5 * S, 0.45);
  vec2 best = vec2(1.0e6);
  for (int j = -K; j < K; j++) {
    int ja = j0 + j * stride + 16 * wc;
    int ia = ja % wc;
    int ib = (ja + stride) % wc;
    vec4 ca = texelFetch(curve, ivec2(ia, 0), 0) * H;
    vec4 cb = texelFetch(curve, ivec2(ib, 0), 0) * H;
    best.x = min(best.x, segDist(P, ca.xy, cb.xy));
    best.y = min(best.y, segDist(P, ca.zw, cb.zw));
  }
  float kick = 1.0 + audioKick * (0.4 * AUDIO_BASS_ATT + 0.8 * AUDIO_ONSET);
  vec2 heat = 2.0 * kick * exp(-0.5 * best * best / (sg * sg));
  vec4 here = texelFetch(curve, ivec2(j0, 0), 0) * H;
  vec2 fl = vec2(0.0);
  if (fill > 0.0) {
    vec2 r0 = (ringRadius + 0.5 * vec2(1.0, -1.0) * stereoSeparation) * H;
    vec2 rc = vec2(length(here.xy), length(here.zw));
    vec2 d = rc - r0;
    d += (1.0 - step(vec2(1.0e-3), abs(d))) * 1.0e-3;
    vec2 t = (r - r0) / d;
    fl = fill * step(vec2(0.0), t) * step(t, vec2(1.0)) * (0.15 + 0.85 * t * t);
  }
  vec4 prev = FRAMEINDEX == 0 ? vec4(0.0) : texture(beam, vUv);
  fragColor = max(prev * persist, vec4(heat, fl));
}
