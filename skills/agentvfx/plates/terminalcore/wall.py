"""The CRT bank: rack frame, instanced monitors with per-object screen variants, status LEDs, cable tray + cables."""
import math
import random

import bpy

import crt
from crt import SLOT_PLASTIC, SLOT_GLASS, SLOT_VENT, SLOT_STEEL, SLOT_LED
from room import add_box

COLS, ROWS = 9, 5
BAY, PITCH, BASE_Z = 0.56, 0.5, 0.24
FRONT_Y = -0.05
HERO = (2, 4)  # row, column of the monitor the close-up shot holds on

# (image seed, tint, strength, rows per second) ; None image = unpowered glass
VARIANTS = {
    "green_a": (11, (0.20, 1.00, 0.34), 6.0, 5.0),
    "green_b": (23, (0.28, 1.00, 0.40), 5.5, 2.5),
    "amber": (37, (1.00, 0.52, 0.07), 6.5, 3.5),
    "cold": (51, (0.62, 0.85, 1.00), 5.0, 6.0),
}
WEIGHTS = ["green_a"] * 5 + ["green_b"] * 4 + ["amber"] * 4 + ["cold"] * 2 + [None] * 3


def monitor_position(r, c):
    x0 = -(COLS - 1) / 2 * BAY
    return x0 + c * BAY, FRONT_Y, BASE_Z + r * PITCH + PITCH / 2


def build_rack(coll, mats):
    x0 = -(COLS - 1) / 2 * BAY - BAY / 2
    height = ROWS * PITCH
    for k in range(COLS + 1):
        add_box(coll, f"post_{k}", (x0 + k * BAY, 0.22, BASE_Z + height / 2), (0.04, 0.54, height), mats["steel"], 0.004)
    for r in range(ROWS + 1):
        add_box(coll, f"shelf_{r}", (0, 0.22, BASE_Z + r * PITCH), (COLS * BAY, 0.54, 0.018), mats["steel"], 0.003)


def build_monitors(coll, mats, screens, rng):
    mesh, _ = crt.build_crt_mesh()
    for m in (mats["plastic"], mats["glass_base"], mats["vent"], mats["steel"], mats["led"]):
        mesh.materials.append(m)
    objs = {}
    for r in range(ROWS):
        for c in range(COLS):
            ob = bpy.data.objects.new(f"crt_{r}_{c}", mesh)
            x, y, _ = monitor_position(r, c)
            s = rng.uniform(0.9, 1.06)
            ob.location = (x + rng.uniform(-0.012, 0.012), y + (0.0 if rng.random() > 0.2 else rng.uniform(0.0, 0.06)), BASE_Z + r * PITCH + 0.22 * s)
            ob.rotation_euler = (0, 0, math.radians(rng.uniform(-2.2, 2.2)))
            ob.scale = (s, s, s)
            coll.objects.link(ob)
            key = "green_a" if (r, c) == HERO else rng.choice(WEIGHTS)
            slot = ob.material_slots[SLOT_GLASS]
            slot.link = "OBJECT"
            slot.material = screens[key] if key else mats["glass_off"]
            objs[(r, c)] = ob
    return objs


def build_tray_and_cables(coll, mats, rng):
    steel, rub = mats["steel"], mats["rubber"]
    tray_z, tray_y = 3.02, -0.55
    for side in (-0.2, 0.2):
        add_box(coll, "tray_rail", (0, tray_y + side, tray_z), (5.6, 0.03, 0.09), steel, 0.004)
    for i in range(46):
        add_box(coll, "tray_rung", (-2.7 + i * 0.118, tray_y, tray_z - 0.04), (0.025, 0.44, 0.012), steel, 0.002)
    for i in range(6):
        pts = [(-2.8 + j * 1.12, tray_y + rng.uniform(-0.12, 0.12), tray_z + 0.02 + rng.uniform(0, 0.05)) for j in range(6)]
        crt.add_cable(f"bundle_{i}", pts, rng.uniform(0.016, 0.026), rub, coll, seed=i, sag=0.03)
    x0 = -(COLS - 1) / 2 * BAY - BAY / 2
    for k in (1, 3, 4, 6, 8):
        x = x0 + k * BAY
        bottom = BASE_Z + rng.choice([1, 2, 3]) * PITCH
        pts = [(x - 0.02, tray_y, tray_z), (x - 0.02, -0.25, tray_z - 0.25), (x + 0.015, FRONT_Y - 0.06, tray_z - 0.7),
               (x + 0.02, FRONT_Y - 0.06, (tray_z + bottom) / 2), (x, FRONT_Y - 0.05, bottom + 0.1), (x, 0.25, bottom - 0.02)]
        crt.add_cable(f"drop_{k}", pts, rng.uniform(0.014, 0.022), rub, coll, seed=k, sag=0.0)
    for i in range(4):
        x = rng.uniform(-1.6, 1.6)
        pts = [(x, -1.15, 0.3), (x + rng.uniform(-0.3, 0.3), -1.4, 0.03), (x + rng.uniform(-1, 1), -2.2, 0.02),
               (x + rng.uniform(-1.6, 1.6), -3.2, 0.02), (x + rng.uniform(-2, 2), -4.4, 0.02), (x + rng.uniform(-2, 2), -6.0, 0.02)]
        crt.add_cable(f"floor_{i}", pts, rng.uniform(0.02, 0.034), rub, coll, seed=40 + i, sag=0.0)


def build_status_array(coll, mats, rng):
    """Rows of tiny status LEDs set into the lintel face."""
    me = bpy.data.meshes.new("led_chip")
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["led"])
    y_face = -0.35 - 0.975
    for row in range(3):
        for i in range(48):
            if rng.random() < 0.3:
                continue
            ob = bpy.data.objects.new("led", me)
            ob.scale = (0.014, 0.004, 0.009)
            ob.location = (-2.6 + i * 0.11 + (0.5 if i % 12 > 5 else 0) * 0.0, y_face - 0.002, 3.28 + row * 0.1)
            coll.objects.link(ob)
