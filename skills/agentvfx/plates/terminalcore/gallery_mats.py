"""Gallery-variant materials: architectural cast concrete panels, polished concrete floor, powder-coat, honed stone, emitters.

Concrete panels read the panel's own object-space coordinates (X across, Z up) so tie holes land on every panel the same way;
noise detail reads world position so the surface never repeats between neighbours.
"""
from nodekit import fresh, finish, math, remap, mix, vmath, rgb, principled, node


def _noise(nt, vec, scale, detail=4.0, rough=0.55):
    return node(nt, "ShaderNodeTexNoise", {"Vector": vec, "Scale": scale, "Detail": detail, "Roughness": rough}).outputs["Fac"]


def _pores(nt, vec, scale, keep, r_lo, r_hi):
    """Sparse little air-bubble dimples: a Voronoi cell hosts a pore only when its random value passes `keep`."""
    v = node(nt, "ShaderNodeTexVoronoi", {"Vector": vec, "Scale": scale, "Randomness": 1.0}, feature="F1")
    rgb_ = node(nt, "ShaderNodeSeparateColor", {"Color": v.outputs["Color"]})
    sel = remap(nt, rgb_.outputs["Red"], keep, keep + 0.02, 0.0, 1.0, smooth=False)
    radius = math(nt, "ADD", r_lo, math(nt, "MULTIPLY", rgb_.outputs["Green"], r_hi - r_lo))
    shape = remap(nt, v.outputs["Distance"], math(nt, "MULTIPLY", radius, 0.25), radius, 1.0, 0.0)
    return math(nt, "MULTIPLY", sel, shape)


def _tie_holes(nt, local):
    """Round form-tie recesses: 2 columns x 3 rows per 1.2 x 2.35 panel (Ando-style), in panel-local coordinates."""
    sep = node(nt, "ShaderNodeSeparateXYZ", {"Vector": local})
    u, v = sep.outputs["X"], sep.outputs["Z"]
    dx = math(nt, "ABSOLUTE", math(nt, "SUBTRACT", math(nt, "ABSOLUTE", u), 0.3))
    dz = math(nt, "MINIMUM", math(nt, "ABSOLUTE", v), math(nt, "ABSOLUTE", math(nt, "SUBTRACT", math(nt, "ABSOLUTE", v), 0.783)))
    d = vmath(nt, "LENGTH", node(nt, "ShaderNodeCombineXYZ", {"X": dx, "Y": dz, "Z": 0.0}).outputs[0])
    return remap(nt, d, 0.019, 0.029, 1.0, 0.0)


def concrete_panel(name="g_concrete", holes=True, tone=0.30):
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    local = node(nt, "ShaderNodeTexCoord").outputs["Object"]
    rnd = node(nt, "ShaderNodeObjectInfo").outputs["Random"]
    cloud = _noise(nt, pos, 0.45, 6.0, 0.6)
    mottle = _noise(nt, pos, 4.0, 5.0, 0.6)
    streaks = _noise(nt, vmath(nt, "MULTIPLY", pos, (9.0, 9.0, 0.8)), 1.0, 4.0, 0.5)
    fine = _noise(nt, pos, 55.0, 5.0, 0.65)
    grain = _noise(nt, pos, 240.0, 3.0, 0.7)
    p1 = _pores(nt, pos, 70.0, 0.80, 0.10, 0.34)
    p2 = _pores(nt, pos, 210.0, 0.86, 0.12, 0.40)
    tie = _tie_holes(nt, local) if holes else 0.0

    h = math(nt, "ADD", math(nt, "MULTIPLY", fine, 0.55), math(nt, "ADD", math(nt, "MULTIPLY", grain, 0.18), math(nt, "MULTIPLY", mottle, 0.3)))
    h = math(nt, "SUBTRACT", h, math(nt, "ADD", math(nt, "MULTIPLY", p1, 1.1), math(nt, "MULTIPLY", p2, 0.6)))
    if holes:
        h = math(nt, "SUBTRACT", h, math(nt, "MULTIPLY", tie, 3.0))
    bump = node(nt, "ShaderNodeBump", {"Height": h, "Strength": 0.38, "Distance": 0.004}).outputs["Normal"]

    t = remap(nt, cloud, 0.3, 0.7, 0.80, 1.16)
    t = math(nt, "MULTIPLY", t, remap(nt, mottle, 0.35, 0.65, 0.93, 1.07))
    t = math(nt, "MULTIPLY", t, remap(nt, streaks, 0.35, 0.65, 0.93, 1.07))
    t = math(nt, "MULTIPLY", t, math(nt, "ADD", 0.9, math(nt, "MULTIPLY", rnd, 0.2)))
    t = math(nt, "MULTIPLY", t, math(nt, "SUBTRACT", 1.0, math(nt, "ADD", math(nt, "MULTIPLY", p1, 0.5), math(nt, "MULTIPLY", p2, 0.3))))
    if holes:
        t = math(nt, "MULTIPLY", t, math(nt, "SUBTRACT", 1.0, math(nt, "MULTIPLY", tie, 0.55)))
    base = vmath(nt, "MULTIPLY", rgb(nt, tone, tone * 0.992, tone * 0.975), vmath(nt, "SCALE", rgb(nt, 1, 1, 1), t))
    rough = math(nt, "ADD", 0.5, math(nt, "ADD", math(nt, "MULTIPLY", math(nt, "SUBTRACT", mottle, 0.5), 0.3), math(nt, "MULTIPLY", math(nt, "SUBTRACT", rnd, 0.5), 0.1)))
    finish(nt, principled(nt, Base_Color=base, Roughness=rough, Normal=bump, Specular_IOR_Level=0.45))
    return m


def polished_floor(name="g_floor", tone=0.13, joints=True):
    """Ground-and-sealed concrete: soft cloudy gloss, fine aggregate flecks, hairline saw-cut joints on a 2.4 m grid."""
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    sep = node(nt, "ShaderNodeSeparateXYZ", {"Vector": pos})
    cloud = _noise(nt, pos, 0.32, 6.0, 0.6)
    swirl = _noise(nt, vmath(nt, "MULTIPLY", pos, (1.0, 1.0, 0.05)), 1.8, 3.0, 0.5)
    fleck_l = _pores(nt, pos, 150.0, 0.90, 0.14, 0.30)
    fleck_d = _pores(nt, pos, 110.0, 0.92, 0.16, 0.34)
    gx = math(nt, "FRACT", math(nt, "DIVIDE", math(nt, "ADD", sep.outputs["X"], 1.2), 2.4))
    gy = math(nt, "FRACT", math(nt, "DIVIDE", sep.outputs["Y"], 2.4))
    jx = math(nt, "ADD", remap(nt, gx, 0.0, 0.0014, 1.0, 0.0), remap(nt, gx, 0.9986, 1.0, 0.0, 1.0))
    jy = math(nt, "ADD", remap(nt, gy, 0.0, 0.0014, 1.0, 0.0), remap(nt, gy, 0.9986, 1.0, 0.0, 1.0))
    joint = math(nt, "MULTIPLY", math(nt, "MAXIMUM", jx, jy), 1.0 if joints else 0.0)

    t = math(nt, "MULTIPLY", remap(nt, cloud, 0.3, 0.7, 0.8, 1.15), remap(nt, swirl, 0.3, 0.7, 0.92, 1.08))
    t = math(nt, "MULTIPLY", t, math(nt, "SUBTRACT", math(nt, "ADD", 1.0, math(nt, "MULTIPLY", fleck_l, 0.7)), math(nt, "MULTIPLY", fleck_d, 0.5)))
    t = math(nt, "MULTIPLY", t, math(nt, "SUBTRACT", 1.0, math(nt, "MULTIPLY", joint, 0.75)))
    base = vmath(nt, "MULTIPLY", rgb(nt, tone, tone * 0.99, tone * 0.97), vmath(nt, "SCALE", rgb(nt, 1, 1, 1), t))
    rough = math(nt, "ADD", 0.05, math(nt, "ADD", math(nt, "MULTIPLY", remap(nt, cloud, 0.4, 0.7), 0.12), math(nt, "MULTIPLY", remap(nt, swirl, 0.4, 0.65), 0.08)))
    rough = math(nt, "MAXIMUM", rough, math(nt, "MULTIPLY", joint, 0.6))
    h = math(nt, "SUBTRACT", math(nt, "MULTIPLY", _noise(nt, pos, 70.0, 3.0, 0.6), 0.2), math(nt, "MULTIPLY", joint, 1.0))
    bump = node(nt, "ShaderNodeBump", {"Height": h, "Strength": 0.12, "Distance": 0.003}).outputs["Normal"]
    finish(nt, principled(nt, Base_Color=base, Roughness=rough, Normal=bump, Specular_IOR_Level=0.7, Coat_Weight=0.25, Coat_Roughness=0.06))
    return m


def powdercoat(name="g_powder", tone=0.028, rough=0.42):
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    peel = _noise(nt, pos, 700.0, 2.0, 0.5)
    bump = node(nt, "ShaderNodeBump", {"Height": peel, "Strength": 0.05, "Distance": 0.0003}).outputs["Normal"]
    finish(nt, principled(nt, Base_Color=(tone, tone, tone * 1.04), Roughness=rough, Normal=bump, Specular_IOR_Level=0.55))
    return m


def reveal(name="g_reveal"):
    """Near-black backing seen only through joints and shadow gaps."""
    m, nt = fresh(name)
    finish(nt, principled(nt, Base_Color=(0.012, 0.012, 0.013), Roughness=0.85))
    return m


def honed_stone(name="g_stone", tone=0.035):
    """Honed limestone: soft cloudy tone, thin sedimentary veins along the length, fine hone grain, per-region gloss."""
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    cloud = _noise(nt, pos, 1.4, 4.0, 0.5)
    big = _noise(nt, pos, 0.55, 3.0, 0.5)
    fleck = _pores(nt, pos, 260.0, 0.80, 0.12, 0.3)
    strata = _noise(nt, vmath(nt, "MULTIPLY", pos, (0.35, 5.0, 2.5)), 1.0, 5.0, 0.55)
    vein = remap(nt, math(nt, "ABSOLUTE", math(nt, "SUBTRACT", strata, 0.5)), 0.0, 0.035, 1.0, 0.0)
    hone = _noise(nt, pos, 420.0, 3.0, 0.6)
    t = math(nt, "MULTIPLY", remap(nt, cloud, 0.3, 0.7, 0.88, 1.12), remap(nt, big, 0.3, 0.7, 0.84, 1.14))
    t = math(nt, "MULTIPLY", t, math(nt, "SUBTRACT", 1.0, math(nt, "ADD", math(nt, "MULTIPLY", fleck, 0.22), math(nt, "MULTIPLY", vein, 0.16))))
    warm = remap(nt, big, 0.35, 0.65, 0.0, 1.0)
    base = vmath(nt, "SCALE", mix(nt, warm, rgb(nt, tone * 0.97, tone, tone * 1.06), rgb(nt, tone * 1.05, tone * 1.0, tone * 0.93)), t)
    rough = math(nt, "ADD", 0.22, math(nt, "ADD", math(nt, "MULTIPLY", math(nt, "SUBTRACT", cloud, 0.5), 0.3), math(nt, "MULTIPLY", vein, 0.08)))
    bump = node(nt, "ShaderNodeBump", {"Height": math(nt, "SUBTRACT", hone, math(nt, "MULTIPLY", fleck, 1.2)), "Strength": 0.10, "Distance": 0.0006}).outputs["Normal"]
    finish(nt, principled(nt, Base_Color=base, Roughness=rough, Normal=bump, Specular_IOR_Level=0.6, Coat_Weight=0.2, Coat_Roughness=0.1))
    return m


def glass_off(name="g_glass_off"):
    """Powered-down CRT faceplate: dark tinted glass, a soft low-gloss reflection (dust and smudge keep it from mirroring the ceiling slots)."""
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    dust = _noise(nt, pos, 22.0, 5.0, 0.6)
    smudge = _noise(nt, pos, 6.0, 3.0, 0.5)
    rough = math(nt, "ADD", 0.2, math(nt, "MULTIPLY", math(nt, "MULTIPLY", remap(nt, smudge, 0.4, 0.75), remap(nt, dust, 0.4, 0.8)), 0.14))
    finish(nt, principled(nt, Base_Color=(0.003, 0.0035, 0.0035), Roughness=rough, IOR=1.52, Specular_IOR_Level=0.3, Emission_Color=(0.02, 0.03, 0.025, 1.0), Emission_Strength=0.02))
    return m


def emitter(name, color, strength):
    m, nt = fresh(name)
    e = node(nt, "ShaderNodeEmission", {"Color": color, "Strength": strength})
    finish(nt, e)
    return m
