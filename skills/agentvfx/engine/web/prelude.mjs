// agentvfx (Apache-2.0, see LICENSE). The GLSL prelude prepended to every template pass, and the program source
// builder. Contract: references/template-format.md. Importable in Node (tests) and in the page.
// Helper credits: value noise and fbm after The Book of Shaders ch.11/13 (https://thebookofshaders.com),
// cosine palette after Inigo Quilez (https://iquilezles.org/articles/palettes/), hsv conversions after
// Sam Hocevar's public-domain formulation; all re-written here.

/** Score seed (integer) -> SEED uniform in [0, 1): an integer hash so nearby seeds give unrelated values. */
export function seedToUnit(seed) {
  let x = seed >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const PRELUDE_HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
uniform float TIME;
uniform float TIMEDELTA;
uniform int FRAMEINDEX;
uniform int PASSINDEX;
uniform vec2 RENDERSIZE;
uniform float SEED;
uniform sampler2D inputImage;
uniform bool HAS_INPUT;
uniform vec3 PALETTE[8];
uniform int PALETTE_COUNT;
uniform float AUDIO_RMS, AUDIO_PEAK, AUDIO_BASS, AUDIO_MID, AUDIO_TREB, AUDIO_BASS_ATT, AUDIO_MID_ATT,
              AUDIO_TREB_ATT, AUDIO_FLUX, AUDIO_ONSET, AUDIO_BEAT, AUDIO_BEATPHASE, AUDIO_BPM;
uniform sampler2D audio;
uniform sampler2D audioFFT;
uniform float AUDIO_BANDS[32];
uniform sampler2D TEXTMASK;   // engine text layer: R = glyph/line ink, G = solid box/bar fill (0..1); items with channel g or b draw their glyph ink into G or B
uniform bool HAS_TEXT;
#define isf_FragNormCoord vUv
#define IMG_NORM_PIXEL(img, uv) texture(img, uv)
#define IMG_THIS_NORM_PIXEL(img) texture(img, vUv)
#define IMG_PIXEL(img, px) texture(img, (px) / vec2(textureSize(img, 0)))
#define IMG_THIS_PIXEL(img) texture(img, vUv)
#define IMG_SIZE(img) vec2(textureSize(img, 0))
`;

export const PRELUDE_HELPERS = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + SEED * 17.17);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973) + SEED * 17.17);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += a * vnoise(p);
    norm += a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31;
    a *= 0.5;
  }
  return norm > 0.0 ? v / norm : 0.0;
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(6.28318530718 * (c * t + d)); }
vec3 paletteRamp(float t) {
  int n = max(PALETTE_COUNT, 1);
  if (n == 1) return PALETTE[0];
  float x = clamp(t, 0.0, 1.0) * float(n - 1);
  int i = int(floor(x));
  int j = min(i + 1, n - 1);
  return mix(PALETTE[i], PALETTE[j], x - float(i));
}
vec3 paletteCycle(float t) {
  int n = max(PALETTE_COUNT, 1);
  float x = fract(t) * float(n);
  int i = int(floor(x)) % n;
  int j = (i + 1) % n;
  return mix(PALETTE[i], PALETTE[j], x - floor(x));
}
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 linearToSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, s, -s, c); }
`;

const UNIFORM_TYPE = { float: "float", long: "int", bool: "bool", color: "vec4", point2D: "vec2", image: "sampler2D", audio: "sampler2D", audioFFT: "sampler2D" };

/** Fragment source for one pass: prelude + input uniforms + target samplers + the template body. */
export function buildFragment({ inputs = [], targets = [], body }) {
  const decl = inputs.filter((i) => UNIFORM_TYPE[i.TYPE] && !["inputImage", "audio", "audioFFT"].includes(i.NAME))
    .map((i) => `uniform ${UNIFORM_TYPE[i.TYPE]} ${i.NAME};`);
  const tdecl = targets.map((t) => `uniform sampler2D ${t};`);
  return `${PRELUDE_HEAD}${decl.join("\n")}\n${tdecl.join("\n")}\n${PRELUDE_HELPERS}\n#line 1\n${body}\n`;
}

/** The output pass: linear light -> sRGB with a seeded sub-LSB dither, drawn to the canvas. */
export const OUTPUT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D src;
uniform int FRAMEINDEX;
uniform float SEED;
float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031 + SEED * 3.7); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 c = toSrgb(texture(src, vUv).rgb);
  float d = h(gl_FragCoord.xy + float(FRAMEINDEX % 64) * 7.0) - 0.5;
  fragColor = vec4(c + d / 255.0, 1.0);
}`;
