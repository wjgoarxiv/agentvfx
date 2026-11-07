// scope-triggered main: one field colour per shot (fieldMode); L trace in the full line colour, R trace at 60%,
// optional fills, then the HUD chrome mask and the engine text layer. Bloom is subtle and only on dark grounds.
vec3 sc(vec3 s) { return srgbToLinear(s); }

void fieldColors(out vec3 bg, out vec3 ink) {
  if (fieldMode == 1) { bg = sc(vec3(0.784, 1.0, 0.0)); ink = sc(vec3(0.043)); }
  else if (fieldMode == 2) { bg = sc(vec3(0.078, 0.078, 1.0)); ink = sc(vec3(0.95, 0.95, 0.93)); }
  else if (fieldMode == 3) { bg = sc(vec3(0.016)); ink = sc(vec3(0.224, 1.0, 0.078)); }
  else if (fieldMode == 4) { bg = sc(vec3(1.0, 0.235, 0.0)); ink = sc(vec3(0.04, 0.04, 0.62)); }
  else { bg = sc(vec3(0.043)); ink = sc(vec3(0.914, 0.914, 0.894)); }
}

void main() {
  vec3 bg;
  vec3 ink;
  fieldColors(bg, ink);
  vec2 lo = vec2(0.21, 0.16);
  vec2 hi = vec2(0.79, 0.84);
  vec2 d = abs(vUv - 0.5 * (lo + hi)) / (0.5 * (hi - lo));
  float clip = step(max(d.x, d.y), 1.0);
  vec4 b = texture(beam, vUv);
  vec4 g1 = texture(bv1, vUv);
  vec4 g2 = texture(bv2, vUv);
  float core = clamp(max(b.r, 0.6 * b.g) * exposure, 0.0, 1.0) * clip;
  float fl = clamp(max(b.b, 0.7 * b.a) * 0.35, 0.0, 1.0) * clip;
  float gl = bloom * exposure * (0.5 * max(g1.r, g1.g) + 0.9 * max(g2.r, g2.g));
  float glow = (1.0 - exp(-gl)) * clip;
  vec4 h = texture(hudMask, vUv);
  vec4 t = HAS_TEXT ? texture(TEXTMASK, vUv) : vec4(0.0);
  float chrome = clamp(h.r + 0.4 * h.g, 0.0, 1.0) * hud;
  float k = 1.0 - (1.0 - max(core, fl)) * (1.0 - chrome) * (1.0 - t.r * hud);
  vec3 col = mix(bg, ink, k);
  if (fieldMode == 0 || fieldMode == 3) col += ink * glow * 0.8 + vec3(1.0) * pow(core, 3.0) * hot;
  else col = mix(col, ink, glow * 0.35);
  fragColor = vec4(col, 1.0);
}
