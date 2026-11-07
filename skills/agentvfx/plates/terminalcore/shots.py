"""Camera moves: slow cinematic push / slide with a little handheld wander. pose(shot, t, frame) -> dict."""
import math

from mathutils import Vector

import wall


def _lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def _ease(t):
    return t * t * (3.0 - 2.0 * t)


def _hand(f, amp):
    """Smooth pseudo-random wander (sum of incommensurate sines)."""
    s = lambda k, p: math.sin(f * k + p)
    return (amp * (s(0.11, 0.3) + 0.5 * s(0.29, 1.7)), amp * (s(0.13, 2.1) + 0.5 * s(0.31, 0.2)), amp * (s(0.09, 4.0) + 0.5 * s(0.23, 3.1)))


def pose(shot, t, frame):
    hx, hy, hz = wall.monitor_position(*wall.HERO)
    if shot == "closeup":
        e = _ease(t)
        loc = _lerp((0.66, -1.34, 1.57), (0.34, -1.14, 1.50), e)
        target = _lerp((0.02, -0.02, hz + 0.03), (-0.02, -0.02, hz + 0.0), e)
        lens, fstop, amp = 62.0, 2.0, 0.0035
    elif shot == "wall":
        e = _ease(t)
        loc = _lerp((3.5, -8.4, 1.3), (1.6, -6.4, 1.38), e)
        target = _lerp((-0.5, 0.0, 1.7), (-1.0, 0.0, 1.62), e)
        lens, fstop, amp = 28.0, 1.6, 0.012
    elif shot == "gallery":
        e = 0.35 * _ease(t) + 0.65 * t
        loc = (0.0, -9.8 + 1.4 * e, 1.3)  # 1.4 m dolly: bench base stays clear of the bottom edge on the last frame
        return {"loc": loc, "quat": Vector((0.0, 1.0, 0.0)).to_track_quat("-Z", "Y"), "roll": 0.0, "lens": 26.0, "fstop": 11.0,
                "focus": -0.05 - loc[1], "shift_y": 0.06}
    else:
        raise SystemExit(f"unknown shot: {shot}")
    hx_, hy_, hz_ = _hand(frame, amp)
    loc = (loc[0] + hx_, loc[1] + hy_ * 0.5, loc[2] + hz_)
    target = (target[0] + hz_ * 0.6, target[1], target[2] + hx_ * 0.6)
    dist = (Vector(target) - Vector(loc)).length
    quat = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    roll = math.radians(0.25) * math.sin(frame * 0.07 + 1.0) * (0.4 if shot == "closeup" else 1.0)
    return {"loc": loc, "quat": quat, "roll": roll, "lens": lens, "fstop": fstop, "focus": dist}
