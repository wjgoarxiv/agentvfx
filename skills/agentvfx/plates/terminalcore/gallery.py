"""Gallery variant: the CRT wall shown as a gallery installation (precise grid, powder-coat frame, concrete plinth, one bench)."""
import bpy

import crt
import gallery_mats as G
import gallery_room as GR
import materials as M
import textures
import wall
from crt import SLOT_GLASS

# Screen content per tube, bottom row first, columns 0..4 mirrored to 9. a amber, g green, h green-b, c cold, . dark
LAYOUT = ("g.aaa", "hgaaa", "gaaca", "hgaa.", "g.aaa")
KEYS = {"a": "amber", "g": "green_a", "h": "green_b", "c": "cold"}


def _screen_key(r, c):
    ch = LAYOUT[r][min(c, wall.COLS - 1 - c)]
    return KEYS.get(ch)


def build_installation(coll, mats, screens):
    mesh, _ = crt.build_crt_mesh()
    for m in (mats["plastic"], mats["glass_base"], mats["vent"], mats["steel"], mats["pilot"]):
        mesh.materials.append(m)
    for r in range(wall.ROWS):
        for c in range(wall.COLS):
            ob = bpy.data.objects.new(f"crt_{r}_{c}", mesh)
            x, y, _ = wall.monitor_position(r, c)
            ob.location = (x, y, wall.BASE_Z + r * wall.PITCH + 0.22)
            coll.objects.link(ob)
            key = _screen_key(r, c)
            slot = ob.material_slots[SLOT_GLASS]
            slot.link = "OBJECT"
            slot.material = screens[key] if key else mats["glass_off"]
    GR.block(coll, "plinth", (5.7, 1.8, 0.24), (0, -0.3, 0.12), mats["plinth"], bevel=0.004)
    GR.block(coll, "bench", (2.2, 0.44, 0.42), (0, -3.3, 0.21), mats["stone"], bevel=0.013)


def build(scene, coll, a):
    """Build the whole gallery and return the per-variant animation value nodes (scroll / time)."""
    mats = {
        "concrete": G.concrete_panel("g_wall"), "ceiling": G.concrete_panel("g_ceiling", holes=False, tone=0.36),
        "floor": G.polished_floor(), "plinth": G.polished_floor("g_plinth", tone=0.07, joints=False),
        "powder": G.powdercoat(), "reveal": G.reveal(), "stone": G.honed_stone(tone=0.42),
        "slot": G.emitter("g_slot", (1.0, 0.96, 0.9), 14.0 * a.key),
        "plastic": M.plastic(palette=((0.10, 0.104, 0.11),) * 3), "steel": M.steel(), "vent": M.vent_black(),
        "pilot": M.led("pilot", (1.0, 0.55, 0.18), 5.0),
        "glass_off": G.glass_off(),
    }
    mats["glass_base"] = mats["glass_off"]
    screens, anims = {}, {}
    for key, (seed, tint, strength, _rate) in wall.VARIANTS.items():
        anims[key] = {}
        screens[key] = M.screen(f"screen_{key}", textures.make_image(f"term_{key}", seed), tint, anims[key], lines=90.0, strength=strength, zoom=0.5)
    GR.build_world(scene, a.haze)
    GR.build_shell(coll, mats)
    GR.build_lights(coll, mats, a.key)
    wall.build_rack(coll, {**mats, "steel": mats["powder"]})
    build_installation(coll, mats, screens)
    return anims
