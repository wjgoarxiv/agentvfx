"""Procedural PBR materials: board-formed concrete, polished floor, plastics, steel, rubber, LEDs, CRT glass+phosphor."""
import math as pymath

from nodekit import fresh, finish, math, remap, mix, vmath, rgb, principled, node


def _ao(nt, dist=0.08):
    return node(nt, "ShaderNodeAmbientOcclusion", {"Distance": dist}, samples=4).outputs["AO"]


def _position_axes(nt):
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    sep = node(nt, "ShaderNodeSeparateXYZ", {"Vector": pos})
    horiz = math(nt, "ADD", sep.outputs["X"], sep.outputs["Y"])
    return pos, horiz, sep.outputs["Z"], sep.outputs["X"], sep.outputs["Y"]


def concrete(name="concrete", polished=False, tone=0.16):
    m, nt = fresh(name)
    pos, h, z, x, y = _position_axes(nt)
    along = y if polished else h
    across = x if polished else z
    patches = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 0.7), "Detail": 8.0, "Roughness": 0.62}).outputs["Fac"]
    fine = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 70.0), "Detail": 6.0, "Roughness": 0.7}).outputs["Fac"]
    pores = node(nt, "ShaderNodeTexVoronoi", {"Vector": vmath(nt, "SCALE", pos, 38.0)}, feature="F1").outputs["Distance"]
    streak_in = node(nt, "ShaderNodeCombineXYZ", {"X": math(nt, "MULTIPLY", along, 6.0), "Y": 0.0, "Z": math(nt, "MULTIPLY", across, 0.5)})
    streaks = node(nt, "ShaderNodeTexNoise", {"Vector": streak_in.outputs[0], "Detail": 5.0}).outputs["Fac"]
    board_s = math(nt, "DIVIDE", across, 0.32)
    board_fr = math(nt, "FRACT", board_s)
    board_id = math(nt, "FLOOR", board_s)
    board_rnd = node(nt, "ShaderNodeTexWhiteNoise", {"W": board_id}, noise_dimensions="1D").outputs["Value"]
    groove = remap(nt, board_fr, 0.0, 0.05, 1.0, 0.0)
    joint_s = math(nt, "DIVIDE", along, 2.4)
    joint = remap(nt, math(nt, "FRACT", joint_s), 0.0, 0.01, 1.0, 0.0)
    if polished:
        groove = math(nt, "MULTIPLY", groove, 0.0)
        joint = remap(nt, math(nt, "FRACT", math(nt, "DIVIDE", along, 1.8)), 0.0, 0.004, 1.0, 0.0)
        joint = math(nt, "MAXIMUM", joint, remap(nt, math(nt, "FRACT", math(nt, "DIVIDE", across, 1.8)), 0.0, 0.004, 1.0, 0.0))
    grid = node(nt, "ShaderNodeTexVoronoi", {"Vector": node(nt, "ShaderNodeCombineXYZ", {"X": math(nt, "DIVIDE", along, 1.2), "Y": math(nt, "DIVIDE", across, 1.2), "Z": 0.0}).outputs[0], "Randomness": 0.0}, feature="F1").outputs["Distance"]
    holes = remap(nt, grid, 0.055, 0.04, 0.0, 1.0)
    if polished:
        holes = math(nt, "MULTIPLY", holes, 0.0)

    height = math(nt, "ADD", math(nt, "MULTIPLY", fine, 0.5), math(nt, "MULTIPLY", patches, 0.5))
    height = math(nt, "SUBTRACT", height, math(nt, "MULTIPLY", math(nt, "MAXIMUM", groove, joint), 0.55))
    height = math(nt, "SUBTRACT", height, math(nt, "MULTIPLY", holes, 1.2))
    height = math(nt, "ADD", height, math(nt, "MULTIPLY", pores, 0.15))
    bump = node(nt, "ShaderNodeBump", {"Height": height, "Strength": 0.25 if polished else 0.55, "Distance": 0.012}).outputs["Normal"]

    tone_v = math(nt, "MULTIPLY", remap(nt, patches, 0.3, 0.7, 0.55, 1.35), math(nt, "ADD", 0.82, math(nt, "MULTIPLY", board_rnd, 0.3 if not polished else 0.0)))
    tone_v = math(nt, "MULTIPLY", tone_v, remap(nt, streaks, 0.35, 0.7, 1.15, 0.6))
    tone_v = math(nt, "MULTIPLY", tone_v, math(nt, "SUBTRACT", 1.0, math(nt, "MULTIPLY", math(nt, "MAXIMUM", groove, joint), 0.55)))
    tone_v = math(nt, "MULTIPLY", tone_v, math(nt, "SUBTRACT", 1.0, math(nt, "MULTIPLY", holes, 0.85)))
    tone_v = math(nt, "MULTIPLY", tone_v, math(nt, "ADD", 0.45, math(nt, "MULTIPLY", _ao(nt, 0.6), 0.55)))
    base = vmath(nt, "MULTIPLY", rgb(nt, tone * 0.93, tone * 0.97, tone * 1.02), vmath(nt, "SCALE", rgb(nt, 1, 1, 1), tone_v))
    rough = math(nt, "ADD", 0.55 if not polished else 0.06, math(nt, "MULTIPLY", math(nt, "SUBTRACT", fine, 0.5), 0.5 if not polished else 0.2))
    if polished:
        rough = math(nt, "ADD", rough, math(nt, "MULTIPLY", remap(nt, patches, 0.45, 0.7), 0.3))
    b = principled(nt, Base_Color=base, Roughness=math(nt, "MAXIMUM", rough, 0.05, clamp=True), Normal=bump, Specular_IOR_Level=0.5 if not polished else 0.8)
    finish(nt, b)
    return m


def plastic(name="plastic", palette=((0.035, 0.037, 0.04), (0.24, 0.225, 0.19), (0.05, 0.06, 0.055))):
    """Colour picked per object via Object Info random so one material serves many monitors."""
    m, nt = fresh(name)
    r = node(nt, "ShaderNodeObjectInfo").outputs["Random"]
    c0, c1, c2 = (rgb(nt, *c) for c in palette)
    col = mix(nt, remap(nt, r, 0.5, 0.52, 0.0, 1.0, smooth=False), c0, c1)
    col = mix(nt, remap(nt, r, 0.82, 0.84, 0.0, 1.0, smooth=False), col, c2)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    grain = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 260.0), "Detail": 3.0}).outputs["Fac"]
    blot = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 5.0), "Detail": 4.0}).outputs["Fac"]
    ao = _ao(nt, 0.05)
    col = vmath(nt, "MULTIPLY", col, vmath(nt, "SCALE", rgb(nt, 1, 1, 1), math(nt, "MULTIPLY", math(nt, "ADD", 0.5, math(nt, "MULTIPLY", ao, 0.5)), remap(nt, blot, 0.3, 0.7, 0.8, 1.15))))
    bump = node(nt, "ShaderNodeBump", {"Height": grain, "Strength": 0.1, "Distance": 0.0004}).outputs["Normal"]
    rough = math(nt, "ADD", 0.38, math(nt, "MULTIPLY", blot, 0.25))
    finish(nt, principled(nt, Base_Color=col, Roughness=rough, Normal=bump, Specular_IOR_Level=0.5))
    return m


def steel(name="steel", tone=0.32):
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    brushed = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "MULTIPLY", pos, (90.0, 2.0, 2.0)), "Detail": 3.0}).outputs["Fac"]
    patina = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 3.0), "Detail": 6.0}).outputs["Fac"]
    col = vmath(nt, "SCALE", rgb(nt, tone, tone * 1.02, tone * 1.06), math(nt, "MULTIPLY", remap(nt, patina, 0.3, 0.7, 0.5, 1.2), math(nt, "ADD", 0.5, math(nt, "MULTIPLY", _ao(nt, 0.1), 0.5))))
    bump = node(nt, "ShaderNodeBump", {"Height": brushed, "Strength": 0.08, "Distance": 0.0005}).outputs["Normal"]
    finish(nt, principled(nt, Base_Color=col, Metallic=1.0, Roughness=math(nt, "ADD", 0.28, math(nt, "MULTIPLY", patina, 0.3)), Normal=bump))
    return m


def rubber(name="rubber", tint=(0.012, 0.012, 0.013)):
    m, nt = fresh(name)
    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    n1 = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 90.0), "Detail": 3.0}).outputs["Fac"]
    bump = node(nt, "ShaderNodeBump", {"Height": n1, "Strength": 0.1, "Distance": 0.0006}).outputs["Normal"]
    finish(nt, principled(nt, Base_Color=tint, Roughness=0.42, Normal=bump, Sheen_Weight=0.2, Sheen_Roughness=0.5, Specular_IOR_Level=0.55))
    return m


def led(name, color, power):
    m, nt = fresh(name)
    finish(nt, principled(nt, Base_Color=(0.01, 0.01, 0.01), Emission_Color=color, Emission_Strength=power, Roughness=0.2))
    return m


def led_random(name, power):
    """Status LED whose colour (green / amber / red / cyan) is chosen per object."""
    m, nt = fresh(name)
    r = node(nt, "ShaderNodeObjectInfo").outputs["Random"]
    col = mix(nt, remap(nt, r, 0.40, 0.41, 0.0, 1.0, smooth=False), rgb(nt, 0.1, 1.0, 0.2), rgb(nt, 1.0, 0.45, 0.05))
    col = mix(nt, remap(nt, r, 0.75, 0.76, 0.0, 1.0, smooth=False), col, rgb(nt, 1.0, 0.04, 0.03))
    col = mix(nt, remap(nt, r, 0.92, 0.93, 0.0, 1.0, smooth=False), col, rgb(nt, 0.1, 0.7, 1.0))
    finish(nt, principled(nt, Base_Color=(0.01, 0.01, 0.01), Emission_Color=col, Emission_Strength=power, Roughness=0.2))
    return m


def vent_black(name="vent_black"):
    m, nt = fresh(name)
    finish(nt, principled(nt, Base_Color=(0.004, 0.004, 0.004), Roughness=0.7))
    return m


def screen(name, image, tint, anim, rows_visible=0.5, lines=140.0, strength=5.0, zoom=1.0):
    """CRT glass over phosphor: emissive scrolling image * scanlines * vignette, glossy dusty glass on top.

    anim: dict of Value nodes the caller keys per frame -> {'scroll': Value node, 'time': Value node}.
    """
    m, nt = fresh(name)
    uv = node(nt, "ShaderNodeUVMap").outputs["UV"]
    sep = node(nt, "ShaderNodeSeparateXYZ", {"Vector": uv})
    u, v = sep.outputs["X"], sep.outputs["Y"]
    rnd = node(nt, "ShaderNodeObjectInfo").outputs["Random"]
    scroll = node(nt, "ShaderNodeValue")
    scroll.label = "scroll"
    tnode = node(nt, "ShaderNodeValue")
    tnode.label = "time"
    anim["scroll"], anim["time"] = scroll, tnode
    off_y = math(nt, "ADD", scroll.outputs[0], math(nt, "MULTIPLY", math(nt, "FLOOR", math(nt, "MULTIPLY", rnd, 64.0)), 1.0 / 64.0))
    pu = math(nt, "ADD", math(nt, "MULTIPLY", u, 0.94 * zoom), 0.0)
    pv = math(nt, "ADD", math(nt, "MULTIPLY", v, rows_visible * zoom), off_y)
    coords = node(nt, "ShaderNodeCombineXYZ", {"X": pu, "Y": pv, "Z": 0.0}).outputs[0]
    tex = node(nt, "ShaderNodeTexImage", {"Vector": coords}, image=image, interpolation="Linear", extension="REPEAT")
    lum = tex.outputs["Color"]
    lum = node(nt, "ShaderNodeSeparateColor", {"Color": lum}).outputs["Red"]

    scan = math(nt, "ADD", 0.62, math(nt, "MULTIPLY", math(nt, "SINE", math(nt, "MULTIPLY", v, lines * 2.0 * pymath.pi)), 0.38))
    du, dv = math(nt, "SUBTRACT", u, 0.5), math(nt, "SUBTRACT", v, 0.5)
    r2 = math(nt, "ADD", math(nt, "MULTIPLY", du, du), math(nt, "MULTIPLY", dv, dv))
    vign = remap(nt, r2, 0.62, 0.05, 0.25, 1.0)
    edge = math(nt, "MULTIPLY", remap(nt, math(nt, "MINIMUM", u, math(nt, "SUBTRACT", 1.0, u)), 0.0, 0.035), remap(nt, math(nt, "MINIMUM", v, math(nt, "SUBTRACT", 1.0, v)), 0.0, 0.035))

    t = tnode.outputs[0]
    phase = math(nt, "MULTIPLY", rnd, 6.2832)
    flick = math(nt, "ADD", 1.0, math(nt, "MULTIPLY", math(nt, "ADD", math(nt, "SINE", math(nt, "ADD", math(nt, "MULTIPLY", t, 53.0), phase)), math(nt, "SINE", math(nt, "ADD", math(nt, "MULTIPLY", t, 17.3), math(nt, "MULTIPLY", phase, 2.3)))), 0.035))
    bar_pos = math(nt, "FRACT", math(nt, "ADD", math(nt, "MULTIPLY", t, 0.19), rnd))
    d = math(nt, "ABSOLUTE", math(nt, "SUBTRACT", math(nt, "FRACT", math(nt, "ADD", math(nt, "SUBTRACT", v, bar_pos), 0.5)), 0.5))
    bar = math(nt, "ADD", 1.0, remap(nt, d, 0.14, 0.0, 0.0, 0.35))

    raster = math(nt, "ADD", 0.03,math(nt, "MULTIPLY", lum, 1.0))
    lit = math(nt, "MULTIPLY", math(nt, "MULTIPLY", raster, scan), math(nt, "MULTIPLY", math(nt, "MULTIPLY", vign, edge), math(nt, "MULTIPLY", flick, bar)))
    emit = vmath(nt, "MULTIPLY", rgb(nt, *tint), vmath(nt, "SCALE", rgb(nt, 1, 1, 1), lit))

    pos = node(nt, "ShaderNodeNewGeometry").outputs["Position"]
    dust = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 22.0), "Detail": 5.0}).outputs["Fac"]
    smudge = node(nt, "ShaderNodeTexNoise", {"Vector": vmath(nt, "SCALE", pos, 6.0), "Detail": 3.0}).outputs["Fac"]
    rough = math(nt, "ADD", 0.035, math(nt, "MULTIPLY", math(nt, "MULTIPLY", remap(nt, smudge, 0.4, 0.75), remap(nt, dust, 0.4, 0.8)), 0.16))
    finish(nt, principled(nt, Base_Color=(0.004, 0.005, 0.004), Roughness=rough, IOR=1.52, Specular_IOR_Level=0.7, Emission_Color=emit, Emission_Strength=strength))
    return m
