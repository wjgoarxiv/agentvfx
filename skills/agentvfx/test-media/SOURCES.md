# Test media sources

Access date for every file: 2026-11-01.

Licence text below is the visible Usage wording on the archive.org item page (the `rel="license"` link), not the API `licenseurl` alone.

`beat-132.mp3` is not sourced from anywhere: `scripts/make-beat.mjs` synthesises it (132 BPM, 10 s) and it ships under the same licence as the code (see LICENSE).

## clip-01.mp4

- Page URL: https://archive.org/details/JuniorPr1946
- Direct file URL: https://archive.org/download/JuniorPr1946/JuniorPr1946.mp4
- Title: Junior Prom
- Author: Simmel-Meservey
- Licence: Public Domain
- Licence link on the page: http://creativecommons.org/licenses/publicdomain/ (link title "Public Domain")
- Trim window: 849.0 s–859.0 s (source time). Colour prom dance: faces, a light dress against dark suits, strong luminance change.
- ffmpeg command:

```
ffmpeg -y -ss 849 -t 10.0 -i JuniorPr1946.mp4 -vf "fps=30,scale=1920:1440:flags=lanczos" -frames:v 300 -af "atrim=end=10,asetpts=PTS-STARTPTS" -c:v libx264 -pix_fmt yuv420p -r 30 -fps_mode cfr -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart test-media/clip-01.mp4
```

## clip-02.mp4

- Page URL: https://archive.org/details/DuckandC1951
- Direct file URL: https://archive.org/download/DuckandC1951/DuckandC1951.mp4
- Title: Duck and Cover
- Author: Archer Productions, Inc.
- Licence: Public Domain
- Licence link on the page: http://creativecommons.org/licenses/publicdomain/ (link title "Public Domain")
- Trim window: 118.0 s–128.0 s (source time). Different subject from clip-01: a street, cars, and a dark figure against a bright road.
- ffmpeg command:

```
ffmpeg -y -ss 118 -t 10.0 -i DuckandC1951.mp4 -vf "fps=30,scale=1472:1920:flags=lanczos" -frames:v 300 -af "atrim=end=10,asetpts=PTS-STARTPTS" -c:v libx264 -pix_fmt yuv420p -r 30 -fps_mode cfr -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart test-media/clip-02.mp4
```

The archive file is 368×480 with no rotate tag, so the long edge of 1920 is the height (1472×1920).
