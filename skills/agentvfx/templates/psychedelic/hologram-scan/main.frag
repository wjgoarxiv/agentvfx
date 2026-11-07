// hologram-scan: edge neon over a dimmed fill, scanlines, a travelling
// sweep bar, wobble, RGB fringe, per-frame flicker and grain.
// (No builtin mix() calls: `blend` is an input name.)
void main() {
  vec2 texel = vec2(1.0) / vec2(textureSize(inputImage, 0));
  vec2 wuv = vUv + vec2(sin(vUv.y * 40.0 + TIME * 3.0) * wobble, 0.0);
  vec2 cuv = clamp(wuv, 0.0, 1.0);
  float lx1 = luma(texture(inputImage, cuv - vec2(texel.x, 0.0)).rgb);
  float lx2 = luma(texture(inputImage, cuv + vec2(texel.x, 0.0)).rgb);
  float ly1 = luma(texture(inputImage, cuv - vec2(0.0, texel.y)).rgb);
  float ly2 = luma(texture(inputImage, cuv + vec2(0.0, texel.y)).rgb);
  float edge = clamp(length(vec2(lx2 - lx1, ly2 - ly1)) * edgeGain, 0.0, 1.5);
  vec2 fuv = cuv + vec2(fringe * texel.x, 0.0);
  vec2 buv = cuv - vec2(fringe * texel.x, 0.0);
  vec3 src = vec3(
    texture(inputImage, clamp(fuv, 0.0, 1.0)).r,
    texture(inputImage, cuv).g,
    texture(inputImage, clamp(buv, 0.0, 1.0)).b);
  vec3 fill = src * fillLevel;
  float scan = 0.72 + 0.28 * sin(vUv.y * RENDERSIZE.y * scanScale * 0.02418);
  float sweepY = fract(TIME * sweepSpeed * 0.25);
  float bar = exp(-pow((vUv.y - sweepY) * 9.0, 2.0));
  float fl = 1.0 - flicker * hash12(vec2(float(FRAMEINDEX), 7.0));
  vec3 col = fill * scan + neon.rgb * edge * (0.9 + 1.3 * bar);
  col = col * (0.55 + 0.45 * bar + 0.6 * edge) * fl + neon.rgb * bar * 0.25 * fl;
  col = col + vec3(hash12(vUv * RENDERSIZE + fract(TIME) * 13.0) - 0.5) * grain;
  float m = clamp(blend, 0.0, 1.0);
  vec3 base = texture(inputImage, vUv).rgb;
  fragColor = vec4(base + (max(col, 0.0) - base) * m, 1.0);
}
