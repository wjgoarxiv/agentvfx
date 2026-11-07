---
name: agentvfx
description: Agent-directed, music-reactive VFX clips from an FX score. WebGL2 shader templates (psychedelic, spectrum, scope, impact, light, glitch, neo-brutalist collage and lattice), optional Blender background plates, a flash audit on every render, silent ping-pong loops, and a web export for live use in apps and sites. Use when someone asks for a VFX clip, a visualizer, a festival or stage loop, a music-reactive background, or a live shader effect for a web page.
---

# agentvfx

You direct; the engine renders. You never write shader code for a clip. You pick a template, a preset and a few typed parameters, write them into an FX score (JSON), and the engine renders it in headless Chrome (WebGL2), encodes H.264 with ffmpeg, and audits it for flashes.

Run every command from this folder (the skill root). Paths inside a score resolve against the current directory.

## 1. Check the machine

    node scripts/vfx.mjs doctor

`ok: true` means Chrome with GPU WebGL2 and ffmpeg were found. Otherwise read `blockers` and tell the user what to install (`CHROME_PATH`, `FFMPEG_PATH`). Blender 5.x is needed only for plates (`BLENDER_PATH`).

## 2. Pick a look

    node scripts/vfx.mjs list            # family, template id, input kind, presets
    node scripts/vfx.mjs list --json     # with descriptions

`input` says what a template needs: `generative` (nothing), `footage` (`input.video`), or `either`. Start from a preset; change two or three parameters at most per round. Show the user the result before inventing more.

## 3. Write the score

Schema: `schemas/fx-score.schema.json`. Minimal:

```json
{ "version": 1, "template": "lattice", "preset": "vermilion-fine",
  "input": { "video": "test-media/clip-01.mp4", "audio": "test-media/beat-132.mp3" },
  "durationSec": 4, "seed": 47, "out": "my-lattice" }
```

- `durationSec` is 3–5. `seed` makes the render repeatable.
- `params` override the preset (names and ranges come from the template's `fx.json`).
- `bindings` tie a parameter to an audio feature (`bass`, `onset`, `beat`, `bands.N`, …) with `gain`, `offset`, `attackMs`, `releaseMs`. Keep attack on the onset frame and release short (about 60 ms): snappy reads as professional, heavy smoothing reads as a demo.
- `hits` fire an extra template on an onset or beat; `cuts` hard-cut the stack on a beat; `stack` layers up to two templates over the base.
- `labels` and `textStyle` set the engine's text layer (installed fonts by name; generic fallback when missing).

Check it without rendering:

    node scripts/vfx.mjs validate my-score.json

## 4. Render and look

    node scripts/vfx.mjs render my-score.json --out out/my-lattice --width 640 --height 360

Preview small first (640x360), then raise the size for the final. The command prints JSON with the film path, the flash result and the stills. Open `stills/sheet.png` and every strip before you describe the clip to anyone. A render you have not looked at is not done.

Every render burns a small `agentvfx` credit into a corner of the frame (switch it off with `"credit": { "overlay": false }` in the score), writes `CREDIT.txt` and puts the credit line in the MP4 metadata. Crediting agentvfx is a condition of its licence for anything published: while the on-screen credit stays in the frame nothing more is needed; if the overlay is off, or the user hands the clip on without it, the text credit must go in the post, description or credits. When you report a finished clip, give the user the line to paste:

    Made with agentvfx by Woojin Go - https://github.com/wjgoarxiv/agentvfx

The licence is the agentvfx licence: Additional Terms plus the PolyForm Noncommercial License 1.0.0 (see LICENSE). An individual (sole proprietors and a band of individuals included) may use the clips they render in their own work, also commercially: their own channel, sponsored content on it, music videos, their own VJ or live set. Employers, companies, client work, output made for someone else to publish, paid rendering services, selling clips or templates on their own, and AI training on the code or templates are not covered and need a commercial licence (or are not allowed). A changed copy shared with others (a fork) must carry a name without "agentvfx" and say it is changed from agentvfx. If the user's request is clearly one of those, say so before rendering. When you hand a clip over to be published, tell the user to keep the on-screen credit or pass the credit line along.

## 5. Flash safety

Every render carries a flash audit (general and red flashes per second, WCAG 2.3.1 style). Default mode `stage` keeps full intensity and writes `SAFETY.txt` when limits are exceeded. `"safety": { "mode": "broadcast-safe" }` enforces the limits; `"safeVariant": true` adds `film.safe.mp4` beside the full version. Tell the user plainly when a clip exceeds the limits.

## 6. Background plates (optional, Blender)

    node scripts/plate.mjs --scene terminalcore --shot gallery --out out/plate --width 640 --height 360 --seconds 4

Procedural scenes, no downloaded assets. Use the plate's `film.mp4` as `input.video`. `--quality final` is slow (about 2 minutes per 1080p frame); ask before starting one. See `references/plates.md`.

## 7. Silent loops

    node scripts/loop.mjs out/my-lattice/film.mp4 reels/my-lattice.mp4 --preview reels/preview/my-lattice.webp --audit out/my-lattice/loop-flash.json

Plays the clip forward then backward (no seam, no audio track) and flash-audits the loop played twice. Exit code 3 means the loop exceeds the flash limits. Reversing can double the flashes around a turn; `--hold 6` pauses six frames at each turn, which often brings such a loop back inside the limit. A red change that becomes a red flash when reversed cannot be fixed this way — say so and let the user decide.

## 8. Live on a web page

    node scripts/export-web.mjs lattice collage --out out/web

Writes a self-contained runtime, the chosen templates and a demo page. Respects `prefers-reduced-motion`. See `references/web.md`.

## Rules

- Never ship or commit music you do not have the rights to redistribute. A render's motion may come from a track while the published loop stays silent.
- References inspire; they are not copied. Do not reproduce a frame, logo, mark or font file from someone else's work.
- Do not bundle font files. Name installed fonts; they fall back when absent.

## More

- `references/template-format.md` — how a template is built (`fx.json`, passes, presets, text layer).
- `references/plates.md` — Blender plates.
- `references/web.md` — web runtime API.
