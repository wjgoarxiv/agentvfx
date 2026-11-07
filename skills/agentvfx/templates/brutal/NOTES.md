# brutal family (neo-brutalist HUD, halftone, boot log)

Templates here are generated: edit `_src/` and run `node templates/brutal/_src/build.mjs`.

- `_src/shared/lib.glsl`: design-unit helpers (1920x1080 layout units, `U` pixels per unit), SDFs, 3x5 digit font, cover-fit media sampling.
- `_src/shared/screen.glsl`: dot screen, 8x8 Bayer ordered dither, ASCII-cell glyph screen (needs `float lumAt(vec2 p)` from the including shader).
- `_src/shared/icons.glsl`: procedural outline glyph icons.
- `_src/<id>/def.mjs`: fx.json (inputs, presets, text items) and demo scores; `_src/<id>/*.src.frag` the passes.

Layout is authored for 16:9. Render with `--width 1920 --height 1080` (footage templates otherwise keep the clip aspect).

- `hud-deck`: media window (rect / rounded / octagon); `deckLayout` 0 = wide window over a bottom desk (labels, waveform, hatched spectrum) with a right rail (contour map, particle box, 16-step beat sequencer, micro code); `deckLayout` 1 = off-centre octagon window with a dial gauge, segment meter, readout column, pad matrix, bar meters, scan ruler, timeline and barcode strip. Text items are gated by layout in the shader (the text layer has no per-preset visibility).
- `halftone-field`: `screenMode` 0 dots, 1 ordered dither, 2 ASCII cells; `invert` for dark dots on a light field.
- `boot-log`: generative; `logDone` sets when the log finishes typing and the progress bar fills.
