// Threshold the picture and plant a spark at flareCenter so the ghosts have a source.

vec3 softKnee(vec3 c) {
  float br = luma(max(c, 0.0));
  float kneeW = max(threshold * knee, 1e-4);
  float soft = clamp(br - threshold + kneeW, 0.0, 2.0 * kneeW);
  soft = (soft * soft) / (4.0 * kneeW);
  float contrib = max(soft, br - threshold);
  return max(c, 0.0) * max(contrib / max(br, 1e-4), 0.0);
}

void main() {
  vec2 px = 1.5 / RENDERSIZE;
  vec3 acc = vec3(0.0);
  acc += softKnee(HAS_INPUT ? texture(inputImage, vUv).rgb : vec3(0.0)) * 4.0;
  acc += softKnee(HAS_INPUT ? texture(inputImage, vUv + px * vec2(1.0, 0.0)).rgb : vec3(0.0));
  acc += softKnee(HAS_INPUT ? texture(inputImage, vUv + px * vec2(-1.0, 0.0)).rgb : vec3(0.0));
  acc += softKnee(HAS_INPUT ? texture(inputImage, vUv + px * vec2(0.0, 1.0)).rgb : vec3(0.0));
  acc += softKnee(HAS_INPUT ? texture(inputImage, vUv + px * vec2(0.0, -1.0)).rgb : vec3(0.0));
  acc /= 8.0;
  vec2 aspect = vec2(RENDERSIZE.x / max(RENDERSIZE.y, 1.0), 1.0);
  float disk = 1.0 - smoothstep(0.004, 0.012, length((vUv - flareCenter) * aspect));
  fragColor = vec4(acc + vec3(disk * spark), 1.0);
}
