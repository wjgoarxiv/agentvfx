// rgb-hit: a hit layer. Red is sampled at +offset, blue at -offset, green stays; each channel is
// integrated along its offset (taps) so the split smears into a prism instead of three ghosts.
// Rows can tear sideways, and chroma pops while the hit is live. Offsets decay to zero by hitFrames.
float hitEnv(float n, float total, float hold, float curve) {
  if (n >= total) return 0.0;
  if (n < hold) return 1.0;
  float k = (n - hold + 1.0) / (total - hold + 1.0);
  return pow(clamp(1.0 - k, 0.0, 1.0), curve);
}

// Split direction in aspect-corrected (isotropic) space; the caller scales x back to uv.
vec2 splitDir(float aspect) {
  if (style == 1 || style == 2) {
    vec2 d = vUv - center;
    d.x *= aspect;
    float l = length(d);
    vec2 u = l > 1e-5 ? d / l : vec2(1.0, 0.0);
    if (style == 2) {
      u = vec2(-u.y, u.x);
    }
    return u * (0.35 + l * 1.4);
  }
  return vec2(cos(angle), sin(angle));
}

float chan(int c, vec2 uv, vec2 o) {
  float acc = 0.0;
  for (int k = 0; k < 16; k++) {
    if (k < taps) {
      float u = taps > 1 ? float(k) / float(taps - 1) : 1.0;
      vec2 q = clamp(uv + o * u, 0.0, 1.0);
      vec3 s = texture(inputImage, q).rgb;
      acc += c == 0 ? s.r : (c == 1 ? s.g : s.b);
    }
  }
  return acc / float(taps);
}

void main() {
  float aspect = RENDERSIZE.x / max(RENDERSIZE.y, 1.0);
  float n = floor(TIME / TIMEDELTA + 0.5);
  float env = hitEnv(n, float(hitFrames), float(holdFrames), decayCurve);
  if (env <= 0.0) {
    fragColor = vec4(texture(inputImage, vUv).rgb, 1.0);
    return;
  }
  float jit = 1.0 + jitter * (hash12(vec2(n, 29.0)) - 0.5) * 1.2;
  vec2 o = splitDir(aspect) * amount * env * jit * vec2(1.0 / aspect, 1.0);
  vec2 uv = vUv;
  if (tearRows > 0) {
    float row = floor(vUv.y * float(tearRows));
    float r = hash12(vec2(row, n * 1.37 + 5.0));
    if (r > 0.55) {
      float sgn = hash12(vec2(row, n + 71.0)) > 0.5 ? 1.0 : -1.0;
      uv.x += sgn * (r - 0.55) / 0.45 * tearAmount * env;
    }
  }
  vec3 col = vec3(chan(0, uv, o), chan(1, uv, vec2(0.0)), chan(2, uv, -o));
  float l = luma(col);
  col = vec3(l) + (col - vec3(l)) * mix(1.0, pop, env);
  fragColor = vec4(max(col, 0.0), 1.0);
}
