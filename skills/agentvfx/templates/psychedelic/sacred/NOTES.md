# Sacred — algorithm and parameters

1. pass0 blurs footage luma (3x3, radius lumaBlur) into smoothLuma; with no input it renders a slow fbm field instead, so the template stays generative.
2. main maps contrasted luma to a colour phase: phase = luma * bandDensity, giving N saturated bands across dark-to-bright.
3. A tide of 1-3 travelling sine waves along tideAngle plus fbm drift shifts the phase over space and time, so bands sweep like a tide.
4. The phase looks up a cyclic palette: rainbow cosine, a thermal blue-to-cyan ramp, or the score palette. Palette 3 (`print`) is a clamped 4-step ink / acid / orange / paper lookup used by sacred-thermal and sacred-halo; `baseDim` darkens the base and `stroke`/`strokeWidth` draw a solid acid line on luma edges (sacred-halo).
5. Sobel gradients of the smooth luma drive an optional white edge halo (haloAmount) and R/B channel phase split (fringe).
6. AUDIO_BASS scales the tide speed and AUDIO_BEAT adds a phase kick, both gated by audioKick (0 = off).
7. Saturation is pushed around the output luma; the result blends over the source by blend (default full effect).
8. tideSpeed: how fast bands travel. tideScale: spatial frequency of the tide. tideAngle: travel direction in radians.
9. tideWaves (1-3): wave count, richer motion at 3. bandDensity: band count across the luma range. paletteShift: offset into the palette.
10. saturation/contrast: stage-grade punch. lumaBlur: smoothness of the luma drive. haloAmount/fringe: edge glow and chroma split, off by default. blend: effect blend over the source.
11. Print palette flash bounds: tide speed stops at 1, the tide and audio swing stop at +-0.26 of the phase, and pass1 keeps a clock in smoothLuma's g and b so a speed change alters the rate without jumping the bands (with `TIME * speed`, any change moves the phase by `TIME * change`, which flipped the whole frame between ink and paper). sacred-thermal and sacred-halo sit inside both limits; rainbow, thermal and score palettes keep the direct clock.
