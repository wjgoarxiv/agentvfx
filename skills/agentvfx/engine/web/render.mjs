// agentvfx (Apache-2.0, see LICENSE). The render page: WebGL2 multipass renderer for template layers with
// persistent RGBA16F buffers. The host (engine/node/render.mjs) calls window.__litPrepare once, then
// window.__litStep(f, plan) for every frame in order, and captures the canvas after each step.
// No requestAnimationFrame, no wall clock: time comes only from the plan.
import { VERT, buildFragment, OUTPUT_FRAG } from "./prelude.mjs";
import { drawTextLayer, warmFonts } from "./text.mjs";

const TEXT_UNIT = 14;

const canvas = document.getElementById("c");
let gl = null;
let W = 0;
let H = 0;
let fps = 30;
let seed01 = 0;
let palette = [];
let probeNondeterminism = false;
const programs = new Map(); // `${template}#${pass}` -> { prog, uniforms }
const templates = new Map(); // id -> { inputs, passes: [{ target, persistent }] }
const instances = new Map(); // layer key -> { targets: Map, out: { tex, fbo } }
let vao = null;
let outputProgram = null;
let blackTex = null;
let creditProgram = null;
let creditTex = null;
let footageTex = null;
let hasFootage = false;
let audioTex = null;
let fftTex = null;

function compile(type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`shader compile failed (${label}): ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

function link(fragSrc, label) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT, `${label} vert`));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc, label));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`program link failed (${label}): ${gl.getProgramInfoLog(prog)}`);
  const uniforms = new Map();
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    const name = info.name.replace(/\[0\]$/u, "");
    uniforms.set(name, gl.getUniformLocation(prog, info.name));
  }
  return { prog, uniforms };
}

function floatTexture(w, h, data = null) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function target(w, h) {
  const tex = floatTexture(w, h);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`RGBA16F framebuffer incomplete (0x${status.toString(16)})`);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo };
}

function dropTarget(t) {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`could not load ${url} (${r.status})`);
  return r.text();
}

async function prepare(opts) {
  W = opts.width;
  H = opts.height;
  fps = opts.fps;
  seed01 = opts.seed01;
  palette = opts.palette ?? [];
  probeNondeterminism = Boolean(opts.probeNondeterminism);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("BLOCKED_NO_WEBGL2: no WebGL2 context");
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("BLOCKED_NO_WEBGL2: EXT_color_buffer_float missing");
  gl.getExtension("OES_texture_float_linear");
  vao = gl.createVertexArray();
  outputProgram = link(OUTPUT_FRAG, "output");
  blackTex = floatTexture(1, 1, new Float32Array([0, 0, 0, 1]));
  if (opts.credit) {
    creditProgram = link(CREDIT_FRAG, "credit");
    creditTex = creditTexture(opts.credit);
  }
  audioTex = floatTexture(512, 2, new Float32Array(512 * 2 * 4).fill(0.5));
  fftTex = floatTexture(512, 1, new Float32Array(512 * 4));
  for (const [id, t] of Object.entries(opts.templates)) {
    const passes = t.passes;
    const targets = passes.map((p) => p.target).filter(Boolean);
    templates.set(id, { inputs: t.inputs, passes, text: t.text ?? null });
    if (t.text) await warmFonts(t.text, H);
    for (let i = 0; i < passes.length; i++) {
      const body = await fetchText(`/lit/templates/${t.rel}/${passes[i].file}`);
      programs.set(`${id}#${i}`, link(buildFragment({ inputs: t.inputs, targets, body }), `${id} ${passes[i].file}`));
    }
  }
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  return { ok: true, renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "unknown" };
}

function instanceFor(key, templateId) {
  let inst = instances.get(key);
  if (!inst) {
    const tpl = templates.get(templateId);
    const targets = new Map();
    for (const p of tpl.passes) {
      if (p.target && !targets.has(p.target)) targets.set(p.target, { pair: [target(W, H), target(W, H)], read: 0, persistent: Boolean(p.persistent) });
    }
    inst = { targets, out: target(W, H), text: null };
    if (tpl.text) {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      inst.text = { canvas: c, ctx: c.getContext("2d", { willReadFrequently: false }), tex };
    }
    instances.set(key, inst);
  }
  return inst;
}

function setParam(u, input, value) {
  const loc = u.get(input.NAME);
  if (loc === undefined || loc === null) return;
  switch (input.TYPE) {
    case "float": gl.uniform1f(loc, value); break;
    case "long": gl.uniform1i(loc, value | 0); break;
    case "bool": gl.uniform1i(loc, value ? 1 : 0); break;
    case "color": gl.uniform4f(loc, srgbToLinear(value[0]), srgbToLinear(value[1]), srgbToLinear(value[2]), value[3]); break;
    case "point2D": gl.uniform2f(loc, value[0], value[1]); break;
    default: break;
  }
}

function setCommon(u, { t, frame, passIndex, input, hasInput, audio }) {
  const set1f = (n, v) => { const l = u.get(n); if (l) gl.uniform1f(l, v); };
  const set1i = (n, v) => { const l = u.get(n); if (l) gl.uniform1i(l, v); };
  set1f("TIME", t);
  set1f("TIMEDELTA", 1 / fps);
  set1i("FRAMEINDEX", frame);
  set1i("PASSINDEX", passIndex);
  if (u.get("RENDERSIZE")) gl.uniform2f(u.get("RENDERSIZE"), W, H);
  set1f("SEED", probeNondeterminism ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : seed01);
  set1i("HAS_INPUT", hasInput ? 1 : 0);
  if (u.get("PALETTE")) {
    const flat = new Float32Array(24);
    palette.slice(0, 8).forEach((c, i) => flat.set(c, i * 3));
    gl.uniform3fv(u.get("PALETTE"), flat);
  }
  set1i("PALETTE_COUNT", Math.min(8, palette.length));
  const a = audio ?? {};
  const scal = { AUDIO_RMS: "rms", AUDIO_PEAK: "peak", AUDIO_BASS: "bass", AUDIO_MID: "mid", AUDIO_TREB: "treb", AUDIO_BASS_ATT: "bass_att", AUDIO_MID_ATT: "mid_att", AUDIO_TREB_ATT: "treb_att", AUDIO_FLUX: "flux", AUDIO_ONSET: "onset", AUDIO_BEAT: "beat", AUDIO_BEATPHASE: "beatPhase", AUDIO_BPM: "bpm" };
  for (const [name, key] of Object.entries(scal)) set1f(name, Number(a[key] ?? 0));
  if (u.get("AUDIO_BANDS")) gl.uniform1fv(u.get("AUDIO_BANDS"), new Float32Array(Array.from({ length: 32 }, (_, i) => Number(a.bands?.[i] ?? 0))));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, input);
  set1i("inputImage", 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, audioTex);
  set1i("audio", 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, fftTex);
  set1i("audioFFT", 2);
}

function uploadAudio(audio) {
  if (!audio) return;
  if (audio.wave) {
    const d = new Float32Array(512 * 2 * 4);
    for (let row = 0; row < 2; row++) {
      const src = row === 0 ? (audio.waveL ?? audio.wave) : (audio.waveR ?? audio.wave);
      for (let i = 0; i < 512; i++) {
        const v = 0.5 + 0.5 * Number(src[i] ?? 0);
        d.set([v, v, v, 1], (row * 512 + i) * 4);
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, audioTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 2, gl.RGBA, gl.FLOAT, d);
  }
  if (audio.spec) {
    const d = new Float32Array(512 * 4);
    for (let i = 0; i < 512; i++) {
      const v = Number(audio.spec[i] ?? 0);
      d.set([v, v, v, 1], i * 4);
    }
    gl.bindTexture(gl.TEXTURE_2D, fftTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.RGBA, gl.FLOAT, d);
  }
}

function renderLayer(layer, inputTex, hasInput, audio) {
  const tpl = templates.get(layer.template);
  if (!tpl) throw new Error(`template not prepared: ${layer.template}`);
  const inst = instanceFor(layer.key, layer.template);
  const written = new Set();
  const frame = Math.round(layer.t * fps);
  if (inst.text) {
    const set = Number(layer.params?.textSet ?? 0);
    const items = tpl.text.some((s) => s.set) ? tpl.text.filter((s) => (s.set ?? 0) === set) : tpl.text;
    const specs = layer.textStyle ? items.map((s) => ({ ...s, ...layer.textStyle[s.key] })) : items;
    drawTextLayer(inst.text.ctx, W, H, specs, layer.labels, layer.t, frame, Math.floor(seed01 * 4294967296));
    gl.bindTexture(gl.TEXTURE_2D, inst.text.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, inst.text.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  for (let i = 0; i < tpl.passes.length; i++) {
    const pass = tpl.passes[i];
    const { prog, uniforms } = programs.get(`${layer.template}#${i}`);
    const last = i === tpl.passes.length - 1;
    let dest;
    if (last) dest = inst.out;
    else {
      if (!pass.target) throw new Error(`${layer.template}: pass ${i} has no TARGET`);
      const tg = inst.targets.get(pass.target);
      dest = tg.pair[1 - tg.read];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(prog);
    setCommon(uniforms, { t: layer.t, frame, passIndex: i, input: inputTex, hasInput, audio });
    let unit = 3;
    for (const [name, tg] of inst.targets) {
      const loc = uniforms.get(name);
      if (!loc) continue;
      const tex = written.has(name) ? tg.pair[1 - tg.read].tex : tg.pair[tg.read].tex;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
      unit += 1;
    }
    gl.activeTexture(gl.TEXTURE0 + TEXT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, inst.text ? inst.text.tex : blackTex);
    if (uniforms.get("TEXTMASK")) gl.uniform1i(uniforms.get("TEXTMASK"), TEXT_UNIT);
    if (uniforms.get("HAS_TEXT")) gl.uniform1i(uniforms.get("HAS_TEXT"), inst.text ? 1 : 0);
    for (const input of tpl.inputs) if (layer.params[input.NAME] !== undefined) setParam(uniforms, input, layer.params[input.NAME]);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!last) written.add(pass.target);
  }
  for (const name of written) {
    const tg = inst.targets.get(name);
    tg.read = 1 - tg.read;
  }
  return inst.out.tex;
}

function step(f, plan) {
  uploadAudio(plan.audio);
  const active = new Set(plan.layers.map((l) => l.key));
  for (const [key, inst] of instances) {
    if (active.has(key)) continue;
    for (const tg of inst.targets.values()) tg.pair.forEach(dropTarget);
    dropTarget(inst.out);
    if (inst.text) gl.deleteTexture(inst.text.tex);
    instances.delete(key);
  }
  let tex = plan.footage && hasFootage ? footageTex : blackTex;
  let hasInput = Boolean(plan.footage && hasFootage);
  for (const layer of plan.layers) {
    tex = renderLayer(layer, tex, hasInput, plan.audio);
    hasInput = true;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(outputProgram.prog);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(outputProgram.uniforms.get("src"), 0);
  gl.uniform1i(outputProgram.uniforms.get("FRAMEINDEX"), f);
  gl.uniform1f(outputProgram.uniforms.get("SEED"), probeNondeterminism ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : seed01);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (creditTex) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(creditProgram.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, creditTex);
    gl.uniform1i(creditProgram.uniforms.get("credit"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
  gl.finish();
  const err = gl.getError();
  if (err !== gl.NO_ERROR) throw new Error(`WebGL error 0x${err.toString(16)} on frame ${f}`);
  return { frame: f, layers: plan.layers.length };
}

const CREDIT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D credit;
void main() { fragColor = texture(credit, vUv); }`;

/** The credit as a frame-sized RGBA texture: small text in the bottom-right corner, white with a dark edge. */
function creditTexture(text) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const px = Math.max(11, Math.round(H * 0.022));
  ctx.font = `600 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const x = W - Math.round(px * 1.1);
  const y = H - Math.round(px * 0.9);
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, px * 0.18);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText(text, x, y);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** Footage frame upload: RGBA8 sRGB bytes of the footage's own size. */
function footage(bytes, w, h) {
  if (!footageTex) {
    footageTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, footageTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.SRGB8_ALPHA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.bindTexture(gl.TEXTURE_2D, footageTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  hasFootage = true;
  return true;
}

window.__litPrepare = (opts) => prepare(opts).catch((e) => ({ ok: false, error: String(e.message ?? e) }));
window.__litStep = (f, plan) => step(f, plan);
window.__litFootageFetch = async (url, w, h) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`footage frame ${url} missing (${r.status})`);
  return footage(new Uint8Array(await r.arrayBuffer()), w, h);
};
window.__litStageState = () => ({ ready: Boolean(gl), width: W, height: H });
