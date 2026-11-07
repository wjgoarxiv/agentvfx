"""CRT monitor mesh: bevelled bezel, loft housing, curved glass, vents, knobs, LED. Front faces -Y, origin = front centre."""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

SLOT_PLASTIC, SLOT_GLASS, SLOT_VENT, SLOT_STEEL, SLOT_LED = range(5)


def _new(bm, before):
    """Faces created since the snapshot, by identity (BMesh reuses freed slots, so index slicing is unsafe)."""
    return [f for f in bm.faces if f not in before]


def _tag(bm, before, slot):
    for f in _new(bm, before):
        f.material_index = slot


def _bevel(bm, before, width, segs=2):
    edges = {e for f in _new(bm, before) for e in f.edges}
    bmesh.ops.bevel(bm, geom=list(edges), offset=width, segments=segs, affect="EDGES")


def box(bm, center, size, slot, bevel=0.004):
    start = set(bm.faces)
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1.0)))
    if bevel:
        _bevel(bm, start, bevel)
    _tag(bm, start, slot)


def loft(bm, rings, slot, bevel=0.005):
    """rings: [(y, half_w, half_h, z_off)] -> closed rectangular tube with end caps."""
    start = set(bm.faces)
    loops = []
    for y, hw, hh, zo in rings:
        loops.append([bm.verts.new(p) for p in ((-hw, y, zo - hh), (hw, y, zo - hh), (hw, y, zo + hh), (-hw, y, zo + hh))])
    for a, b in zip(loops, loops[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(loops[0][::-1])
    bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=_new(bm, start))
    if bevel:
        _bevel(bm, start, bevel)
    _tag(bm, start, slot)


def cylinder(bm, center, radius, depth, slot, axis_y=True, seg=14):
    start = set(bm.faces)
    rot = Matrix.Rotation(math.pi / 2, 4, "X") if axis_y else Matrix.Identity(4)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=radius, radius2=radius, depth=depth, matrix=Matrix.Translation(center) @ rot)
    _tag(bm, start, slot)


def glass(bm, half_w, half_h, z_off, bulge, nx=22, ny=16):
    """Curved CRT faceplate (spherical-ish bulge toward -Y) with 0..1 UVs; flat-ish corners."""
    start = set(bm.faces)
    grid = [[None] * (nx + 1) for _ in range(ny + 1)]
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            x, z = (u - 0.5) * 2.0, (v - 0.5) * 2.0
            y = -bulge * (1.0 - 0.5 * (x * x + z * z)) + bulge * 0.0
            grid[j][i] = bm.verts.new((x * half_w, y, z_off + z * half_h))
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    uvl = bm.loops.layers.uv.verify()
    faces = _new(bm, start)
    for f in faces:
        for lp in f.loops:
            c = lp.vert.co
            lp[uvl].uv = ((c.x / half_w) * 0.5 + 0.5, ((c.z - z_off) / half_h) * 0.5 + 0.5)
    bmesh.ops.reverse_faces(bm, faces=faces)
    _tag(bm, start, SLOT_GLASS)


def build_crt_mesh(name="crt"):
    bm = bmesh.new()
    sw, sh, zc = 0.36, 0.26, 0.02
    ow, oh = 0.50, 0.42
    # bezel: four bars around the screen opening, bottom bar deeper for controls
    box(bm, (-(sw / 2 + 0.035), 0.035, 0.02), (0.07, 0.07, oh - 0.16), SLOT_PLASTIC, 0.006)
    box(bm, ((sw / 2 + 0.035), 0.035, 0.02), (0.07, 0.07, oh - 0.16), SLOT_PLASTIC, 0.006)
    # black gasket ring hugging the glass
    for sx in (-1, 1):
        box(bm, (sx * (sw / 2 + 0.006), 0.012, zc), (0.012, 0.03, sh + 0.024), SLOT_VENT, 0.003)
    for sz in (-1, 1):
        box(bm, (0.0, 0.012, zc + sz * (sh / 2 + 0.006)), (sw, 0.03, 0.012), SLOT_VENT, 0.003)
    box(bm, (0.0, 0.035, oh / 2 - 0.03), (sw + 0.14, 0.07, 0.06), SLOT_PLASTIC, 0.006)
    box(bm, (0.0, 0.035, -oh / 2 + 0.05), (sw + 0.14, 0.07, 0.10), SLOT_PLASTIC, 0.006)
    # dark inner skirt behind the glass edge so no light leaks around it
    box(bm, (0.0, 0.07, zc), (sw + 0.005, 0.08, sh + 0.005), SLOT_VENT, 0.0)
    loft(bm, [(0.07, 0.235, 0.205, 0.0), (0.2, 0.225, 0.195, 0.0), (0.3, 0.17, 0.15, 0.0)], SLOT_PLASTIC, 0.008)
    loft(bm, [(0.3, 0.1, 0.09, 0.0), (0.5, 0.075, 0.07, 0.0)], SLOT_PLASTIC, 0.004)
    # glass sits just behind the bezel plane; bulge pokes forward past it
    glass(bm, sw / 2 - 0.002, sh / 2 - 0.002, zc, 0.022)
    # vent slots on the top shell
    for i in range(9):
        box(bm, (-0.12 + i * 0.03, 0.2, 0.2), (0.012, 0.09, 0.006), SLOT_VENT, 0.0)
    for i in range(6):
        box(bm, (0.17, 0.12 + i * 0.03, 0.0), (0.006, 0.014, 0.18), SLOT_VENT, 0.0)
    # controls on the lower bar
    cylinder(bm, (0.12, -0.012, -oh / 2 + 0.05), 0.014, 0.03, SLOT_PLASTIC)
    cylinder(bm, (0.17, -0.012, -oh / 2 + 0.05), 0.014, 0.03, SLOT_PLASTIC)
    box(bm, (-0.15, -0.002, -oh / 2 + 0.05), (0.05, 0.012, 0.018), SLOT_STEEL, 0.002)
    box(bm, (0.065, -0.003, -oh / 2 + 0.05), (0.03, 0.01, 0.014), SLOT_PLASTIC, 0.002)
    for i in range(5):
        box(bm, (-0.075 - i * 0.012, 0.0, -oh / 2 + 0.075), (0.006, 0.008, 0.02), SLOT_VENT, 0.0)
    cylinder(bm, (0.205, -0.004, -oh / 2 + 0.05), 0.0045, 0.008, SLOT_LED, seg=8)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me, (sw, sh)


def add_cable(name, pts, radius, material, collection, seed=0, sag=0.0):
    """NURBS tube through pts (list of xyz) with optional parabolic sag between ends."""
    rng = random.Random(seed)
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.resolution_u = 10
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    n = len(pts) - 1
    for i, p in enumerate(pts):
        t = i / max(n, 1)
        sp.points[i].co = (p[0] + rng.uniform(-0.01, 0.01), p[1] + rng.uniform(-0.01, 0.01), p[2] - sag * 4 * t * (1 - t), 1.0)
    sp.order_u = 4
    sp.use_endpoint_u = True
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(material)
    collection.objects.link(ob)
    return ob
