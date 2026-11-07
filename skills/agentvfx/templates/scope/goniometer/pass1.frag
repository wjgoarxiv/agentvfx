// goniometer pass1: the phosphor. Gaussian beam segment integral per segment (woscope model, intensity
// ~ 1/segment length) accumulated onto the decayed previous frame. style 1 draws each sample as a dot.
float erfa(float x) {
  float s = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * x);
  float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
  return s * y;
}

void main() {
  float H = RENDERSIZE.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / H;
  float sg = beamWidth / 1080.0;
  float cut = 4.0 * sg;
  int cols = int(min(RENDERSIZE.x, 512.0));
  float acc = 0.0;
  for (int k = 0; k < 511; k++) {
    vec4 s = texelFetch(pts, ivec2(k % cols, k / cols), 0);
    vec2 a = s.xy;
    vec2 b = style == 1 ? a : s.zw;
    vec2 lo = min(a, b) - cut;
    vec2 hi = max(a, b) + cut;
    if (p.x < lo.x || p.y < lo.y || p.x > hi.x || p.y > hi.y) continue;
    vec2 d = b - a;
    float l = length(d);
    vec2 q = p - a;
    if (l < 0.05 * sg) {
      vec2 m = q - 0.5 * d;
      acc += exp(-dot(m, m) / (2.0 * sg * sg));
    } else {
      vec2 dir = d / l;
      float x = dot(q, dir);
      float y = dot(q, vec2(-dir.y, dir.x));
      float inv = 0.70710678 / sg;
      acc += exp(-y * y / (2.0 * sg * sg)) * 1.2533141 * sg * (erfa(x * inv) - erfa((x - l) * inv)) / l;
    }
  }
  float kick = 1.0 + audioKick * (0.6 * AUDIO_BASS_ATT + 1.2 * AUDIO_ONSET);
  float prev = FRAMEINDEX == 0 ? 0.0 : texture(beam, vUv).r;
  float heat = max(prev * persistence - 0.0002, 0.0) + acc * intensity * kick * (1.0 - 0.6 * persistence);
  fragColor = vec4(heat, 0.0, 0.0, 1.0);
}
