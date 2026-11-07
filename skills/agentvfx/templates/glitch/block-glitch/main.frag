// block-glitch: seeded pixel-block tears. Three grid scales (blockSize, x2, x4) of random-aspect blocks;
// each live block is displaced, channel-swapped, inverted, filled with a palette colour, mosaiced,
// replaced by static cells or smeared into a streak. The pattern re-seeds every holdFrames frames inside
// a burst and every burst gets its own seed, so no two bursts look alike. Bursts run on a rate, or
// lock to audio onsets / beats through the persistent trigger counter of pass0.
// Grammar reference: pixel-block tears and static in showreel graphics. Written fresh for agentvfx.
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float h1(uint a) { return float(pcg(a)) / 4294967295.0; }
float h2(uint a, uint b) { return h1(a * 2654435761u + pcg(b + 1013904223u)); }
// SEED is the score seed / 2^32, so small integer seeds are tiny floats; recover the integer.
uint seedU() { return uint(min(SEED * 4294967296.0 + 0.5, 4294967040.0)); }

struct Blk { bool on; vec4 r; vec2 lo; vec2 sz; };

Blk blockAt(vec2 px, int lvl, uint seed, float dens, float u) {
  uint ls = pcg(seed + uint(lvl) * 7919u + 17u);
  float c = blockSize * u * exp2(float(lvl));
  int shape = int(h1(ls + 1u) * 4.0);
  vec2 sz = shape == 0 ? vec2(c) : (shape == 1 ? vec2(c * 2.0, c) : (shape == 2 ? vec2(c * 5.0, c * 0.5) : vec2(c * 10.0, c * 0.25)));
  sz = max(sz, vec2(2.0 * u));
  vec2 off = vec2(h1(ls + 2u), h1(ls + 3u)) * sz;
  vec2 id = floor((px - off) / sz);
  uint idh = pcg(uint(int(id.x) + 4096) + pcg(uint(int(id.y) + 4096) + ls));
  Blk b;
  b.r = vec4(h1(idh), h1(idh + 1u), h1(idh + 2u), h1(idh + 3u));
  b.on = b.r.x < dens;
  b.lo = id * sz + off;
  b.sz = sz;
  return b;
}

// footage sample at a pixel position (wraps like a corrupted scan line), with an R/B split of f pixels
vec3 samp(vec2 pos, float f) {
  vec2 uv0 = fract(pos / RENDERSIZE);
  vec2 d = vec2(f, 0.0) / RENDERSIZE;
  return vec3(texture(inputImage, fract(uv0 + d)).r, texture(inputImage, uv0).g, texture(inputImage, fract(uv0 - d)).b);
}

vec3 perm(vec3 c, int p) {
  if (p == 0) return c.rbg;
  if (p == 1) return c.grb;
  if (p == 2) return c.gbr;
  if (p == 3) return c.brg;
  if (p == 4) return c.bgr;
  return c.ggr;
}

void main() {
  float u = RENDERSIZE.y / 1080.0;
  float fps = 1.0 / TIMEDELTA;
  uint sd = seedU();
  vec2 px = vUv * RENDERSIZE;
  vec4 cnt = texelFetch(counter, ivec2(0), 0);

  // burst clock: free-running rate, or the trigger counter when locked to audio
  float idx;
  float age;
  if (lockMode == 0) {
    float ph = TIME * burstRate;
    idx = floor(ph);
    age = fract(ph) / max(burstRate, 0.001) * fps;
  } else {
    idx = lockMode == 1 ? cnt.r : cnt.g;
    age = cnt.b;
  }
  bool seen = lockMode == 0 || idx > 0.5;
  bool burst = seen && h2(uint(idx), sd) < burstProb && age < float(burstFrames);
  float k = (burst ? 1.0 : 0.0) + audioKick;
  bool live = k > 0.05;
  uint stp = uint(floor(age / float(holdFrames)));
  uint seed = live ? pcg(uint(idx) * 2246822519u + sd) + stp * 3266489917u : pcg(sd + 99u) + uint(floor(TIME * 8.0)) * 1597334677u;
  float dens = live ? clamp(density * (0.5 + 0.5 * k), 0.0, 1.0) : idleDensity;

  // whole-frame vertical jolt on some bursts
  vec2 pos0 = px;
  if (live && h2(seed, 5u) < joltAmt * 0.5) pos0.y += (h2(seed, 6u) - 0.5) * 0.3 * RENDERSIZE.y;

  float fr = fringe * u;
  Blk hit;
  hit.on = false;
  for (int l = 2; l >= 0; l--) {
    Blk b = blockAt(px, l, seed, dens * (l == 0 ? 1.0 : (l == 1 ? 0.55 : 0.3)), u);
    if (b.on) {
      hit = b;
      break;
    }
  }

  vec3 col;
  if (!hit.on) {
    col = samp(pos0, live ? fr * 0.25 : 0.0);
  } else {
    float wTotal = shiftAmt + swapAmt + invertAmt + solidAmt + mosaicAmt + staticAmt + stretchAmt;
    float pick = hit.r.y * max(wTotal, 1e-4);
    float msz = min(hit.sz.x, hit.sz.y);
    if (pick < shiftAmt || wTotal <= 0.0) {
      float dx = (hit.r.z * 2.0 - 1.0) * (0.05 * RENDERSIZE.x + hit.sz.x * 1.2) * min(shiftAmt, 2.0);
      float dy = (hit.r.w * 2.0 - 1.0) * hit.sz.y * 0.6 * step(0.55, fract(hit.r.z * 13.7));
      col = samp(pos0 + vec2(dx, dy), fr);
    } else if ((pick -= shiftAmt) < swapAmt) {
      col = perm(samp(pos0 + vec2((hit.r.z - 0.5) * hit.sz.x, 0.0), fr * 0.5), int(hit.r.w * 6.0));
    } else if ((pick -= swapAmt) < invertAmt) {
      col = vec3(1.0) - min(samp(pos0, fr * 0.5), vec3(1.0));
    } else if ((pick -= invertAmt) < solidAmt) {
      int pi = int(floor(hit.r.z * float(max(PALETTE_COUNT, 1))));
      col = PALETTE[pi] * (0.85 + 0.6 * luma(samp(pos0, 0.0)));
    } else if ((pick -= solidAmt) < mosaicAmt) {
      float mz = max(4.0 * u, msz / (3.0 + 5.0 * hit.r.w));
      col = samp((floor(pos0 / mz) + 0.5) * mz, 0.0);
    } else if ((pick -= mosaicAmt) < staticAmt) {
      float sn = max(3.0 * u, msz / 5.0);
      vec2 cid = floor(pos0 / sn);
      float n = h2(uint(int(cid.x) + 4096) + uint(int(cid.y) + 4096) * 8209u, stp + seed);
      col = n < 0.5 ? vec3(0.012) : vec3(0.8);
      if (n > 0.9) col = PALETTE[int(floor(hit.r.z * float(max(PALETTE_COUNT, 1))))] * 1.3;
    } else {
      vec2 q = hit.r.w > 0.5 ? vec2(hit.lo.x + hit.r.z * 0.5 * hit.sz.x, pos0.y) : vec2(pos0.x, hit.lo.y + hit.r.z * 0.5 * hit.sz.y);
      col = samp(q, fr);
    }
  }

  float lm = luma(col);
  col = mix(vec3(lm), col, saturation);
  col = max((col - 0.18) * punch + 0.18, 0.0);
  float g = h2(uint(px.x) + uint(px.y) * 4099u, uint(FRAMEINDEX) + sd);
  col += grain * (g - 0.5) * (live ? 1.0 : 0.4);
  fragColor = vec4(max(col, 0.0), 1.0);
}
