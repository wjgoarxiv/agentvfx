"""Tiny shader-node helpers: build node graphs as expressions (sockets or plain numbers in, sockets out)."""
import bpy


def fresh(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt


def _set(sock, v):
    if isinstance(v, bpy.types.NodeSocket):
        sock.node.id_data.links.new(v, sock)
    elif sock.type == "RGBA" and not isinstance(v, (int, float)) and len(v) == 3:
        sock.default_value = (*v, 1.0)
    else:
        sock.default_value = v


def node(nt, idname, ins=None, **props):
    n = nt.nodes.new(idname)
    for k, v in props.items():
        setattr(n, k, v)
    for k, v in (ins or {}).items():
        _set(n.inputs[k], v)
    return n


def math(nt, op, a, b=None, c=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if v is not None:
            _set(n.inputs[i], v)
    return n.outputs[0]


def remap(nt, v, lo, hi, out_lo=0.0, out_hi=1.0, smooth=True):
    n = nt.nodes.new("ShaderNodeMapRange")
    n.interpolation_type = "SMOOTHSTEP" if smooth else "LINEAR"
    n.clamp = True
    for k, x in (("Value", v), ("From Min", lo), ("From Max", hi), ("To Min", out_lo), ("To Max", out_hi)):
        _set(n.inputs[k], x)
    return n.outputs["Result"]


def mix(nt, fac, a, b):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    on = lambda name: next(i for i in n.inputs if i.name == name and i.type == "RGBA")
    _set(n.inputs[0], fac)
    _set(on("A"), a)
    _set(on("B"), b)
    return next(o for o in n.outputs if o.type == "RGBA")


def vmath(nt, op, a, b=None):
    n = nt.nodes.new("ShaderNodeVectorMath")
    n.operation = op
    _set(n.inputs[0], a)
    if b is not None:
        _set(n.inputs["Scale"] if op == "SCALE" else n.inputs[1], b)
    return n.outputs[0] if op not in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else n.outputs["Value"]


def rgb(nt, r, g, b):
    n = nt.nodes.new("ShaderNodeRGB")
    n.outputs[0].default_value = (r, g, b, 1.0)
    return n.outputs[0]


def principled(nt, **ins):
    n = nt.nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in ins.items():
        _set(n.inputs[k.replace("_", " ")], v)
    return n


def finish(nt, shader, volume=None):
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.target = "CYCLES"
    nt.links.new(shader.outputs[0], out.inputs["Surface"])
    if volume is not None:
        nt.links.new(volume, out.inputs["Volume"])
