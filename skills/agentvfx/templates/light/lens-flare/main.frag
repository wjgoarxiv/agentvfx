// Ghosts are sharp polygons along the flare axis, with a chromatic rim.
// The picture is not resampled into a veil. A thin ring and a hard starburst sit on the source.

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

vec3 addLight(vec3 scene, vec3 light) {
  vec3 base = max(scene, 0.0);
  vec3 hdr = base + max(light, 0.0);
  vec3 curved = toneMap == 1 ? acesFit(hdr) : agxFit(hdr);
  vec3 curvedBase = toneMap == 1 ? acesFit(base) : agxFit(base);
  return base + max(curved - curvedBase, 0.0);
}

float polyDist(vec2 p, float sides) {
  float a = atan(p.y, p.x);
  float s = 6.2831853 / sides;
  return cos(floor(0.5 + a / s) * s - a) * length(p);
}

float shell(float d, float rad) {
  float w = max(1.75 / max(RENDERSIZE.y, 1.0), rad * 0.07);
  return smoothstep(rad - w, rad - w * 0.3, d) * (1.0 - smoothstep(rad, rad + w * 0.55, d));
}

void main() {
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  vec2 from = vUv - flareCenter;
  float src = luma(texture(flareSrc, flareCenter).rgb);
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  vec2 axis = vec2(0.5) - flareCenter;
  vec3 ghosts = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float t = mix(-0.9, 1.55, float(i) / 4.0);
    vec2 gc = flareCenter + axis * t;
    float sides = float(3 + i);
    float rad = 0.016 + 0.007 * float(i);
    float spin = 0.55 * float(i);
    float cs = cos(spin);
    float sn = sin(spin);
    vec2 p = (vUv - gc) * aspect;
    p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
    vec2 shift = vec2(chromaAmt * 0.012 * float(i + 1), 0.0);
    float edge = shell(polyDist(p, sides), rad);
    vec3 fringe = vec3(
      shell(polyDist(p + shift, sides), rad),
      edge * 0.2,
      shell(polyDist(p - shift, sides), rad)
    );
    ghosts += vec3(edge) * 1.15 + accent * fringe;
  }
  ghosts *= ghostGain * clamp(src, 0.35, 2.2) * 0.2;

  float dist = length(from * aspect);
  float halo = exp(-pow((dist - haloRadius) / 0.011, 2.0));
  vec3 haloCol = accent * halo * haloGain * clamp(src, 0.2, 2.0);

  float ang = atan(from.y, from.x);
  float spikes = pow(abs(sin(ang * float(spikeCount) * 0.5)), spikePower);
  float burst = spikes * exp(-dist * 11.0);
  vec3 burstCol = mix(accent, vec3(1.0), 0.65) * burst * burstGain * clamp(src, 0.2, 2.0);

  float core = 1.0 - smoothstep(0.0, 0.008, dist);
  vec3 light = ghosts + haloCol + burstCol + vec3(core) * (1.2 + spark);
  if (eyeBar > 0.5) {
    float y = (vUv.y - flareCenter.y) * RENDERSIZE.y;
    float xMask = smoothstep(0.03, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 0.97, vUv.x));
    float bar = exp(-0.5 * y * y / 220.0) * xMask;
    float hi = exp(-0.5 * (y - 22.0) * (y - 22.0) / 36.0) * xMask;
    float lo = exp(-0.5 * (y + 22.0) * (y + 22.0) / 36.0) * xMask;
    float core = smoothstep(0.1, 0.5, bar);
    light = vec3(core) * 9.0 + accent * (hi + lo) * (1.0 - core) * 2.6;
  }
  vec3 scene = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0);
  scene *= plateExposure;
  fragColor = vec4(addLight(scene, light * flareMix), 1.0);
}
