// lattice: a full-frame dot lattice that sound physically deforms. Written fresh.
//   kick  -> a radial shockwave: points are pushed away from an origin that jumps to a new place on every kick
//   onset -> a horizontal tear: rows shear apart either side of a line (rows slide in x by their own amount)
//   highs -> per-point jitter and sparkle, new random numbers every frame
//   quiet -> no ambient motion at all: the lattice is a perfect square (or hex) grid again the same frame
// Footage only modulates dot radius, so the subject shows up inside the grid while the grid motion leads.
// Every motion is a closed form of (age of the event, release): amplitude = strength * exp(-age / release),
// so the attack is the frame of the onset and the release is the `release` parameter in seconds.
// Rendering: for a fragment, the 5x5 rest cells around it are displaced by the same function the dots use
// (tears are an exact per-row x shift, so each row looks up its own columns) and the nearest dot or
// stretched dot wins; rest positions are drawn as faint ghost points so the deformation reads against order.
const float TAU = 6.28318530718;
float U;
vec2 D;
float W;

vec2 coverUV(vec2 p) {
  vec2 tex = IMG_SIZE(inputImage);
  float ta = tex.x / tex.y;
  float wa = W / 1080.0;
  vec2 q = (p - vec2(0.5 * W, 540.0)) / vec2(W, 1080.0);
  q.y = -q.y;
  vec2 vis = wa > ta ? vec2(1.0, ta / wa) : vec2(wa / ta, 1.0);
  return clamp(0.5 + q * vis, 0.0, 1.0);
}
float toneAt(vec2 p) {
  if (mediaAmount <= 0.0) return 0.5;
  float L;
  if (HAS_INPUT) {
    vec2 o = vec2(0.28 * pitch, 0.0);
    L = 0.25 * (luma(texture(inputImage, coverUV(p + o)).rgb) + luma(texture(inputImage, coverUV(p - o)).rgb)
      + luma(texture(inputImage, coverUV(p + o.yx)).rgb) + luma(texture(inputImage, coverUV(p - o.yx)).rgb));
  } else {
    vec2 uv = p / vec2(W, 1080.0);
    L = smoothstep(0.3, 0.75, fbm(uv * 3.2 + vec2(TIME * 0.05, 0.0), 4));
  }
  L = clamp((pow(clamp(L, 0.0, 1.0), 0.4545) - 0.5) * imgContrast + 0.5 + imgBias, 0.0, 1.0);
  L = invert ? 1.0 - L : L;
  return mix(0.5, L, mediaAmount);
}
float inkAt(vec2 p) {
  if (!HAS_TEXT) return 0.0;
  vec2 o = vec2(0.3 * pitch, 0.0);
  vec2 s = vec2(1.0, -1.0) / vec2(W, 1080.0);
  vec2 uv = vec2(p.x, 1080.0 - p.y) / vec2(W, 1080.0);
  return (texture(TEXTMASK, uv).r + 0.5 * (texture(TEXTMASK, uv + o * s).r + texture(TEXTMASK, uv - o * s).r)) * 0.5;
}

// horizontal slide of a lattice row (design units); rowY is the row's rest y, rowId decorrelates rows
float tearX(float rowY, float rowId) {
  float s = 0.0;
  for (int k = 0; k < 3; k++) {
    vec4 ev = texelFetch(lat, ivec2(6 + k, 0), 0);
    if (ev.z <= 0.0) continue;
    float env = exp(-max(TIME - ev.x, 0.0) / max(release, 0.004));
    if (env < 0.004) continue;
    float dy = rowY - ev.y * 1080.0;
    float side = dy >= 0.0 ? 1.0 : -1.0;
    float rh = hash12(vec2(rowId, ev.x * 13.7));
    s += ev.w * ev.z * env * tearShear * pitch * exp(-abs(dy) / (tearSpread * 1080.0)) * (0.6 * side + (rh - 0.5) * 1.1);
  }
  return s;
}
// radial push from every live kick; swell is the local shock strength (dot radius boost)
vec2 shockAt(vec2 p0, out float swell) {
  vec2 disp = vec2(0.0);
  swell = 0.0;
  for (int k = 0; k < 4; k++) {
    vec4 ev = texelFetch(lat, ivec2(2 + k, 0), 0);
    if (ev.w <= 0.0) continue;
    float age = max(TIME - ev.x, 0.0);
    float env = exp(-age / max(release, 0.004));
    if (env < 0.004) continue;
    vec2 v = p0 - vec2(ev.y * W, ev.z * 1080.0);
    float d = length(v);
    float x = (d - 97.0 - waveSpeed * age) / (waveWidth * 1080.0);
    float prof = x > 0.0 ? exp(-x * x * 5.0) : exp(x * 0.9);
    float a = ev.w * env * prof;
    disp += (d > 1e-3 ? v / d : vec2(0.0)) * a * kickPush * pitch * smoothstep(0.0, pitch, d);
    swell += a;
  }
  float len = length(disp);
  if (len > 2.2 * pitch) disp *= 2.2 * pitch / len;
  return disp;
}

// spring between two neighbouring points: invisible at rest length, brighter the more it is stretched or
// squeezed, and cut when the points have been torn further than 2.8 pitches apart
float linkCov(vec2 a, vec2 b) {
  float l = length(b - a);
  float tens = clamp(abs(l - pitch) / pitch * 1.6, 0.0, 1.0);
  if (tens < 0.04 || l > 2.8 * pitch) return 0.0;
  vec2 pa = D - a;
  vec2 ba = b - a;
  float d = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  return links * tens * clamp(0.5 - (d * U - 0.9), 0.0, 1.0);
}

void main() {
  U = RENDERSIZE.y / 1080.0;
  W = RENDERSIZE.x / U;
  D = vec2(gl_FragCoord.x, RENDERSIZE.y - gl_FragCoord.y) / U;
  float hi = texelFetch(lat, ivec2(0, 0), 0).x;
  float fsalt = float(FRAMEINDEX) * 1.37;
  float rowH = pitch * mix(1.0, 0.866, clamp(stagger * 2.0, 0.0, 1.0));
  float rmax = pitch * 0.75 * (1.0 + kickSwell);
  float bestCov = 0.0;
  float bestHeat = 0.0;
  float bestLink = 0.0;
  int j0 = int(floor(D.y / rowH));
  int ib = int(floor(D.x / pitch)) - 4;
  vec2 above[9];
  int aboveRow[9];
  for (int k = 0; k < 9; k++) aboveRow[k] = -100000;
  for (int dj = -2; dj <= 2; dj++) {
    int j = j0 + dj;
    float restY = (float(j) + 0.5) * rowH;
    float off = stagger * pitch * float(j & 1);
    float tx = tearX(restY, float(j));
    int i0 = int(floor((D.x - tx - off) / pitch));
    vec2 left = vec2(0.0);
    bool leftOk = false;
    for (int di = -2; di <= 2; di++) {
      int i = i0 + di;
      vec2 p0 = vec2((float(i) + 0.5) * pitch + off, restY);
      float swell;
      vec2 disp = shockAt(p0, swell);
      vec2 id = vec2(float(i), float(j));
      vec2 jit = (hash22(id + fsalt) - 0.5) * 2.0 * hi * jitter * pitch;
      vec2 pl = p0 + disp + vec2(tx, 0.0);
      int slot = i - ib;
      if (links > 0.0) {
        if (leftOk) bestLink = max(bestLink, linkCov(left, pl));
        if (slot >= 0 && slot < 9) {
          if (aboveRow[slot] == j - 1 && stagger == 0.0) bestLink = max(bestLink, linkCov(above[slot], pl));
          above[slot] = pl;
          aboveRow[slot] = j;
        }
        left = pl;
        leftOk = true;
      }
      vec2 pos = pl + jit;
      vec2 trail = disp + vec2(tx, 0.0);
      float tl = length(trail);
      trail *= tl > 1e-4 ? min(tl, 1.4 * pitch) / tl * stretch * 0.5 : 0.0;
      vec2 ba = -trail;
      vec2 pa = D - pos;
      float dist = length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0));
      if (dist > rmax) continue;
      float spark = step(1.0 - sparkle * hi * 0.16, hash12(id * 1.7 + fsalt + 9.0));
      float t = inkAt(p0) * headline;
      float r = pitch * (dotBase + dotLuma * toneAt(p0)) * (1.0 + kickSwell * min(swell, 1.0)) * (1.0 + 0.5 * spark);
      if (t < 0.5 && textKnock > 0.0 && headline > 0.0) {
        float halo = max(max(inkAt(p0 + vec2(pitch, 0.0)), inkAt(p0 - vec2(pitch, 0.0))), max(inkAt(p0 + vec2(0.0, pitch)), inkAt(p0 - vec2(0.0, pitch))));
        r *= 1.0 - 0.7 * textKnock * halo;
      }
      r = max(r, pitch * 0.47 * t);
      float cov = clamp(0.5 - (dist - r) * U, 0.0, 1.0);
      if (cov > bestCov) {
        bestCov = cov;
        bestHeat = clamp(length(disp + vec2(tx, 0.0)) / pitch * 0.12 + spark + t * 0.8, 0.0, 1.0);
      }
    }
  }
  vec3 col = groundColor.rgb;
  if (ghost > 0.0) {
    float gj = floor(D.y / rowH);
    float goff = stagger * pitch * float(int(gj) & 1);
    vec2 g = vec2((floor((D.x - goff) / pitch) + 0.5) * pitch + goff, (gj + 0.5) * rowH);
    col = mix(col, mix(groundColor.rgb, dotColor.rgb, 0.45), ghost * clamp(0.5 - (length(D - g) - pitch * 0.05) * U, 0.0, 1.0));
  }
  col = mix(col, mix(dotColor.rgb, hotColor.rgb, 0.35), bestLink);
  col = mix(col, mix(dotColor.rgb, hotColor.rgb, bestHeat), bestCov);
  fragColor = vec4(col, 1.0);
}
