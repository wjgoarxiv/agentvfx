# terminalcore plate

Procedural, fully self-made Blender scene (no downloaded assets, HDRIs, textures or font files) that renders
ray-traced background footage in a Terminalcore / CRT-futurism / cybernetic-brutalist look, to be fed to
agentvfx templates as `input.video`.

What is in the scene
- Board-formed raw concrete room (tie holes, panel joints, streaks), polished reflective floor, brutalist piers + lintel.
- A rack bank of 45 chunky CRT monitors: bevelled bezels, curved dusty glass with real reflections, vents, knobs, LEDs.
- Screens are emissive and procedural: terminal text drawn from a hand-made 5x7 bitmap font (`font.py`), scrolling,
  with scanlines, edge vignette, flicker and a slow hum bar. Green / amber / cold-white phosphor, a few dead tubes.
- Cable tray, thick cables (drops, floor runs), status-LED array in the lintel, steel rack hardware.
- Volumetric haze (world scatter) with one cold key light entering through a slit window in the left wall.
- Cycles (Metal GPU), OIDN denoise, AgX view transform, shallow depth of field, compositor bloom, light handheld wander.

Shots
- `wall`    wide, slow push-in across the whole CRT wall.
- `closeup` one CRT close, oblique slide, text scrolling, glass reflections, DOF falloff over neighbouring tubes.

- `gallery` the same CRT wall as a clean, hyper-real exhibition-room installation (see below).

Gallery variant (`--shot gallery`)
- Room: architectural cast-concrete panels (1.2 x 2.35 m, real 5 mm joints with tiny bevels, dark reveal gaps at floor and
  ceiling, round form-tie holes, per-panel tone shift, pores, clouding), polished sealed concrete floor with soft reflections and
  saw-cut joints, concrete soffit with three flush linear light slots, track rails with grazing spots, a wall-wash over the back wall.
- Installation: strict 9 x 5 grid of identical CRTs (no jitter, mirrored amber/green layout, a few dark tubes) in a black
  powder-coat frame on a dark polished plinth; cables hidden behind the frame; one pale stone bench for scale. No text or branding.
- Look: AgX, exposure +0.15, haze only a touch (density 0.002), light bloom, lighter film grain in the encode.
- Camera: level, centred, one-point perspective with lens shift; steady 1.4 m dolly-in (-9.8 to -8.4), no shake, so the bench base keeps a clear margin above the bottom edge on the last frame. DOF is deep (f/11).
- Powered-off tubes are dark tinted glass (`glass_off` in `gallery_mats.py`): soft low-gloss reflection, no mirror glints of the ceiling slots. The bench is honed limestone with cloudy tone, thin veins, hone grain and a 13 mm edge bevel.
- Cost: measured 2.0 s/frame at 640x360, 56 samples, preview quality (240 s for the 4 s / 120-frame clip).
- Files: `gallery.py` (build + installation + bench), `gallery_room.py` (shell, ceiling, lights, haze), `gallery_mats.py` (materials).
- The screen layout is `LAYOUT` in `gallery.py` (bottom row first, columns mirrored); light intensity scales with `--key`.

Usage (from the agentvfx skill root)

    node scripts/plate.mjs --scene terminalcore --shot wall --out ../../gallery/plates/terminalcore-wall \
         --width 640 --height 360 --seconds 4 --fps 30 --samples 40

Writes `film.mp4` (H.264, yuv420p, light grain + vignette added in post; `--no-post` to skip), `still_first|mid|last.png`,
`plate.json` (measured seconds per frame) and `blender.log`.

Quality: `--quality preview` (default) is the fast look-dev path. `--quality final` raises samples to 256 (unless `--samples` is
given), tightens the adaptive threshold (0.01), uses the accurate OIDN denoise, enables Cycles camera motion blur (shutter 0.5; the camera
is keyframed on every frame because Cycles does not see a frame-change handler) and encodes at crf 14. Film grain stays the light
encode-time grain. Measured: 1920x1080 final, gallery, Metal GPU: about 109 s/frame (one test frame), so a 120-frame clip is roughly 3.6 h.

Options: `--quality preview|final`, `--frame N` renders one test still (`still_NNN.png`, no video), `--exposure EV`, `--bloom X` (0 = off), `--key X`
(key-light multiplier), `--haze X` (haze density multiplier), `--keep-frames`. Blender is found via `BLENDER_PATH`, `PATH`, or the macOS app bundle; ffmpeg via
`FFMPEG_PATH` / `PATH`.

Then use the clip as footage: pass the resulting `film.mp4` as the template's `input.video`.

Files: `scene.py` (entry, render setup, animation), `room.py` (shell, haze, key light), `wall.py` (rack, monitors, cables),
`crt.py` (monitor mesh), `materials.py` + `nodekit.py` (procedural shaders), `textures.py` + `font.py` (terminal text),
`shots.py` (camera moves).

Limits: preview-oriented defaults (640x360, 40 samples). For finals use `--quality final` and raise `--width/--height`
(time scales roughly with pixels x samples). Preview has no motion blur; final has camera motion blur only (the gallery dolly is slow,
about 12 mm per frame, so the blur is subtle; the scrolling screen text is a shader value and is not blurred). A faint film grain is
added in the encode step rather than in Cycles.
