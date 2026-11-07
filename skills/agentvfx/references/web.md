# agentvfx on a page

`node scripts/export-web.mjs <templateId...> --out <dir>` writes three files and nothing else:

- `agentvfx.js` — the WebGL2 runtime, with the engine prelude inlined
- `templates.js` — `export default { <id>: { fx, passes } }` for the ids you named
- `demo.html` — a hero canvas, a hit button, an audio file input, and a text headline

The folder loads from disk. It does not fetch fonts, scripts, or media. Copy it into the site and import it as a module.

```js
import { AgentVfx } from "./agentvfx.js";
import templates from "./templates.js";

const fx = await AgentVfx.mount(canvas, {
  templates,
  template: "sacred",
  preset: "sacred-classic",
  params: { tideSpeed: 0.4 },
  palette: "rainbow",
  source: image,
  dpr: 1,
});
```

`source` may be omitted (generative), an `<img>`, a `<video>`, or another canvas. `AgentVfx.textSource({ text, font, color, background, width, height })` returns a canvas you can pass as `source`.

`fx.set(params)` replaces input values. `fx.trigger(id, { preset, params, durationMs })` draws that template over the current frame for `durationMs` (default 400). `fx.audio(elementOrStream)` connects an AnalyserNode and fills `AUDIO_*`, the 512×2 `audio` wave texture, the 512×1 `audioFFT` texture, and `AUDIO_BANDS[32]`. `fx.pause()`, `fx.resume()`, and `fx.destroy()` stop, continue, and release the context. `fx.renderAt(t)` paints one frame at time `t` in seconds and holds it, for tests and stills.

The canvas backing store follows its CSS size times `devicePixelRatio`, capped at `dpr` (default 1.5). A `ResizeObserver` rebuilds the targets. An `IntersectionObserver` pauses the loop when the canvas is fully off screen. A lost WebGL context is restored on `webglcontextrestored`.

`prefers-reduced-motion: reduce` paints one still frame and ignores `trigger()`, unless `motion: "always"` is set. A template whose `X_AGENTVFX.flash` is `"strobe"` logs one `console.warn` that names WCAG 2.3.1. The effect still runs when motion is allowed.

Live flash guard. Every shown frame is read back on the render audit's grid and checked with the audit's own detector. A frame that would make a seventh luminance transition, or a second saturated-red transition, within one second is replaced by the previous frame before the browser shows it; motion then stops, the runtime logs a `console.warn`, and calls `onFlashGuard({ template, reason, shownTransitions, shownRedTransitions })` if you passed one to `mount`. `fx.resume()` starts again with a fresh guard. A good handler resets the parameters the visitor changed and resumes once, and falls back to a still or an audited video loop if it trips again. Sliders, pointer mappings and hits can all push a template past the limit even with its `safeSubstitute` values, so keep the guard on; `flashGuard: false` turns it off for a page that does its own checking. The guard costs one small readback per shown frame. If a pass fails to compile, the runtime logs `console.error` with the template id and the pass, clears the canvas, and does not throw into the page.

## Recipes

Hero background. Fix the canvas to the viewport, `pointer-events: none`, and mount a generative or footage template behind the copy. Cap `dpr` at 1 on a full-bleed 4K wall if the GPU falls behind; the default cap is 1.5.

```html
<canvas id="hero" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
```

Section transition. On the way into a section, `trigger` a short hit (a few hundred milliseconds) and `set` the base template's mix or speed. Remove the hit by letting `durationMs` end. Do not leave a second canvas running for a transition that is already over; call `destroy()` if the section unmounts.

Hover glitch on a button. Keep the button as a real `<button>` above the canvas. On `pointerenter` and `click`, call `trigger` with a short `durationMs`. The canvas itself stays `pointer-events: none` so the button still receives the click. Under reduced motion the hit does not fire.

Glitch or decode headline. Draw the words with `textSource` and pass that canvas as `source` on a small canvas sitting over the heading box. The DOM heading stays in the document for selection and screen readers; the canvas is decorative.

```js
const plate = AgentVfx.textSource({ text: "AGENTVFX", font: "700 64px sans-serif", color: "#fff", background: "#000", width: 960, height: 180 });
await AgentVfx.mount(headCanvas, { templates, template: "sacred", source: plate });
```

Audio-reactive player. Point `<audio>` at a file the visitor picked, or at a same-origin file, then `fx.audio(audio)`. The element must be allowed to play (a click or the file input). The runtime reconnects the element through the AnalyserNode so the sound still comes out of the speakers.

Image hover Sacred. Mount Sacred with the `<img>` as `source` on a canvas that covers the image. On `pointerenter`, `set` a faster `tideSpeed` or `trigger` a short hit; on `pointerleave`, `set` the quiet preset back. The `<img>` can stay in the page underneath, with the canvas `pointer-events: none` except when the canvas is the control.

Performance budget. One live canvas per view, not one per card, unless the extras are paused. The loop stops off screen. Prefer `dpr: 1` for a full-viewport hero and the default 1.5 cap for a small headline. Persistent buffers are RGBA16F at the canvas size, so a 4K canvas is expensive; scale the CSS box down rather than uploading a 4K source and displaying it small. `pause()` when a tab or modal hides the effect. `destroy()` on teardown.

## with frontend-ui-ux

Put the canvas on its own layer: `position: absolute` or `fixed`, inset to the frame it decorates. `pointer-events: none` unless that canvas is the control the person is meant to use. DOM text, buttons, and links sit above it and stay readable; do not run a full-frame strobe under body copy without a still fallback. The effect never blocks input. Size the canvas to the section, not the document, and let the off-screen pause drop the work when the section scrolls away. Reduced motion is the default. `motion: "always"` is an explicit author choice, not the layout default.
