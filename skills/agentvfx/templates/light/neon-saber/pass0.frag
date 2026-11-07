// HDR beam. Flicker is one value for the whole blade, seeded by time, not per-pixel noise.

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

float bracket(vec2 p, vec2 c, vec2 arm) {
  return min(sdSegment(p, c, c + vec2(arm.x, 0.0)), sdSegment(p, c, c + vec2(0.0, arm.y)));
}

void main() {
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  vec2 p = vUv * aspect;
  float d;
  if (trace > 0.5) {
    float a = 0.07;
    d = bracket(p, vec2(0.07, 0.1) * aspect, vec2(a, a) * aspect);
    d = min(d, bracket(p, vec2(0.93, 0.1) * aspect, vec2(-a, a) * aspect));
    d = min(d, bracket(p, vec2(0.07, 0.9) * aspect, vec2(a, -a) * aspect));
    d = min(d, bracket(p, vec2(0.93, 0.9) * aspect, vec2(-a, -a) * aspect));
    d = min(d, sdSegment(p, vec2(0.2, 0.5) * aspect, vec2(0.44, 0.5) * aspect));
    d = min(d, sdSegment(p, vec2(0.56, 0.5) * aspect, vec2(0.8, 0.5) * aspect));
    d = min(d, sdSegment(p, vec2(0.5, 0.24) * aspect, vec2(0.5, 0.44) * aspect));
    d = min(d, sdSegment(p, vec2(0.5, 0.56) * aspect, vec2(0.5, 0.76) * aspect));
  } else {
    d = sdSegment(p, saberA * aspect, saberB * aspect);
    float dTwin = sdSegment(p, (saberA + vec2(0.0, 0.07)) * aspect, (saberB + vec2(0.0, 0.07)) * aspect);
    d = min(d, mix(10.0, dTwin, twin));
  }
  d *= RENDERSIZE.y;
  float coreW = max(coreFrac * RENDERSIZE.y, 0.75);
  float haloW = max(haloFrac * RENDERSIZE.y, coreW * 2.0);
  float core = exp(-0.5 * (d * d) / (coreW * coreW));
  float wing = 1.0 / (1.0 + (d / haloW) * (d / haloW));
  wing *= 1.0 - smoothstep(haloW * 1.8, haloW * 3.0, d);
  float bucket = floor(TIME * flickerHz + SEED * 19.0);
  float n = hash12(vec2(bucket, 2.3));
  float fl = mix(1.0, mix(flickerFloor, 1.0, n), clamp(flicker, 0.0, 1.0));
  vec3 accent = mix(tint.rgb, paletteRamp(0.92), paletteMix);
  vec3 hdr = vec3(core) * saberGain * fl * 2.4;
  hdr += accent * wing * saberGain * fl * 0.45;
  fragColor = vec4(hdr, 1.0);
}
