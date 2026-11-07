"""Terminalcore plate: procedural CRT-wall brutalist room rendered with Cycles (Metal GPU, OIDN).

Run:  blender -b --factory-startup --python scene.py -- --shot wall --out DIR [--width 640 --height 360
      --seconds 4 --fps 30 --samples 48 --frame N --exposure 0 --bloom 1]
Use scripts/plate.mjs for the full render + H.264 encode.
"""
import argparse
import math
import os
import random
import sys
import time

import bpy
from mathutils import Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gallery  # noqa: E402
import materials as M  # noqa: E402
import room  # noqa: E402
import shots  # noqa: E402
import textures  # noqa: E402
import wall  # noqa: E402


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", default="wall")
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=640)
    ap.add_argument("--height", type=int, default=360)
    ap.add_argument("--seconds", type=float, default=4.0)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--samples", type=int, default=40)
    ap.add_argument("--quality", choices=("preview", "final"), default="preview", help="final: tight adaptive threshold, accurate denoise, camera motion blur")
    ap.add_argument("--frame", type=int, default=0, help="render only this 1-based frame to still_<n>.png")
    ap.add_argument("--exposure", type=float, default=None)
    ap.add_argument("--bloom", type=float, default=None)
    ap.add_argument("--key", type=float, default=1.0, help="key light strength multiplier")
    ap.add_argument("--haze", type=float, default=None, help="volumetric haze density multiplier")
    a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])
    gallery = a.shot == "gallery"
    for name, wall_default, gallery_default in (("exposure", -0.3, 0.15), ("bloom", 1.0, 0.5), ("haze", 1.4, 1.8)):
        if getattr(a, name) is None:
            setattr(a, name, gallery_default if gallery else wall_default)
    return a


def setup_render(scene, a):
    scene.render.engine = "CYCLES"
    cy = scene.cycles
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "METAL"
    cy.device = "GPU"
    cy.samples = a.samples
    final = a.quality == "final"
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.01 if final else 0.03
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.denoising_use_gpu = True
    if final:
        cy.denoising_prefilter = "ACCURATE"
        cy.denoising_quality = "HIGH"
        scene.render.use_motion_blur = True
        scene.render.motion_blur_shutter = 0.5
        scene.render.motion_blur_position = "CENTER"
    cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces = 6, 3, 4
    cy.transmission_bounces, cy.volume_bounces, cy.transparent_max_bounces = 2, 1, 4
    cy.sample_clamp_indirect = 8.0
    cy.sample_clamp_direct = 0.0
    cy.blur_glossy = 0.3
    cy.volume_step_rate = 1.5
    cy.volume_max_steps = 256
    scene.render.use_persistent_data = True
    scene.render.resolution_x, scene.render.resolution_y = a.width, a.height
    scene.render.resolution_percentage = 100
    scene.render.fps = a.fps
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - High Contrast", "AgX - Punchy"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = a.exposure
    scene.frame_start, scene.frame_end = 1, max(1, round(a.seconds * a.fps))


def setup_bloom(scene, strength):
    ng = bpy.data.node_groups.new("plate_comp", "CompositorNodeTree")
    scene.compositing_node_group = ng
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    out = ng.nodes.new("NodeGroupOutput")
    gl.inputs["Type"].default_value = "Bloom"
    gl.inputs["Threshold"].default_value = 0.9
    gl.inputs["Strength"].default_value = 0.8 * strength
    gl.inputs["Size"].default_value = 0.6
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], out.inputs[0])


def make_camera(scene, coll):
    cam = bpy.data.cameras.new("cam")
    cam.sensor_width = 36.0
    cam.dof.use_dof = True
    ob = bpy.data.objects.new("cam", cam)
    coll.objects.link(ob)
    scene.camera = ob
    return ob


def build(scene, coll, a):
    if a.shot == "gallery":
        return gallery.build(scene, coll, a)
    rng = random.Random(1987)
    mats = {
        "concrete": M.concrete("concrete"), "floor": M.concrete("floor", polished=True, tone=0.11),
        "plastic": M.plastic(), "steel": M.steel(), "rubber": M.rubber(), "led": M.led_random("led", 12.0),
        "vent": M.vent_black(), "strip": M.led("strip", (0.55, 0.78, 1.0), 14.0), "glass_off": M.screen("glass_off", textures.make_image("off", 5), (0.0, 0.0, 0.0), {}, strength=0.0),
    }
    mats["glass_base"] = mats["glass_off"]
    lines = 150.0 if a.shot == "closeup" else 90.0
    screens, anims = {}, {}
    for key, (seed, tint, strength, rate) in wall.VARIANTS.items():
        anims[key] = {}
        screens[key] = M.screen(f"screen_{key}", textures.make_image(f"term_{key}", seed), tint, anims[key], lines=lines, strength=strength, zoom=1.0 if a.shot == "closeup" else 0.5)
    room.build_room(coll, mats)
    room.build_world_and_light(scene, coll, a.key, a.haze, a.shot)
    wall.build_rack(coll, mats)
    wall.build_monitors(coll, mats, screens, rng)
    wall.build_tray_and_cables(coll, mats, rng)
    wall.build_status_array(coll, mats, rng)
    return anims


def apply_pose(cam, p):
    cam.location = p["loc"]
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = p["quat"] @ Quaternion((0.0, 0.0, 1.0), p["roll"])
    cam.data.lens = p["lens"]
    cam.data.shift_y = p.get("shift_y", 0.0)
    cam.data.dof.aperture_fstop = p["fstop"]
    cam.data.dof.focus_distance = p["focus"]


def bake_camera(scene, cam, a):
    """Keyframe the camera on every frame: Cycles motion blur only sees fcurves, not a frame-change handler."""
    total = scene.frame_end
    for f in range(1, total + 1):
        apply_pose(cam, shots.pose(a.shot, (f - 1) / max(total - 1, 1), f))
        for ob, paths in ((cam, ("location", "rotation_quaternion")), (cam.data, ("lens", "shift_y", "dof.aperture_fstop", "dof.focus_distance"))):
            for path in paths:
                ob.keyframe_insert(path, frame=f)
    scene.frame_set(2)
    y_whole = cam.matrix_world.translation.y
    scene.frame_set(2, subframe=0.5)
    print(f"TIMING camera keyed on {total} frames, subframe dy={cam.matrix_world.translation.y - y_whole:.5f} m, motion_blur={scene.render.use_motion_blur} shutter={scene.render.motion_blur_shutter}", flush=True)


def install_animation(scene, cam, anims, a):
    total = scene.frame_end
    row = 18 / 1152
    baked = a.quality == "final"

    def on_frame(scn):
        f = scn.frame_current
        t = (f - 1) / max(total - 1, 1)
        secs = (f - 1) / a.fps
        for key, anim in anims.items():
            rate = wall.VARIANTS[key][3] * {"closeup": 1.6, "gallery": 0.55}.get(a.shot, 0.8)
            anim["scroll"].outputs[0].default_value = math.floor(secs * rate) * row
            anim["time"].outputs[0].default_value = secs
        if not baked:
            apply_pose(cam, shots.pose(a.shot, t, f))

    if baked:
        bake_camera(scene, cam, a)
    bpy.app.handlers.frame_change_pre.append(on_frame)
    return on_frame


def main():
    a = parse()
    scene = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    coll = scene.collection
    setup_render(scene, a)
    if a.bloom > 0:
        setup_bloom(scene, a.bloom)
    t0 = time.time()
    cam = make_camera(scene, coll)
    anims = build(scene, coll, a)
    print(f"TIMING build {time.time() - t0:.1f}s look={scene.view_settings.look}", flush=True)
    on_frame = install_animation(scene, cam, anims, a)
    os.makedirs(a.out, exist_ok=True)
    t1 = time.time()
    if a.frame:
        scene.frame_set(a.frame)
        on_frame(scene)
        scene.render.filepath = os.path.join(a.out, f"still_{a.frame:03d}.png")
        bpy.ops.render.render(write_still=True)
    else:
        os.makedirs(os.path.join(a.out, "frames"), exist_ok=True)
        scene.render.filepath = os.path.join(a.out, "frames", "f_")
        bpy.ops.render.render(animation=True)
    print(f"TIMING render {time.time() - t1:.1f}s", flush=True)


main()
