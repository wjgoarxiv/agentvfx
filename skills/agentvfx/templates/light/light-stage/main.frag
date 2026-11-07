// Near-black ground. Hairlines stay under the highlight knee. Hot points are the only emitters.

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  return length(pa - ba * h);
}

float stroke(float d) {
  float w = 1.25 / max(RENDERSIZE.y, 1.0);
  return 1.0 - smoothstep(w * 0.45, w * 1.35, d);
}

float bracket(vec2 p, vec2 c, vec2 arm) {
  return min(seg(p, c, c + vec2(arm.x, 0.0)), seg(p, c, c + vec2(0.0, arm.y)));
}

void main() {
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  vec2 p = (vUv - 0.5) * aspect + 0.5;
  vec3 col = HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.003);
  float ink = 0.0;
  float arm = 0.055;
  ink = max(ink, stroke(bracket(p, vec2(0.06, 0.08), vec2(arm, arm))));
  ink = max(ink, stroke(bracket(p, vec2(0.94, 0.08), vec2(-arm, arm))));
  ink = max(ink, stroke(bracket(p, vec2(0.06, 0.92), vec2(arm, -arm))));
  ink = max(ink, stroke(bracket(p, vec2(0.94, 0.92), vec2(-arm, -arm))));
  ink = max(ink, stroke(seg(p, vec2(0.5, 0.22), vec2(0.5, 0.44))));
  ink = max(ink, stroke(seg(p, vec2(0.5, 0.56), vec2(0.5, 0.78))));
  ink = max(ink, stroke(seg(p, vec2(0.38, 0.5), vec2(0.46, 0.5))));
  ink = max(ink, stroke(seg(p, vec2(0.54, 0.5), vec2(0.62, 0.5))));
  ink = max(ink, stroke(seg(p, vec2(0.08, 0.2), vec2(0.08, 0.8))));
  ink = max(ink, stroke(seg(p, vec2(0.92, 0.2), vec2(0.92, 0.8))));
  ink = max(ink, stroke(seg(p, vec2(0.08, 0.2), vec2(0.22, 0.2))));
  ink = max(ink, stroke(seg(p, vec2(0.08, 0.8), vec2(0.22, 0.8))));
  ink = max(ink, stroke(seg(p, vec2(0.78, 0.2), vec2(0.92, 0.2))));
  ink = max(ink, stroke(seg(p, vec2(0.78, 0.8), vec2(0.92, 0.8))));
  if (rule > 0.5) {
    for (int i = 0; i < 18; i++) {
      float x0 = 0.18 + float(i) * 0.036;
      ink = max(ink, stroke(seg(p, vec2(x0, 0.9), vec2(x0 + 0.016, 0.9))));
    }
  }
  col = max(col, vec3(0.16) * ink);
  if (hotPoints > 0.5) {
    float d0 = length((vUv - vec2(0.32, 0.62)) * aspect);
    float d1 = length((vUv - vec2(0.5, 0.42)) * aspect);
    float d2 = length((vUv - vec2(0.7, 0.66)) * aspect);
    float r0 = 0.005 * pointScale;
    float r1 = 0.012 * pointScale;
    float disk = max(1.0 - smoothstep(r0, r1, d0), max(1.0 - smoothstep(r0, r1, d1), 1.0 - smoothstep(r0, r1, d2)));
    col = max(col, vec3(disk));
  }
  fragColor = vec4(col, 1.0);
}
