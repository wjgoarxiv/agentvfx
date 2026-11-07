"""Brutalist room shell, haze world, and the single cold key light (slit window on the left wall)."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from nodekit import fresh, finish, math as nmath, remap, node, rgb, vmath

# Room: x -5.5..5.5, y -12..0.62 (wall niche back at y=0.62), z 0..4.6
BACK_Y = 0.62
CEIL_Z = 4.6


def add_box(coll, name, center, size, mat, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1.0)))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def build_room(coll, mats):
    conc, floor = mats["concrete"], mats["floor"]
    add_box(coll, "floor", (0, -5.69, -0.25), (11.2, 12.62, 0.5), floor)
    add_box(coll, "ceiling", (0, -5.69, CEIL_Z + 0.4), (11.2, 12.62, 0.8), conc)
    add_box(coll, "back_wall", (0, BACK_Y + 0.4, CEIL_Z / 2), (11.2, 0.8, CEIL_Z + 1.0), conc)
    add_box(coll, "right_wall", (5.5 + 0.4, -5.69, CEIL_Z / 2), (0.8, 12.62, CEIL_Z + 1.0), conc)
    add_box(coll, "front_wall", (0, -12.4, CEIL_Z / 2), (11.2, 0.8, CEIL_Z + 1.0), conc)
    # left wall with a full-height slit window at y = -5.0
    add_box(coll, "left_wall_a", (-5.9, -8.75, CEIL_Z / 2), (0.8, 6.5, CEIL_Z + 1.0), conc)
    add_box(coll, "left_wall_b", (-5.9, -1.69, CEIL_Z / 2), (0.8, 6.22, CEIL_Z + 1.0), conc)
    for i, (x, z, w) in enumerate(((-2.3, 2.2, 6.0), (1.5, 0.55, 3.0), (-4.9, 1.6, 0.06))):
        add_box(coll, f"strip_{i}", (x, -11.96, z), (w, 0.05, 0.07 if w > 1 else 2.2), mats["strip"])
    # brutalist piers + lintel framing the monitor niche
    for sx in (-1, 1):
        add_box(coll, f"pier_{sx}", (sx * 3.35, -0.35, CEIL_Z / 2), (1.0, 1.95, CEIL_Z), conc, 0.012)
    add_box(coll, "lintel", (0, -0.35, 3.55), (5.7, 1.95, 0.9), conc, 0.012)
    add_box(coll, "plinth", (0, -0.3, 0.12), (5.7, 1.8, 0.24), conc, 0.01)


def build_world_and_light(scene, coll, strength=1.0, haze=1.0, shot="wall"):
    world = bpy.data.worlds.new("haze")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = node(nt, "ShaderNodeBackground", {"Color": (0.002, 0.003, 0.006, 1.0), "Strength": 1.0})
    out = node(nt, "ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    wisp = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 0.35), "Detail": 3.0}).outputs["Fac"]
    dens = nmath(nt, "MULTIPLY", remap(nt, wisp, 0.25, 0.75, 0.5, 1.5), 0.008 * haze)
    vol = node(nt, "ShaderNodeVolumeScatter", {"Density": dens, "Anisotropy": 0.3, "Color": (0.8, 0.88, 1.0, 1.0)})
    nt.links.new(vol.outputs[0], out.inputs["Volume"])

    key = bpy.data.lights.new("key", "AREA")
    key.shape = "RECTANGLE"
    key.size, key.size_y = 3.6, 0.6
    key.color = (0.55, 0.72, 1.0)
    key.energy = 1500.0 * strength
    key.spread = math.radians(35)
    ko = bpy.data.objects.new("key", key)
    ko.location = (-7.1, -5.55, 2.2)
    ko.rotation_euler = (0.0, math.radians(-90), math.radians(18))
    coll.objects.link(ko)
    if shot == "closeup":
        spot = bpy.data.lights.new("key_close", "SPOT")
        spot.color, spot.energy = (0.6, 0.78, 1.0), 420.0 * strength
        spot.spot_size, spot.spot_blend, spot.shadow_soft_size = math.radians(30), 0.7, 0.08
        so = bpy.data.objects.new("key_close", spot)
        so.location = (1.6, -2.2, 3.0)
        direction = Vector((0.0, -0.05, 1.55)) - Vector(so.location)
        so.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        coll.objects.link(so)
    return ko
