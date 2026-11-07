"""Gallery shell: board-panel concrete walls with reveal gaps, recessed-slot ceiling, polished floor, lights, haze."""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from nodekit import node

HALF_W, Y_BACK, DEPTH, HEIGHT = 4.2, 0.62, 14.4, 4.8
Y_FRONT = Y_BACK - DEPTH
PW, PH, GAP, PT, Z0 = 1.2, 2.35, 0.005, 0.03, 0.05
SLOTS_X = (-2.1, 0.0, 2.1)
SLOT_W = 0.12
_MESHES = {}


def block(coll, name, size, loc, mat, rot=(0.0, 0.0, 0.0), bevel=0.002):
    """Box mesh centred on its own origin (front face = local -Y), placed by the object transform."""
    key = (tuple(round(s, 4) for s in size), bevel, mat.name)
    me = _MESHES.get(key)
    if me is None:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((*size, 1.0)))
        if bevel:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES")
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mat)
        _MESHES[key] = me
    ob = bpy.data.objects.new(name, me)
    ob.location, ob.rotation_euler = loc, rot
    coll.objects.link(ob)
    return ob


def _wall(coll, mats, name, centre_of, rot, count):
    """Two rows of 1.2 m panels; centre_of(i) -> (x, y) of panel i's centre line, panel faces -> room."""
    for i in range(count):
        x, y = centre_of(i)
        for r in range(2):
            z = Z0 + PH / 2 + r * PH
            block(coll, f"{name}_{i}_{r}", (PW - GAP, PT, PH - GAP), (x, y, z), mats["concrete"], rot)


def build_shell(coll, mats):
    conc, rev = mats["concrete"], mats["reveal"]
    L = DEPTH + 1.0
    block(coll, "floor", (2 * HALF_W + 1.6, L, 0.5), (0, Y_BACK - DEPTH / 2, -0.25), mats["floor"], bevel=0.0)
    block(coll, "back_rev", (2 * HALF_W + 1.0, 0.3, HEIGHT + 0.4), (0, Y_BACK + PT + 0.15, HEIGHT / 2), rev, bevel=0.0)
    block(coll, "front_wall", (2 * HALF_W + 1.0, 0.3, HEIGHT + 0.4), (0, Y_FRONT - 0.15, HEIGHT / 2), conc, bevel=0.0)
    for sx in (-1, 1):
        block(coll, f"side_rev_{sx}", (0.3, L, HEIGHT + 0.4), (sx * (HALF_W + PT + 0.15), Y_BACK - DEPTH / 2, HEIGHT / 2), rev, bevel=0.0)
    block(coll, "roof_rev", (2 * HALF_W + 1.0, L, 0.3), (0, Y_BACK - DEPTH / 2, HEIGHT + PT + 0.15), rev, bevel=0.0)
    nb, ns = int(2 * HALF_W / PW + 0.5), int(DEPTH / PW + 0.5)
    _wall(coll, mats, "back", lambda i: (-HALF_W + PW / 2 + i * PW, Y_BACK + PT / 2), (0, 0, 0), nb)
    _wall(coll, mats, "right", lambda i: (HALF_W + PT / 2, Y_BACK - PW / 2 - i * PW), (0, 0, math.radians(-90)), ns)
    _wall(coll, mats, "left", lambda i: (-HALF_W - PT / 2, Y_BACK - PW / 2 - i * PW), (0, 0, math.radians(90)), ns)
    build_ceiling(coll, mats)


def build_ceiling(coll, mats):
    """Concrete soffit panels with three flush linear light slots running toward the installation."""
    edges = [-HALF_W - 0.05]
    for sx in SLOTS_X:
        edges += [sx - SLOT_W / 2, sx + SLOT_W / 2]
    edges.append(HALF_W + 0.05)
    nchunk = int(DEPTH / 2.4 + 0.5)
    for k in range(0, len(edges), 2):
        x0, x1 = edges[k], edges[k + 1]
        for j in range(nchunk):
            y = Y_BACK - 1.2 - j * 2.4
            block(coll, f"ceil_{k}_{j}", (x1 - x0 - GAP, PT, 2.4 - GAP), ((x0 + x1) / 2, y, HEIGHT + PT / 2), mats["ceiling"], (math.radians(90), 0, 0))
    for i, sx in enumerate(SLOTS_X):
        block(coll, f"slot_{i}", (SLOT_W - 0.01, DEPTH, 0.02), (sx, Y_BACK - DEPTH / 2, HEIGHT + 0.015), mats["slot"], bevel=0.0)


def _aim(ob, target):
    ob.rotation_euler = (Vector(target) - Vector(ob.location)).to_track_quat("-Z", "Y").to_euler()


def _spot(coll, mats, name, loc, target, energy, cone=26.0):
    """Track spot with a visible black barrel; the beam is aimed at `target` (grazing the concrete)."""
    sp = bpy.data.lights.new(name, "SPOT")
    sp.color, sp.energy = (1.0, 0.95, 0.88), energy
    sp.spot_size, sp.spot_blend, sp.shadow_soft_size = math.radians(cone), 0.85, 0.045
    so = bpy.data.objects.new(name, sp)
    so.location = loc
    _aim(so, target)
    so.visible_camera = False
    coll.objects.link(so)
    back = so.rotation_euler.to_matrix() @ Vector((0.0, 0.0, 0.095))
    block(coll, f"head_{name}", (0.085, 0.085, 0.17), Vector(loc) + back, mats["powder"], tuple(so.rotation_euler), bevel=0.01)


def build_lights(coll, mats, key=1.0):
    wash = bpy.data.lights.new("wash", "AREA")
    wash.shape, wash.size, wash.size_y, wash.spread = "RECTANGLE", 2 * HALF_W - 0.4, 0.12, math.radians(75)
    wash.color, wash.energy = (1.0, 0.97, 0.92), 300.0 * key
    wo = bpy.data.objects.new("wash", wash)
    wo.location = (0, Y_BACK - 0.34, HEIGHT - 0.08)
    wo.visible_camera = False
    coll.objects.link(wo)
    z = HEIGHT - 0.12
    for sx in (-1, 1):
        block(coll, f"rail_{sx}", (0.035, DEPTH - 0.4, 0.03), (sx * (HALF_W - 0.5), Y_BACK - DEPTH / 2, HEIGHT - 0.015), mats["powder"], bevel=0.003)
        for k in range(6):
            y = Y_BACK - 1.0 - k * 1.8
            _spot(coll, mats, f"side_{sx}_{k}", (sx * (HALF_W - 0.5), y, z), (sx * HALF_W, y - 0.05, 1.1), 520.0 * key)
    block(coll, "rail_back", (2 * HALF_W - 0.6, 0.035, 0.03), (0, Y_BACK - 0.5, HEIGHT - 0.015), mats["powder"], bevel=0.003)
    for sx, tx, tz in ((-1, 3.4, 0.9), (1, 3.4, 0.9), (-1, 1.15, 3.1), (1, 1.15, 3.1)):
        _spot(coll, mats, f"back_{sx}_{tx}", (sx * tx, Y_BACK - 0.5, z), (sx * tx, Y_BACK, tz), 420.0 * key, cone=24.0)


def build_world(scene, haze=1.0):
    world = bpy.data.worlds.new("gallery")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = node(nt, "ShaderNodeBackground", {"Color": (0.0, 0.0, 0.0, 1.0), "Strength": 0.0})
    out = node(nt, "ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    vol = node(nt, "ShaderNodeVolumeScatter", {"Density": 0.0011 * haze, "Anisotropy": 0.35, "Color": (1.0, 1.0, 1.0, 1.0)})
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
