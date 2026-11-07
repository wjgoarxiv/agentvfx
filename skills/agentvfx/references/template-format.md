# Template format

A template is a folder `templates/<family>/<id>/` with:

- `fx.json`: ISF 2.0-compatible JSON plus one namespaced key `X_AGENTVFX`
- `main.frag`: the last (or only) pass
- optional `pass0.frag`, `pass1.frag`, ...: earlier passes, in `PASSES` order
- optional `demo-<preset>.json`: FX scores that render the gallery clips

`vfx.mjs validate` checks every template; `vfx.mjs list` shows them.

## fx.json

```json
{
  "DESCRIPTION": "one line: what it looks like",
  "CREDIT": "agentvfx",
  "ISFVSN": "2",
  "CATEGORIES": ["psychedelic"],
  "INPUTS": [
    { "NAME": "tideSpeed", "TYPE": "float", "MIN": 0, "MAX": 3, "DEFAULT": 0.6 },
    { "NAME": "tideWaves", "TYPE": "long", "MIN": 1, "MAX": 3, "DEFAULT": 2 },
    { "NAME": "halo", "TYPE": "bool", "DEFAULT": false },
    { "NAME": "tint", "TYPE": "color", "DEFAULT": [1, 0, 0.5, 1] },
    { "NAME": "center", "TYPE": "point2D", "DEFAULT": [0.5, 0.5] }
  ],
  "PASSES": [
    { "TARGET": "smoothLuma", "FLOAT": true },
    { "TARGET": "trail", "PERSISTENT": true, "FLOAT": true },
    {}
  ],
  "X_AGENTVFX": {
    "id": "sacred",
    "family": "psychedelic",
    "input": "footage",
    "spdx": "LicenseRef-agentvfx",
    "flash": "none",
    "fps": 30,
    "palette": true,
    "presets": { "a": { "tideSpeed": 0.4 }, "b": {}, "c": {} },
    "audioBind": { "tideSpeed": "bass" },
    "safeSubstitute": { "params": { "flashAmount": 0 } },
    "credits": ["iq cosine palette, https://iquilezles.org/articles/palettes/"]
  }
}
```

- INPUT types: `float`, `long` (int; optional `VALUES` / `LABELS`), `bool`, `color` (`[r,g,b,a]` 0..1, sRGB),
  `point2D`, `image`, `audio`, `audioFFT`.
- `X_AGENTVFX.input`: `generative` (no clip), `footage` (needs `input.video`), `either`.
- `spdx`: LicenseRef-agentvfx (the agentvfx licence, the library's own), MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0 or CC0-1.0 only. Shaders are written fresh;
  algorithms are credited by name and URL in `credits` and in comments. No Shadertoy ports, no Lygia, no
  hydra-synth, no MilkDrop presets.
- `flash`: `none`, `possible` (can flash at some settings) or `strobe` (flashes by design).
- At least 3 presets. Preset values are range-checked against `INPUTS`.

## Passes

With no `PASSES`, `main.frag` is the only pass. With `PASSES`, pass *i* is `pass<i>.frag`, except the
last, which is `main.frag`. A pass with `TARGET` renders into a named buffer that every later pass
(and, if `PERSISTENT`, every pass of the next frame) can sample as `uniform sampler2D <TARGET>`.
Buffers are RGBA16F (`FLOAT` is accepted for ISF compatibility; all buffers are float). A persistent
buffer holds the previous frame's value when it is read before it is written in the current frame.
Frames are rendered strictly in order, so persistent buffers are deterministic.

## The prelude (prepended to every pass by the engine; do not redeclare)

```glsl
#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
in vec2 vUv;                 // 0..1, origin bottom-left
out vec4 fragColor;          // LINEAR-light RGB, alpha 1
uniform float TIME;          // seconds = FRAMEINDEX / fps
uniform float TIMEDELTA;     // 1 / fps
uniform int FRAMEINDEX;
uniform int PASSINDEX;
uniform vec2 RENDERSIZE;     // pixels of the current pass target
uniform float SEED;          // 0..1 from the score seed
uniform sampler2D inputImage;    // footage frame or the layer below; linear light; black when absent
uniform bool HAS_INPUT;
uniform vec3 PALETTE[8];     // linear light, from the score palette (or the template default)
uniform int PALETTE_COUNT;
// audio (zero when no audio): per frame, normalised as in references/audio.md
uniform float AUDIO_RMS, AUDIO_PEAK, AUDIO_BASS, AUDIO_MID, AUDIO_TREB, AUDIO_BASS_ATT, AUDIO_MID_ATT,
              AUDIO_TREB_ATT, AUDIO_FLUX, AUDIO_ONSET, AUDIO_BEAT, AUDIO_BEATPHASE, AUDIO_BPM;
uniform sampler2D audio;     // 512x2: row 0 = wave L/mono, row 1 = wave R, values 0..1 (0.5 = silence)
uniform sampler2D audioFFT;  // 512x1 spectrum 0..1, low to high
uniform float AUDIO_BANDS[32];
#define isf_FragNormCoord vUv
#define IMG_NORM_PIXEL(img, uv) texture(img, uv)
#define IMG_THIS_NORM_PIXEL(img) texture(img, vUv)
#define IMG_PIXEL(img, px) texture(img, (px) / vec2(textureSize(img, 0)))
#define IMG_THIS_PIXEL(img) texture(img, vUv)
#define IMG_SIZE(img) vec2(textureSize(img, 0))
```

Each declared INPUT becomes a uniform of the same name: float → `float`, long → `int`, bool → `bool`,
color → `vec4` (converted to linear), point2D → `vec2`, image/audio/audioFFT → `sampler2D`.

## Common helpers (also in the prelude)

```glsl
float hash12(vec2 p);            // seeded by SEED, 0..1
vec2  hash22(vec2 p);
float vnoise(vec2 p);            // value noise 0..1
float fbm(vec2 p, int octaves);  // 0..1
float luma(vec3 linRgb);         // Rec.709 luminance of linear RGB
vec3  rgb2hsv(vec3 c);  vec3 hsv2rgb(vec3 c);   // on linear values; fine for effects
vec3  cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d);  // iq: a + b*cos(6.28318*(c*t + d))
vec3  paletteRamp(float t);      // PALETTE as a clamped ramp, t 0..1
vec3  paletteCycle(float t);     // PALETTE as a cyclic ramp, t wraps
vec3  srgbToLinear(vec3 c);  vec3 linearToSrgb(vec3 c);
mat2  rot(float a);
```

The engine converts the last pass's linear output to sRGB with blue-noise dither before readback.
No `#version` line, no `precision` line and no `out` declaration in template files.

## Text layer (engine-drawn type)

A template may declare `X_AGENTVFX.text`: a list of text items the engine draws every frame with Canvas 2D and
system fonts into `uniform sampler2D TEXTMASK` (R = glyph and line ink, G = solid box/bar fill; `HAS_TEXT` is
true). The template colours the mask (e.g. `mix(bg, ink, m.r)`). Scores override strings with
`"labels": { "<key>": "..." }`.

```json
"text": [
  { "key": "artist", "default": "ARTIST NAME", "x": 0.03, "y": 0.06, "size": 0.07, "font": "display", "style": "outline", "box": "tab" },
  { "key": "title", "default": "TRACK TITLE", "x": 0.97, "y": 0.05, "size": 0.09, "font": "tall", "align": "right" },
  { "key": "log", "default": "BOOT 0x7G75\nCACHE OK", "x": 0.1, "y": 0.2, "size": 0.025, "font": "mono", "reveal": "type", "revealStart": 0, "revealDur": 2 },
  { "key": "tag", "default": "HEADLINE", "x": 0.5, "y": 0.45, "size": 0.12, "font": "grotesk", "align": "center", "box": "bar" }
]
```

- `x`, `y`: top-left of the block as fractions of the frame (align moves the anchor); `size`: cap size as a fraction of frame height.
- `font`: `display` (condensed, DIN-like), `tall` (ultra-tall thin condensed), `grotesk` (heavy Helvetica-like), `mono` (Menlo-like), `serif`.
- `style`: `fill` or `outline`; `box`: `none`, `frame` (rounded outline), `tab` (outline with a folder tab), `bar` (solid fill in G).
- `reveal`: `none`, `type` (typewriter with a block cursor), `decode` (seeded random glyphs settle left to right) over `revealStart` .. `revealStart + revealDur` seconds. Deterministic per frame and seed.
- `\n` makes new lines; `lineHeight` (default 1.15), `tracking` (em).
- `family`: an installed font family named directly, e.g. `"family": "Pretendard", "weight": 900` (also accepted in `textStyle`). The CSS stack becomes `"<family>", <the generic stack of `font`>`, so on a machine without that family the item silently falls back to the generic `font` (`display`, `tall`, `grotesk`, `mono`, `serif`); `font` still decides the vertical stretch (`tall`) and the fallback. Names are limited to letters, digits, spaces, `.`, `_`, `-` (up to 64 characters). The engine waits for the face to resolve (`document.fonts.load`) before the first frame. Only the font name is referenced: no font file is read, copied or bundled by the skill, and nothing here grants a licence for any font. Installed on the author's Mac and used by the collage experimental presets: `Monument Extended` (weights 400 / 800; commercial font, licensed to the user, never redistribute it with this skill), `Pretendard` (100..900, Hangul and Latin; SIL OFL 1.1) and `MesloLGS NF` (monospace, Apache-2.0). Glyph widths differ per font, so a layout tuned for one face moves a little when the fallback is used.
- `channel`: `r` (default), `g` or `b`. The glyph ink goes into that mask channel, so a template can keep up to three independent sheets of type that overlap on the page and read each one with `TEXTMASK.r / .g / .b`. (`box: "bar"` fill always goes to G, so keep box items off the `g` sheet.)
- `set`: integer 0..9 (default 0). A template that declares any item with a `set` draws only the items whose `set` equals its `textSet` input (an INPUT of type long, default 0), so presets can each own a whole text sheet without sharing page space. Templates without `set` items are unaffected.
- A score may restyle any declared item without editing the template: `"textStyle": { "<key>": { "font": "mono", "size": 0.12, "x": 0.05, "y": 0.6, "tracking": 0.1, "align": "left", "weight": 700 } }` (every field optional; merged over the template's item; unknown keys, fonts and out-of-range values are validation errors). `labels` changes the string, `textStyle` the look.
- System fonts only; nothing is bundled. Text never quotes third-party marks or slogans.

## House style

Defaults are aggressive and stage-grade (spec Amendment A1): saturated colour, hard contrast, strobe,
glitch and noise at full strength. Never tame a default. A gentler look is a preset, not the default.
