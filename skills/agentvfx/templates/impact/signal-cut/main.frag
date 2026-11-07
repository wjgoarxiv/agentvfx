// signal-cut: the whole frame is the instrument. Frequency bands are full-height vertical slabs whose
// widths come from their energy; each slab slides, inverts or turns into a field-colour duotone by its own
// level. On a beat the frame hard-cuts to one solid field colour for cutFrames frames with the loud slabs
// left as holes (negative space), and a giant engine-text numeral stamps in for stampFrames frames.
// Original design; no algorithm is borrowed beyond the stock helpers of the prelude.
const int MAXS = 32;
const int STATE_BEAT_X = 40;

float edgeAt(int k) { return texelFetch(sigState, ivec2(k, 1), 0).r; }

// The contrast curve below works per channel, so on warm footage it crushes green and blue to zero and invents a
// saturated red (R / (R + G + B) >= 0.8, colours here are linear) that a scene cut turns into a red flash. Pixels the
// curve pushes that far keep the footage's own colour at the graded brightness; the rest take the curve unchanged.
const vec2 RED_SHARE = vec2(0.7, 0.78);
vec3 gradeFootage(vec3 c) {
  vec3 graded = max((c - 0.12) * slabContrast + 0.12, 0.0);
  float share = graded.r / max(graded.r + graded.g + graded.b, 1e-4);
  vec3 o = mix(graded, c * luma(graded) / max(luma(c), 1e-4), smoothstep(RED_SHARE.x, RED_SHARE.y, share));
  // Footage that is itself deep red (a lit red dress) still reads as saturated red, and the cut shows it for only a
  // frame or two between field states, so it flashes red. Lift green and blue just enough to cap the red share.
  float lift = max(o.r * (1.0 / RED_SHARE.y - 1.0) - o.g - o.b, 0.0) * 0.5;
  return o + vec3(0.0, lift, lift);
}

// footage frame (any aspect) cover-fitted into the output frame; vertical wrap, mirrored horizontal wrap
vec3 footAt(vec2 uv) {
  uv.y = fract(uv.y);
  uv.x = 1.0 - abs(1.0 - mod(uv.x, 2.0));
  vec2 tex = IMG_SIZE(inputImage);
  float ta = tex.x / tex.y;
  float fa = RENDERSIZE.x / RENDERSIZE.y;
  vec2 vis = fa > ta ? vec2(1.0, ta / fa) : vec2(fa / ta, 1.0);
  return gradeFootage(texture(inputImage, 0.5 + (uv - 0.5) * vis).rgb);
}

void main() {
  float U = RENDERSIZE.y / 1080.0;
  float xf = gl_FragCoord.x / RENDERSIZE.x;
  vec4 beatSt = texelFetch(sigState, ivec2(STATE_BEAT_X, 0), 0);
  float since = beatSt.r;
  float cnt = beatSt.g;

  int idx = slabs - 1;
  float eL = 0.0;
  float eR = 1.0;
  float prevEdge = 0.0;
  for (int i = 0; i < MAXS; i++) {
    if (i >= slabs) break;
    float r = edgeAt(i + 1);
    if (xf < r) { idx = i; eL = prevEdge; eR = r; break; }
    prevEdge = r;
    eL = r;
  }
  float e = texelFetch(sigState, ivec2(idx, 0), 0).r;

  // slab content: slides vertically and jumps sideways by its own quantised energy; directions reshuffle per beat
  float qe = floor(e * 10.0 + 0.5) / 10.0;
  float dirY = hash12(vec2(float(idx), cnt)) > 0.5 ? 1.0 : -1.0;
  float jx = hash12(vec2(float(idx) + 11.0, cnt + 3.0)) - 0.5;
  vec2 uv = vUv;
  bool live = e >= actAt;
  if (live) {
    float amt = pow(qe, 0.6);
    uv.y += dirY * amt * shiftY;
    uv.x += jx * amt * shiftX;
  }
  vec3 foot = HAS_INPUT ? footAt(uv) : vec3(0.0);
  float sL = sqrt(clamp(luma(foot), 0.0, 1.0));

  // tiers: dim idle, bright sliding, negative, field-colour duotone
  vec3 col = foot * (live ? 1.0 : idleDim);
  if (e >= invAt) col = max(vec3(1.0) - col, 0.0);
  float onField = 0.0;
  if (e >= duoAt) { col = mix(inkColor.rgb, fieldColor.rgb, sL); onField = 1.0; }

  // hairline slits between slabs, never at the frame edge
  float dpx = min(idx > 0 ? (xf - eL) : 1e3, idx < slabs - 1 ? (eR - xf) : 1e3) * RENDERSIZE.x;
  if (dpx < slitPx * U * 0.5) col = inkColor.rgb;

  // beat cut: solid field colour, loud slabs are the holes; second frame inverts the roles
  if (fieldCut > 0.001 && since < float(cutFrames) - 0.5) {
    bool second = since > 0.5;
    float u = (xf - eL) / max(eR - eL, 1e-4);
    float open = clamp((e - cutKeep) / max(1.0 - cutKeep, 0.01), 0.0, 1.0);
    bool hole = abs(u - 0.5) <= 0.5 * open;
    vec3 holeCol = second ? mix(inkColor.rgb, fieldColor.rgb, sL) : mix(inkColor.rgb, paperColor.rgb, sL);
    vec3 cutCol = hole ? holeCol : (second ? inkColor.rgb : fieldColor.rgb);
    col = mix(col, cutCol, fieldCut);
    onField = (hole ? (second ? 1.0 : 0.0) : (second ? 0.0 : 1.0));
  }

  // stamp: a giant numeral from the engine text layer, hard cut in on the beat, alternate beats punch in
  if (HAS_TEXT && since < float(stampFrames) - 0.5) {
    float zoom = mod(cnt, 2.0) < 0.5 ? 1.0 : stampZoom;
    vec2 piv = vec2(stampPivotX, stampPivotY);
    float m = smoothstep(0.35, 0.65, texture(TEXTMASK, piv + (vUv - piv) / zoom).r);
    vec3 sc = onField > 0.5 ? inkColor.rgb : fieldColor.rgb;
    col = mix(col, sc, m);
  }
  fragColor = vec4(col, 1.0);
}
