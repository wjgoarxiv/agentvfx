// 3x3 tent per level, summed with per-level gains, then AgX or ACES.
// Output is display-linear; the engine encodes sRGB.

vec2 bloomTexel(float level) {
  float last = max(bloomRadius * RENDERSIZE.y / 3.0, 4.0);
  float s = level <= 0.0 ? 1.0 : max(pow(last, level / 4.0), 1.0);
  if (spread > 0.5) {
    float unit = max(bloomRadius * RENDERSIZE.y / 48.0, 1.0);
    s = level <= 0.0 ? 1.0 : unit * pow(2.0, level - 1.0);
  }
  return vec2(s) / RENDERSIZE;
}

vec3 tent(sampler2D tex, vec2 texel) {
  vec2 uv = vUv;
  vec3 c = texture(tex, uv).rgb * 4.0;
  c += texture(tex, uv + texel * vec2(-1.0,  0.0)).rgb * 2.0;
  c += texture(tex, uv + texel * vec2( 1.0,  0.0)).rgb * 2.0;
  c += texture(tex, uv + texel * vec2( 0.0, -1.0)).rgb * 2.0;
  c += texture(tex, uv + texel * vec2( 0.0,  1.0)).rgb * 2.0;
  c += texture(tex, uv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture(tex, uv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture(tex, uv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture(tex, uv + texel * vec2( 1.0,  1.0)).rgb;
  return max(c / 16.0, 0.0);
}

vec3 acesFit(vec3 x) {
  x = max(x, 0.0);
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 agxFit(vec3 x) {
  vec3 y = log2(max(x, 0.0) + 0.001);
  vec3 u = clamp((y + 7.5) / 11.0, 0.0, 1.0);
  vec3 s = u * u * (3.0 - 2.0 * u);
  return clamp(s * 1.2 - 0.05, 0.0, 1.0);
}

// Shoulder on the sum, then the base plate is put back. No added light means the source pixel.
vec3 addLight(vec3 scene, vec3 light) {
  vec3 base = max(scene, 0.0);
  vec3 hdr = base + max(light, 0.0);
  vec3 curved = toneMap == 1 ? acesFit(hdr) : agxFit(hdr);
  vec3 curvedBase = toneMap == 1 ? acesFit(base) : agxFit(base);
  return base + max(curved - curvedBase, 0.0);
}

void main() {
  vec3 bloom = vec3(0.0);
  if (probeDot > 0.5) {
    // Normalised separable gaussian of one pixel. Scale by sigma^2 so the halo
    // peak stays visible as the radius grows with the frame.
    float sigma = max(bloomRadius, 0.08) * RENDERSIZE.y * 0.5;
    bloom = max(texture(b4, vUv).rgb, 0.0) * (0.014 * 6.28318 * sigma * sigma);
  }

  vec3 scene = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  scene *= plateExposure;
  if (probeDot > 0.5) {
    vec2 mid = floor(RENDERSIZE * 0.5) + vec2(0.5);
    if (all(lessThan(abs(gl_FragCoord.xy - mid), vec2(0.5)))) scene = vec3(1.0);
  }
  // Wide levels carry the palette. The tight level stays white so the core clips hot.
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  vec3 light;
  if (probeDot > 0.5) {
    light = bloom;
  } else {
    float g0 = max(coreTrim, 0.0);
    vec3 core = tent(b0, bloomTexel(0.0)) * g0;
    float g = g0 * levelGain;
    vec3 halo = tent(b1, bloomTexel(1.0)) * g;
    g *= levelGain;
    halo += tent(b2, bloomTexel(2.0)) * g;
    g *= levelGain;
    halo += tent(b3, bloomTexel(3.0)) * g;
    g *= levelGain;
    halo += tent(b4, bloomTexel(4.0)) * g;
    float hot = smoothstep(0.55, 0.88, luma(scene));
    light = vec3(luma(core)) + accent * max(halo - core, 0.0) * (1.0 - hot);
    light *= bloomMix * bloomGain;
  }
  fragColor = vec4(addLight(scene, light), 1.0);
}
