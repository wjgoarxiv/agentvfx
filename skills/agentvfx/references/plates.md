# Plates: Blender-rendered background footage

A plate is a short procedural Blender render used as `input.video` footage under an agentvfx template.
Scenes live in `plates/<scene>/scene.py`; `scripts/plate.mjs` runs Blender headless (Cycles, Metal GPU, OIDN denoise),
then encodes the frames to H.264 `film.mp4` with ffmpeg.

    node scripts/plate.mjs --scene terminalcore --shot wall|closeup|gallery --out <dir> \
         --width 640 --height 360 --seconds 4 --fps 30 --samples 40

- Output: `<dir>/film.mp4`, `still_first|mid|last.png`, `plate.json` (measured s/frame), `blender.log`.
- `--frame N` renders a single still for look-dev; `--quality preview|final`, `--exposure`, `--bloom`, `--key`, `--haze` tune the grade.
- Requirements: Blender 5.x (`BLENDER_PATH` or the macOS app bundle) and ffmpeg (`FFMPEG_PATH` or `PATH`).
- Everything is generated in code (geometry, shaders, bitmap font, terminal text); no downloaded assets.
- Preview defaults are small and fast (`--quality preview`). For finals add `--quality final` and raise `--width/--height`:
  256 samples, accurate denoise, camera motion blur (camera keyframed per frame), crf 14. Gallery at 1920x1080 final measured
  about 109 s/frame (one test frame). Time scales with pixels x samples; schedule full finals deliberately.

Available scenes: `terminalcore` (see `plates/terminalcore/README.md`), shots `wall` and `closeup` (dark brutalist, handheld)
and `gallery` (clean hyper-real concrete exhibition room, CRT wall as an installation, steady dolly, lighter grain; own
exposure/haze/bloom defaults). Example: `--shot gallery --out gallery/plates/terminalcore-gallery` (measured 2.0 s/frame at 640x360, 56 samples, Metal GPU: 240 s for 120 frames).
Adding a scene: create `plates/<name>/scene.py` that accepts the same `--shot --out --width --height --seconds --fps --samples --frame` args
and writes numbered PNGs to `<out>/frames/f_####.png` (or `<out>/still_NNN.png` with `--frame`).
