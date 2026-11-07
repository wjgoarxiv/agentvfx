"""Procedural terminal-screen images (bitmap font drawn by font.py, text composed here). No external assets."""
import random

import bpy
import numpy as np

from font import glyph

W, H = 768, 1152
CW, CH, PX = 12, 18, 2
COLS, ROWS = W // CW, H // CH

_WORDS = ["SYNC", "NODE", "LINK", "RELAY", "CARRIER", "BUFFER", "PHASE", "VECTOR", "SIGNAL", "KERNEL", "UPLINK",
          "TRACE", "DAEMON", "CACHE", "SECTOR", "ARRAY", "RASTER", "BEACON", "LATCH", "OSC", "MUX", "DECK"]
_STATE = ["OK", "OK", "OK", "LOCKED", "NOMINAL", "DRIFT", "WARN", "STANDBY", "ARMED", "OK"]


def _hex(rng, n):
    return "".join(rng.choice("0123456789ABCDEF") for _ in range(n))


def _line(rng, kind):
    if kind == 0:
        return f"[{rng.randint(0, 9999):04d}.{rng.randint(0, 99):02d}] {rng.choice(_WORDS)}_{rng.randint(0, 31):02d} {rng.choice(_STATE)} 0x{_hex(rng, 6)}"
    if kind == 1:
        return f"0x{_hex(rng, 4)}: " + " ".join(_hex(rng, 2) for _ in range(rng.randint(8, 14)))
    if kind == 2:
        n = rng.randint(0, 20)
        return f"> {rng.choice(_WORDS)} --{rng.choice(_WORDS).lower()} [{'#' * n}{'.' * (20 - n)}] {n * 5:3d}%"
    if kind == 3:
        return f"{rng.choice(_WORDS)}.{rng.choice(_WORDS)} = {rng.random() * 100:7.3f} // {rng.choice(_STATE)}"
    return ""


def _draw_char(buf, ch, col, row):
    g = glyph(ch)
    y0, x0 = row * CH + 2, col * CW
    for gy, r in enumerate(g):
        for gx, v in enumerate(r):
            if v:
                buf[y0 + gy * PX:y0 + gy * PX + PX, x0 + gx * PX:x0 + gx * PX + PX] = 1.0


def _blur(a):
    a = a + 0.5 * (np.roll(a, 1, 0) + np.roll(a, -1, 0))
    a = a + 0.5 * (np.roll(a, 1, 1) + np.roll(a, -1, 1))
    return a / 4.0


def terminal_pixels(seed, density=0.75):
    """Float luminance image HxW (top row first) holding a wrapping scroll of fake terminal output."""
    rng = random.Random(seed)
    buf = np.zeros((H, W), dtype=np.float32)
    for row in range(ROWS):
        if rng.random() > density:
            continue
        kind = rng.choice([0, 0, 1, 1, 2, 3])
        indent = 3 + rng.choice([0, 0, 0, 2, 4])
        text = (" " * indent + _line(rng, kind))[:COLS - 5]
        bright = 1.0 if rng.random() > 0.2 else 0.55
        row_buf = np.zeros_like(buf)
        for col, ch in enumerate(text):
            if ch != " ":
                _draw_char(row_buf, ch, col, row)
        buf = np.maximum(buf, row_buf * bright)
    _draw_char(buf, "BLOCK", rng.randint(4, 30), 20)
    return np.clip(_blur(buf) * 1.35, 0.0, 1.0)


def make_image(name, seed, density=0.75):
    pix = terminal_pixels(seed, density)
    rgba = np.repeat(np.flipud(pix)[:, :, None], 4, axis=2)
    rgba[:, :, 3] = 1.0
    img = bpy.data.images.new(name, W, H, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    img.pack()
    return img
