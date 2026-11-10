<div align="center">

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="assets/cover-poster.png">
  <img src="assets/cover.webp" width="100%" alt="agentvfx: a wall of reel stills with a beat bracket jumping between them">
</picture>

**Music-reactive VFX, directed by your coding agent.**

<a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-ff5a1f?style=flat-square" alt="License: Apache-2.0"></a>
<img src="https://img.shields.io/badge/node-%E2%89%A520-efece4?style=flat-square&labelColor=1d1d22" alt="Node 20 or newer">
<img src="https://img.shields.io/badge/runtime%20deps-0-8a8a90?style=flat-square&labelColor=1d1d22" alt="no runtime dependencies">
<a href="https://agentvfx.vercel.app"><img src="https://img.shields.io/badge/site-agentvfx.vercel.app-7aa2f7?style=flat-square&labelColor=16161e" alt="Site: agentvfx.vercel.app"></a>

**[agentvfx.vercel.app](https://agentvfx.vercel.app)** · [Showreel](#-showreel) · [Install](#-install) · [Try it in your browser](#-try-it-in-your-browser) · [Gallery](#-gallery) · [How it works](#-how-it-works) · [Flash safety](#%EF%B8%8F-flash-safety)

</div>

You describe the clip. The agent writes a short FX score (template, preset, a few parameters, which part of the music drives what), renders it with WebGL2 in headless Chrome, encodes it with ffmpeg and checks every frame for dangerous flashing before it shows you anything. Backgrounds come from procedural Blender scenes. The same templates also run live in a web page, and the [site](https://agentvfx.vercel.app) runs them in yours.

## 🎬 Showreel

<div align="center">
<a href="assets/showreel.mp4"><img src="assets/showreel.webp" width="100%" alt="Showreel: nine looks cut on the beat over the gallery backdrop"></a>
<br><sub>Nine looks cut on the beat over one Blender backdrop. <a href="assets/showreel.mp4"><b>Watch the 1080p version</b></a> (silent).</sub>
</div>

## 📦 Install

agentvfx is a single agent skill, so any agent that reads skills can use it. The quickest way works for most of them:

```sh
npx skills add wjgoarxiv/agentvfx
```

Or use your agent's own plugin command:

| Agent | Command |
| --- | --- |
| Claude Code | `/plugin marketplace add wjgoarxiv/agentvfx`<br>`/plugin install agentvfx@agentvfx` |
| Codex CLI | `codex plugin marketplace add wjgoarxiv/agentvfx`<br>`codex plugin add agentvfx@agentvfx` |
| Gemini CLI | `gemini extensions install https://github.com/wjgoarxiv/agentvfx` |
| GitHub Copilot CLI | `copilot plugin install wjgoarxiv/agentvfx` |
| Qwen Code | `qwen extensions install wjgoarxiv/agentvfx` |
| Pi | `pi install git:github.com/wjgoarxiv/agentvfx` |

<details>
<summary>Other agents, or no installer</summary>

Clone the repository and point your agent at `AGENTS.md`. It names the skill file and the folder to run commands from.

```sh
git clone https://github.com/wjgoarxiv/agentvfx
```

The repository also carries plugin manifests for Cursor, Kimi, Antigravity and Devin (`.cursor-plugin/`, `.kimi-plugin/`, `.antigravity-plugin/`, `.devin-plugin/`).

</details>

Then ask for something like *"a 4-second neon lattice that hits on the kick of this track, looping, 1080p"*.

### Requirements

- Node.js 20 or newer. There is no `npm install` step and no runtime dependency.
- Google Chrome or Chromium with GPU WebGL2 (`CHROME_PATH` to override)
- ffmpeg and ffprobe (`FFMPEG_PATH`, `FFPROBE_PATH`)
- Blender 5.x, only for background plates (`BLENDER_PATH`)

## 🕹 Try it in your browser

The site at **[agentvfx.vercel.app](https://agentvfx.vercel.app)** runs the templates live with WebGL2. Nothing is uploaded and no sound plays unless you pick a file of your own.

| Page | What you get |
| --- | --- |
| [Home](https://agentvfx.vercel.app) | A live hero you play with the pointer. Click for a hit; keys 1 to 4 switch looks. |
| [Gallery](https://agentvfx.vercel.app/gallery/) | Every example reel with the exact prompt and FX score that made it, one click to copy. |
| [Matrix](https://agentvfx.vercel.app/matrix/) | Every browser-ready template × preset, 168 in all, drawn as stills. Hover one to see it move. |
| [Cookbook](https://agentvfx.vercel.app/cookbook/) | Recipes by genre, mood and format: stacks, beat hits, cuts and palettes as ready scores. |
| [Playground](https://agentvfx.vercel.app/playground/) | Build a score: pick any of the 41 templates that run in the browser (collage renders locally only), stack layers, program hits, bring your own words, track or clip, then copy the score, the prompt or a share link. |

Paste the copied prompt into your agent and it renders the full clip on your machine.

## ✨ What it makes

<table>
<tr>
<td width="33%" valign="top"><b>Beat-locked clips</b><br>3 to 5 second renders at up to 1080p 60 fps. Bass, onsets, beats and frequency bands drive each template's parameters.</td>
<td width="33%" valign="top"><b>Seamless loops</b><br>Ping-pong loops for stage screens and social posts, checked for flashing across the loop point too.</td>
<td width="33%" valign="top"><b>Blender backdrops</b><br>Procedural scenes rendered from code, used as plates under the WebGL layers.</td>
</tr>
<tr>
<td valign="top"><b>Footage looks</b><br>Run a template over your own video and audio, starting at any second.</td>
<td valign="top"><b>Live web export</b><br>The templates as a self-contained module for your site: hero backgrounds, hover hits, and visuals that follow any audio element you connect.</td>
<td valign="top"><b>Flash audit</b><br>Every frame is measured against photosensitivity limits; broadcast-safe mode refuses to export a failing clip.</td>
</tr>
</table>

## 🖼 Gallery

Twenty reels from the site, rendered by the skill at 1080p and looped silently: four seconds forward, then backward. Click one to open its page with the prompt and FX score that made it. A music track drove the motion while rendering; no audio is distributed, and every score points at `your-track.mp3`, so any track works.

> [!WARNING]
> `signal-cut` is a strobe cut on purpose and exceeds the WCAG 2.3.1 flash limit. It shows as a still here; its page asks before it plays.

<!-- gallery:start -->
### Families

<table>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/boot-log/"><img src="https://agentvfx.vercel.app/reels/boot-log/preview.webp" width="260" alt="Boot Log"></a><br><sub><code>boot-log</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/collage/"><img src="https://agentvfx.vercel.app/reels/collage/preview.webp" width="260" alt="Collage"></a><br><sub><code>collage</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/halftone-field/"><img src="https://agentvfx.vercel.app/reels/halftone-field/preview.webp" width="260" alt="Halftone Field"></a><br><sub><code>halftone-field</code></sub></td></tr>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/hud-deck/"><img src="https://agentvfx.vercel.app/reels/hud-deck/preview.webp" width="260" alt="Hud Deck"></a><br><sub><code>hud-deck</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/block-glitch/"><img src="https://agentvfx.vercel.app/reels/block-glitch/preview.webp" width="260" alt="Block Glitch"></a><br><sub><code>block-glitch</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/rgb-split/"><img src="https://agentvfx.vercel.app/reels/rgb-split/preview.webp" width="260" alt="Rgb Split"></a><br><sub><code>rgb-split</code></sub></td></tr>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/vhs/"><img src="https://agentvfx.vercel.app/reels/vhs/preview.webp" width="260" alt="Vhs"></a><br><sub><code>vhs</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/signal-cut/"><img src="https://agentvfx.vercel.app/reels/signal-cut/poster.jpg" width="260" alt="Signal Cut"></a><br><sub><code>signal-cut</code> ⚠️ flashing</sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/speedline-burst/"><img src="https://agentvfx.vercel.app/reels/speedline-burst/preview.webp" width="260" alt="Speedline Burst"></a><br><sub><code>speedline-burst</code></sub></td></tr>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/god-rays/"><img src="https://agentvfx.vercel.app/reels/god-rays/preview.webp" width="260" alt="God Rays"></a><br><sub><code>god-rays</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/lens-flare/"><img src="https://agentvfx.vercel.app/reels/lens-flare/preview.webp" width="260" alt="Lens Flare"></a><br><sub><code>lens-flare</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/neon-saber/"><img src="https://agentvfx.vercel.app/reels/neon-saber/preview.webp" width="260" alt="Neon Saber"></a><br><sub><code>neon-saber</code></sub></td></tr>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/echo-flow/"><img src="https://agentvfx.vercel.app/reels/echo-flow/preview.webp" width="260" alt="Echo Flow"></a><br><sub><code>echo-flow</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/kaleido-fold/"><img src="https://agentvfx.vercel.app/reels/kaleido-fold/preview.webp" width="260" alt="Kaleido Fold"></a><br><sub><code>kaleido-fold</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/tidal-bands/"><img src="https://agentvfx.vercel.app/reels/tidal-bands/preview.webp" width="260" alt="Tidal Bands"></a><br><sub><code>tidal-bands</code></sub></td></tr>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/scope-polar/"><img src="https://agentvfx.vercel.app/reels/scope-polar/preview.webp" width="260" alt="Scope Polar"></a><br><sub><code>scope-polar</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/spectrogram-scroll/"><img src="https://agentvfx.vercel.app/reels/spectrogram-scroll/preview.webp" width="260" alt="Spectrogram Scroll"></a><br><sub><code>spectrogram-scroll</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/xy-phosphor/"><img src="https://agentvfx.vercel.app/reels/xy-phosphor/preview.webp" width="260" alt="Xy Phosphor"></a><br><sub><code>xy-phosphor</code></sub></td></tr>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/label-bars/"><img src="https://agentvfx.vercel.app/reels/label-bars/preview.webp" width="260" alt="Label Bars"></a><br><sub><code>label-bars</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/spectrum-particles/"><img src="https://agentvfx.vercel.app/reels/spectrum-particles/preview.webp" width="260" alt="Spectrum Particles"></a><br><sub><code>spectrum-particles</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/spectrum-radial/"><img src="https://agentvfx.vercel.app/reels/spectrum-radial/preview.webp" width="260" alt="Spectrum Radial"></a><br><sub><code>spectrum-radial</code></sub></td></tr>
</table>

### Before and after

<table>
<tr><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/ba-1/"><img src="https://agentvfx.vercel.app/reels/ba-1/preview.webp" width="260" alt="Before / After: Sacred"></a><br><sub><code>ba-1</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/ba-2/"><img src="https://agentvfx.vercel.app/reels/ba-2/preview.webp" width="260" alt="Before / After: Tidal Bands"></a><br><sub><code>ba-2</code></sub></td><td align="center" width="33%"><a href="https://agentvfx.vercel.app/r/ba-3/"><img src="https://agentvfx.vercel.app/reels/ba-3/preview.webp" width="260" alt="Before / After: Kaleido"></a><br><sub><code>ba-3</code></sub></td></tr>
</table>

### Formats

<table>
<tr><td align="center" width="50%"><a href="https://agentvfx.vercel.app/r/fmt-16x9/"><img src="https://agentvfx.vercel.app/reels/fmt-16x9/preview.webp" width="390" alt="Web hero 16:9"></a><br><sub><code>fmt-16x9</code></sub></td><td align="center" width="50%"><a href="https://agentvfx.vercel.app/r/fmt-1x1/"><img src="https://agentvfx.vercel.app/reels/fmt-1x1/preview.webp" width="390" alt="Square 1:1"></a><br><sub><code>fmt-1x1</code></sub></td></tr>
<tr><td align="center" width="50%"><a href="https://agentvfx.vercel.app/r/fmt-32x9/"><img src="https://agentvfx.vercel.app/reels/fmt-32x9/preview.webp" width="390" alt="LED wall 32:9"></a><br><sub><code>fmt-32x9</code></sub></td><td align="center" width="50%"><a href="https://agentvfx.vercel.app/r/fmt-9x16/"><img src="https://agentvfx.vercel.app/reels/fmt-9x16/preview.webp" width="390" alt="Vertical 9:16"></a><br><sub><code>fmt-9x16</code></sub></td></tr>
</table>

### One song, many looks

<table>
<tr><td align="center" width="100%"><a href="https://agentvfx.vercel.app/r/wall/"><img src="https://agentvfx.vercel.app/reels/wall/preview.webp" width="520" alt="One song, many looks"></a><br><sub><code>wall</code></sub></td></tr>
</table>
<!-- gallery:end -->

<details>
<summary>Earlier renders (kept in the 0.3.3 commit): the Blender backdrop, the lattice and 21 collages</summary>

These 1280x720 loops left the repository tree in 0.3.4 to keep it small; they stay in the [0.3.3 commit](https://github.com/wjgoarxiv/agentvfx/tree/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels). `lattice-vermilion-fine` and `runner` contain flashing red that exceeds common photosensitive-seizure guidelines (WCAG 2.3.1); they are marked ⚠️. Do not show them to viewers who have not been warned.

### Backdrop

A procedural Blender scene: a concrete gallery with a CRT wall, built and lit in code.

<table>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/plate-gallery.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/plate-gallery.webp" width="260" alt="plate-gallery loop"></a><br><sub><code>plate-gallery</code></sub></td></tr>
</table>

### Lattice

A fine vermilion grid that bends and flares on the kick, laid over the gallery plate.

<table>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/lattice-vermilion-fine.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/lattice-vermilion-fine.webp" width="260" alt="lattice-vermilion-fine loop"></a><br><sub><code>lattice-vermilion-fine</code> ⚠️ flashing</sub></td></tr>
</table>

### Collages

Layered typographic compositions in mixed materials. The cells hold still; what is inside them moves with the music.

<table>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/specimen.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/specimen.webp" width="260" alt="specimen loop"></a><br><sub><code>specimen</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/wiring.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/wiring.webp" width="260" alt="wiring loop"></a><br><sub><code>wiring</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/field-cut.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/field-cut.webp" width="260" alt="field-cut loop"></a><br><sub><code>field-cut</code></sub></td></tr>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/pattern-sheet.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/pattern-sheet.webp" width="260" alt="pattern-sheet loop"></a><br><sub><code>pattern-sheet</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/deck.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/deck.webp" width="260" alt="deck loop"></a><br><sub><code>deck</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/bootlog.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/bootlog.webp" width="260" alt="bootlog loop"></a><br><sub><code>bootlog</code></sub></td></tr>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/runner.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/runner.webp" width="260" alt="runner loop"></a><br><sub><code>runner</code> ⚠️ flashing</sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/anatomy.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/anatomy.webp" width="260" alt="anatomy loop"></a><br><sub><code>anatomy</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/tunnel.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/tunnel.webp" width="260" alt="tunnel loop"></a><br><sub><code>tunnel</code></sub></td></tr>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/ascii.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/ascii.webp" width="260" alt="ascii loop"></a><br><sub><code>ascii</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/cube-wall.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/cube-wall.webp" width="260" alt="cube-wall loop"></a><br><sub><code>cube-wall</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/frame-loop-dial.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/frame-loop-dial.webp" width="260" alt="frame-loop-dial loop"></a><br><sub><code>frame-loop-dial</code></sub></td></tr>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/vortex-count.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/vortex-count.webp" width="260" alt="vortex-count loop"></a><br><sub><code>vortex-count</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/slab-shear.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/slab-shear.webp" width="260" alt="slab-shear loop"></a><br><sub><code>slab-shear</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/sticker-slap.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/sticker-slap.webp" width="260" alt="sticker-slap loop"></a><br><sub><code>sticker-slap</code></sub></td></tr>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/lens-wrap.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/lens-wrap.webp" width="260" alt="lens-wrap loop"></a><br><sub><code>lens-wrap</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/liquid-type.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/liquid-type.webp" width="260" alt="liquid-type loop"></a><br><sub><code>liquid-type</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/panel-grid.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/panel-grid.webp" width="260" alt="panel-grid loop"></a><br><sub><code>panel-grid</code></sub></td></tr>
<tr><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/marquee-stack.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/marquee-stack.webp" width="260" alt="marquee-stack loop"></a><br><sub><code>marquee-stack</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/tilt-tiles.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/tilt-tiles.webp" width="260" alt="tilt-tiles loop"></a><br><sub><code>tilt-tiles</code></sub></td><td align="center"><a href="https://github.com/wjgoarxiv/agentvfx/blob/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/mirror-track.mp4"><img src="https://raw.githubusercontent.com/wjgoarxiv/agentvfx/7dfbdd5f93bef88bf3ec4dfe533b1f87dac35bf3/reels/preview/mirror-track.webp" width="260" alt="mirror-track loop"></a><br><sub><code>mirror-track</code></sub></td></tr>
</table>

</details>

## 🔒 What it runs, writes and sends

- **Runs:** `node scripts/vfx.mjs` from `skills/agentvfx/`, which starts headless Chrome or Chromium (driven over `--remote-debugging-pipe`, no debugging port), `ffmpeg`/`ffprobe` to encode and analyse, and Blender 5.x only when a score asks for a background plate.
- **Writes:** renders, stills and reports into the folder passed as `--out`, plus a throwaway Chrome profile.
- **Sends:** nothing. The engine makes no outbound network requests and has no telemetry. The optional live frame server listens on `127.0.0.1` only, on a random port. Clips come from deterministic shader templates, not from a generative model.

## 🔧 How it works

Engine commands run from `skills/agentvfx/`:

```sh
cd skills/agentvfx
node scripts/vfx.mjs doctor     # checks Chrome, WebGL2, ffmpeg, Blender
node scripts/vfx.mjs list       # templates and presets
node scripts/vfx.mjs render test/fixtures/score-ok.json --out out/first --width 640 --height 360
```

Then open `out/first/stills/sheet.png`. For a footage look with the bundled demo media, try `templates/brutal/lattice/demo-vermilion.json`. [`SKILL.md`](skills/agentvfx/SKILL.md) covers scores, audio bindings, plates, loops and the web export; [`references/web.md`](skills/agentvfx/references/web.md) has the browser API.

## ⚠️ Flash safety

<details>
<summary>How flashing is measured and what the gallery passes</summary>

Strobe and impact templates can exceed photosensitivity limits on purpose, for stage use. Every render writes a flash audit. `broadcast-safe` mode enforces the limits, and `safeVariant` renders a tamed copy beside the original. Templates that can flash ship `safeSubstitute` values; the site runs them only with those values locked, and keeps flash-capable templates without safe values render-only.

All twenty-nine site reels pass the audit, including across the loop point; `signal-cut` shows its flash-safe version there. Of the earlier renders, twenty-one pass (`cube-wall` and `tilt-tiles` hold for six frames at each turn to stay inside the limit) and the two marked ⚠️ do not.

Live effects carry a flash guard: the browser runtime checks every shown frame with the audit's own detector and never shows a frame that would break the limit. It stops the effect instead, and the page can reset and resume (see [the web reference](skills/agentvfx/references/web.md)). On the site, all four hero looks and twenty-five flash-rated playground templates, with every slider pushed to three quarters of its range, were captured for ten seconds under scripted pointer input and checked with the same audit. All pass except `signal-cut`, which showed two single red transitions six seconds apart: no flash within any one second, but the audit counts the pair over the whole capture.

</details>

## 🙏 Credits

- Capture engine adapted from LitClaude lit-typographic-motion and mexicat/pdoom-video (both MIT); see [`NOTICE`](skills/agentvfx/NOTICE).
- Demo footage `clip-01.mp4` and `clip-02.mp4`: public-domain films from the Internet Archive ([sources](skills/agentvfx/test-media/SOURCES.md)). `beat-132.mp3` is generated by `scripts/make-beat.mjs`.
- Fonts are not bundled. The collages name Monument Extended, Pretendard and MesloLGS NF; without them the text falls back to generic families and looks different from the gallery.

## 📄 License

agentvfx is licensed under the [Apache License 2.0](LICENSE). You may use, change and share it, commercially too, as long as you keep the licence and the [`NOTICE`](skills/agentvfx/NOTICE) file with any copy you hand on. Releases up to 0.3.4 were published under earlier terms and keep their own `LICENSE` file.

**A credit is appreciated, not required.** Every render burns a small `agentvfx` credit into a corner of the frame by default; switch it off with `"credit": { "overlay": false }` in the score. If you would like to credit agentvfx in a description or credits, this line is also written to `CREDIT.txt` next to every film:

```text
Made with agentvfx by Woojin Go - https://github.com/wjgoarxiv/agentvfx
```

The licence gives no right to use the name "agentvfx" or its logo beyond saying truthfully where a work comes from (Apache-2.0, section 6). The folder that `export-web` writes carries its own `LICENSE` and `NOTICE`; keep them with the files.

> 한국어 요약: agentvfx는 Apache License 2.0을 따릅니다. 상업적 사용을 포함해 자유롭게 쓰고, 고치고, 배포할 수 있습니다. 다른 사람에게 넘길 때는 `LICENSE`와 `NOTICE` 파일을 함께 넘겨 주세요. 렌더 화면 모서리에 기본으로 들어가는 작은 `agentvfx` 크레딧은 끌 수 있고, 크레딧 표기는 의무가 아니라 부탁입니다.

The parts adapted from mexicat/pdoom-video keep their MIT licence ([`NOTICE`](skills/agentvfx/NOTICE) lists the files). To cite agentvfx in a paper or write-up, use [`CITATION.cff`](CITATION.cff).

<div align="center"><sub><a href="https://agentvfx.vercel.app">Site</a> · <a href="#-showreel">Showreel</a> · <a href="#-install">Install</a> · <a href="#-gallery">Gallery</a> · <a href="skills/agentvfx/SKILL.md">SKILL.md</a> · <a href="LICENSE">License</a></sub></div>
