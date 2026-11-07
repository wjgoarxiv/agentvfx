// kaleido-fold pass0: mirror-folded kaleidoscope image max-blended over the
// previous frame sampled with a zoom + spin + hue shift (feedback trails).
// Generative marble pattern when there is no input.
void main() {
  float aspect = RENDERSIZE.x / max(RENDERSIZE.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  p = vec2(abs(p.x), p.y);
  float r = length(p);
  float seg = 6.2831853 / float(segments);
  float ang = atan(p.y, p.x);
  float sec = floor(ang / seg);
  float a = mod(ang, seg);
  if (mod(sec, 2.0) > 0.5) {
    a = seg - a;
  }
  vec2 k = vec2(cos(a), sin(a)) * r;
  vec2 suv = k / vec2(aspect, 1.0) + 0.5;
  vec3 fresh;
  float inView = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
  if (HAS_INPUT) {
    fresh = texture(inputImage, clamp(suv, 0.0, 1.0)).rgb * inView;
  } else {
    float m = fbm(vec2(r * 4.0 - TIME * 0.25, a * 2.0), 3);
    fresh = paletteCycle(fract(m + TIME * 0.03)) * (0.35 + 0.65 * m);
  }
  float sr = spin * 0.0174533;
  vec2 d = vUv - 0.5;
  vec2 fuv = vec2(d.x * cos(sr) - d.y * sin(sr), d.x * sin(sr) + d.y * cos(sr)) / zoom + 0.5;
  vec3 prevImg = texture(fold, fuv).rgb;
  vec3 hsv = rgb2hsv(prevImg);
  hsv.x = fract(hsv.x + hueSpin / 360.0);
  vec3 prevShift = hsv2rgb(hsv) * feedback;
  fragColor = vec4(max(prevShift, fresh), 1.0);
}
