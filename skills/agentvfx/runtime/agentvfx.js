// agentvfx (agentvfx licence, see LICENSE). Live WebGL2 runtime. The exported copy inlines engine/web/prelude.mjs
// at export time so a page does not import the engine. Semantics match engine/web/render.mjs.
import { OUTPUT_FRAG, VERT, buildFragment, seedToUnit } from "../engine/web/prelude.mjs";
import { PALETTES, hexToRgb } from "../engine/core/palettes.mjs";
import { resolveParams } from "../engine/core/templates.mjs";
import { FlashDetector, gridFor, LINEAR_LUT } from "../engine/core/flash.mjs";

// Live flash guard limits, the render audit's own (WCAG 2.3.1: at most three flashes, six transitions, in any
// one second; no red flash): a frame that would make a seventh general transition, or a second (opposing)
// saturated-red transition, within one second is never shown.
const GUARD_WINDOW_MS = 1000;
const GUARD_MAX_SHOWN = 6;
const GUARD_MAX_SHOWN_RED = 1;

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function resolvePalette(value) {
  const stops = value == null ? PALETTES.rainbow : typeof value === "string" ? PALETTES[value] : value;
  if (!Array.isArray(stops)) throw new Error(`unknown palette: ${value}`);
  return stops.map((stop) => (typeof stop === "string" ? hexToRgb(stop) : stop)).map((rgb) => rgb.map(srgbToLinear));
}

function textSource({ text = "", font = "700 64px sans-serif", color = "#ffffff", background = "#000000", width = 960, height = 180 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  g.fillStyle = background;
  g.fillRect(0, 0, width, height);
  g.fillStyle = color;
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, width / 2, height / 2);
  return canvas;
}

async function mount(canvas, opts = {}) {
  const spec = opts.templates?.[opts.template];
  if (!spec) throw new Error(`agentvfx: unknown template ${opts.template}`);
  const fps = opts.fps ?? spec.fx?.X_AGENTVFX?.fps ?? 30;
  const dprCap = opts.dpr ?? 1.5;
  const seed01 = seedToUnit(opts.seed ?? 0);
  let palette = resolvePalette(opts.palette);
  let params = resolveParams(spec.fx, { preset: opts.preset ?? null, params: opts.params ?? {} });
  let source = opts.source ?? null;
  if (source instanceof HTMLImageElement && !source.complete) {
    await new Promise((resolve, reject) => {
      source.addEventListener("load", resolve, { once: true });
      source.addEventListener("error", () => reject(new Error("agentvfx: image failed to load")), { once: true });
    });
  }

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = opts.motion === "always" ? false : motionQuery.matches;
  let paused = false;
  let offscreen = false;
  let hold = false;
  let broken = false;
  let rafId = 0;
  let frame = 0;
  let origin = performance.now();
  let hit = null;
  const warned = new Set();

  let gl = null;
  let W = 0;
  let H = 0;
  let vao = null;
  let outputProgram = null;
  let blackTex = null;
  let audioTex = null;
  let fftTex = null;
  let sourceTex = null;
  let sourceW = 0;
  let sourceH = 0;
  const programs = new Map();
  const instances = new Map();
  let audioCtx = null;
  let analyser = null;
  let audioFeatures = null;
  const guardOn = opts.flashGuard !== false;
  let guard = null;
  let tripped = false;

  // The guard reads each shown frame back on the audit's own grid and runs the audit's detector on it (a
  // coarser grid averages thin red fringes away). The previous frame is kept on the GPU so a tripping frame
  // can be replaced before the browser composites it.
  function makeGuard() {
    const grid = gridFor(W, H);
    const target = (w, h) => {
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      return { rb, fbo };
    };
    const cells = grid.gw * grid.gh;
    return {
      grid, small: target(grid.gw, grid.gh), keep: target(W, H), kept: false,
      pixels: new Uint8Array(cells * 4),
      R: new Float32Array(cells), G: new Float32Array(cells), B: new Float32Array(cells),
      detector: new FlashDetector(grid), general: [], red: [],
    };
  }

  function dropGuard() {
    if (guard && gl && !gl.isContextLost()) {
      for (const t of [guard.small, guard.keep]) {
        gl.deleteFramebuffer(t.fbo);
        gl.deleteRenderbuffer(t.rb);
      }
    }
    guard = null;
  }

  function blit(from, to, sw, sh, dw, dh) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to);
    gl.blitFramebuffer(0, 0, sw, sh, 0, 0, dw, dh, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Records one alternating edge per frame, as the audit does; returns the edges inside the window.
  function edges(list, up, down, now) {
    const last = list.at(-1)?.dir ?? 0;
    const dir = up && down ? (last === 1 ? -1 : 1) : up ? 1 : down ? -1 : 0;
    if (dir && dir !== last) list.push({ t: now, dir });
    while (list.length && now - list[0].t >= GUARD_WINDOW_MS) list.shift();
    return list.length;
  }

  /** Checks the frame just presented. Returns true when it tripped (the frame is replaced and motion stops). */
  function guardFrame() {
    if (!guardOn || !gl || broken || tripped) return false;
    if (!guard) guard = makeGuard();
    const { gw, gh } = guard.grid;
    blit(null, guard.small.fbo, W, H, gw, gh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, guard.small.fbo);
    gl.readPixels(0, 0, gw, gh, gl.RGBA, gl.UNSIGNED_BYTE, guard.pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const { pixels, R, G, B } = guard;
    for (let i = 0; i < R.length; i++) {
      R[i] = LINEAR_LUT[pixels[i * 4]];
      G[i] = LINEAR_LUT[pixels[i * 4 + 1]];
      B[i] = LINEAR_LUT[pixels[i * 4 + 2]];
    }
    const r = guard.detector.push({ R, G, B });
    const now = performance.now();
    const general = edges(guard.general, r.up, r.down, now);
    const red = edges(guard.red, r.redUp, r.redDown, now);
    if (general <= GUARD_MAX_SHOWN && red <= GUARD_MAX_SHOWN_RED) {
      blit(null, guard.keep.fbo, W, H, W, H);
      guard.kept = true;
      return false;
    }
    if (guard.kept) blit(guard.keep.fbo, null, W, H, W, H);
    else {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.finish();
    tripped = true;
    cancelAnimationFrame(rafId);
    const info = {
      template: opts.template,
      reason: red > GUARD_MAX_SHOWN_RED ? "red" : "general",
      shownTransitions: Math.min(general, GUARD_MAX_SHOWN),
      shownRedTransitions: Math.min(red, GUARD_MAX_SHOWN_RED),
    };
    console.warn(`agentvfx: flash guard stopped ${opts.template} (${info.reason} flashing would pass WCAG 2.3.1)`);
    try {
      opts.onFlashGuard?.(info);
    } catch (error) {
      console.error(error);
    }
    return true;
  }

  function noteFlash(id, fx) {
    if (fx?.X_AGENTVFX?.flash !== "strobe" || warned.has(id)) return;
    warned.add(id);
    console.warn(`agentvfx: template ${id} flash "strobe" (WCAG 2.3.1)`);
  }

  function pixelSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const cssW = canvas.clientWidth || Number(canvas.getAttribute("width")) || 300;
    const cssH = canvas.clientHeight || Number(canvas.getAttribute("height")) || 150;
    return [Math.max(2, Math.round(cssW * dpr)), Math.max(2, Math.round(cssH * dpr))];
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

  function makeTarget(w, h) {
    const tex = floatTexture(w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  }

  function dropTarget(t) {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  }

  function clearInstances() {
    // Without a live context the GPU objects are already gone: just forget them.
    if (gl && !gl.isContextLost()) {
      for (const inst of instances.values()) {
        for (const tg of inst.targets.values()) tg.pair.forEach(dropTarget);
        dropTarget(inst.out);
      }
    }
    instances.clear();
  }

  function fail(label, detail) {
    broken = true;
    console.error(`agentvfx: shader compile failed (${label}): ${detail}`);
    if (!gl) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function compile(type, src, label) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      fail(label, gl.getShaderInfoLog(sh) || "compile error");
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function link(fragSrc, label) {
    const prog = gl.createProgram();
    const vert = compile(gl.VERTEX_SHADER, VERT, `${label} vert`);
    const frag = compile(gl.FRAGMENT_SHADER, fragSrc, label);
    if (!vert || !frag) {
      gl.deleteProgram(prog);
      return null;
    }
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      fail(label, gl.getProgramInfoLog(prog) || "link error");
      gl.deleteProgram(prog);
      return null;
    }
    const uniforms = new Map();
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      uniforms.set(info.name.replace(/\[0\]$/u, ""), gl.getUniformLocation(prog, info.name));
    }
    return { prog, uniforms };
  }

  function programFor(id, tpl) {
    if (programs.has(`${id}#0`) || broken) return;
    const targets = tpl.passes.map((p) => p.target).filter(Boolean);
    for (let i = 0; i < tpl.passes.length; i++) {
      const pass = tpl.passes[i];
      const label = `${id} ${pass.file || `pass ${i}`}`;
      let src;
      try {
        src = buildFragment({ inputs: tpl.fx.INPUTS ?? [], targets, body: pass.src });
      } catch (error) {
        fail(label, error.message);
        return;
      }
      const linked = link(src, label);
      if (!linked) return;
      programs.set(`${id}#${i}`, linked);
    }
  }

  function instanceFor(key, id, tpl) {
    let inst = instances.get(key);
    if (inst) return inst;
    const targets = new Map();
    for (const p of tpl.passes) {
      if (p.target && !targets.has(p.target)) targets.set(p.target, { pair: [makeTarget(W, H), makeTarget(W, H)], read: 0, persistent: Boolean(p.persistent) });
    }
    inst = { targets, out: makeTarget(W, H) };
    instances.set(key, inst);
    return inst;
  }

  function setParam(u, input, value) {
    const loc = u.get(input.NAME);
    if (loc == null) return;
    switch (input.TYPE) {
      case "float": gl.uniform1f(loc, value); break;
      case "long": gl.uniform1i(loc, value | 0); break;
      case "bool": gl.uniform1i(loc, value ? 1 : 0); break;
      case "color": gl.uniform4f(loc, srgbToLinear(value[0]), srgbToLinear(value[1]), srgbToLinear(value[2]), value[3] ?? 1); break;
      case "point2D": gl.uniform2f(loc, value[0], value[1]); break;
      default: break;
    }
  }

  function ensureSource() {
    const el = source;
    if (!el) return false;
    const w = el.videoWidth || el.naturalWidth || el.width;
    const h = el.videoHeight || el.naturalHeight || el.height;
    if (!w || !h) return false;
    if (!sourceTex || w !== sourceW || h !== sourceH) {
      if (sourceTex) gl.deleteTexture(sourceTex);
      sourceTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, sourceTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      sourceW = w;
      sourceH = h;
    }
    gl.bindTexture(gl.TEXTURE_2D, sourceTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return true;
  }

  function uploadAudio() {
    const audio = audioFeatures;
    if (!audio) return;
    if (audio.wave) {
      const d = new Float32Array(512 * 2 * 4);
      for (let row = 0; row < 2; row++) {
        const src = row === 0 ? audio.wave : (audio.waveR ?? audio.wave);
        for (let i = 0; i < 512; i++) d.set([0.5 + 0.5 * Number(src[i] ?? 0), 0.5 + 0.5 * Number(src[i] ?? 0), 0.5 + 0.5 * Number(src[i] ?? 0), 1], (row * 512 + i) * 4);
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

  function setCommon(u, { t, frameIndex, passIndex, input, hasInput }) {
    const set1f = (n, v) => { const l = u.get(n); if (l) gl.uniform1f(l, v); };
    const set1i = (n, v) => { const l = u.get(n); if (l) gl.uniform1i(l, v); };
    set1f("TIME", t);
    set1f("TIMEDELTA", 1 / fps);
    set1i("FRAMEINDEX", frameIndex);
    set1i("PASSINDEX", passIndex);
    if (u.get("RENDERSIZE")) gl.uniform2f(u.get("RENDERSIZE"), W, H);
    set1f("SEED", seed01);
    set1i("HAS_INPUT", hasInput ? 1 : 0);
    if (u.get("PALETTE")) {
      const flat = new Float32Array(24);
      palette.slice(0, 8).forEach((c, i) => flat.set(c, i * 3));
      gl.uniform3fv(u.get("PALETTE"), flat);
    }
    set1i("PALETTE_COUNT", Math.min(8, palette.length));
    const a = audioFeatures ?? {};
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

  function renderLayer(key, id, tpl, layerParams, t, inputTex, hasInput) {
    programFor(id, tpl);
    if (broken) return inputTex;
    const inst = instanceFor(key, id, tpl);
    const written = new Set();
    const frameIndex = Math.round(t * fps);
    for (let i = 0; i < tpl.passes.length; i++) {
      const pass = tpl.passes[i];
      const linked = programs.get(`${id}#${i}`);
      if (!linked) return inputTex;
      const last = i === tpl.passes.length - 1;
      let dest;
      if (last) dest = inst.out;
      else {
        const tg = inst.targets.get(pass.target);
        if (!tg) {
          fail(`${id} ${pass.file || i}`, "pass has no TARGET");
          return inputTex;
        }
        dest = tg.pair[1 - tg.read];
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo);
      gl.viewport(0, 0, W, H);
      gl.useProgram(linked.prog);
      setCommon(linked.uniforms, { t, frameIndex, passIndex: i, input: inputTex, hasInput });
      let unit = 3;
      for (const [name, tg] of inst.targets) {
        const loc = linked.uniforms.get(name);
        if (!loc) continue;
        const tex = written.has(name) ? tg.pair[1 - tg.read].tex : tg.pair[tg.read].tex;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(loc, unit);
        unit += 1;
      }
      for (const input of tpl.fx.INPUTS ?? []) if (layerParams[input.NAME] !== undefined) setParam(linked.uniforms, input, layerParams[input.NAME]);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!last) written.add(pass.target);
    }
    for (const name of written) inst.targets.get(name).read = 1 - inst.targets.get(name).read;
    return inst.out.tex;
  }

  function present(tex, frameIndex) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(outputProgram.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(outputProgram.uniforms.get("src"), 0);
    gl.uniform1i(outputProgram.uniforms.get("FRAMEINDEX"), frameIndex);
    gl.uniform1f(outputProgram.uniforms.get("SEED"), seed01);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }

  function sampleAnalyser() {
    if (!analyser) return;
    const n = analyser.fftSize;
    const time = new Float32Array(n);
    analyser.getFloatTimeDomainData(time);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      sum += time[i] * time[i];
      peak = Math.max(peak, Math.abs(time[i]));
    }
    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);
    const spec = new Float32Array(512);
    for (let i = 0; i < 512; i++) spec[i] = freq[Math.min(freq.length - 1, Math.floor(i * freq.length / 512))] / 255;
    const bands = new Float32Array(32);
    for (let b = 0; b < 32; b++) {
      const a0 = Math.floor(512 * b / 32);
      const a1 = Math.max(a0 + 1, Math.floor(512 * (b + 1) / 32));
      let s = 0;
      for (let i = a0; i < a1; i++) s += spec[i];
      bands[b] = s / (a1 - a0);
    }
    const avg = (a0, a1) => {
      let s = 0;
      for (let i = a0; i < a1; i++) s += bands[i];
      return s / (a1 - a0);
    };
    const wave = new Float32Array(512);
    for (let i = 0; i < 512; i++) wave[i] = time[Math.min(n - 1, Math.floor(i * n / 512))];
    audioFeatures = {
      rms: Math.sqrt(sum / n), peak,
      bass: avg(0, 4), mid: avg(4, 14), treb: avg(14, 32),
      bass_att: avg(0, 4), mid_att: avg(4, 14), treb_att: avg(14, 32),
      flux: 0, onset: 0, beat: 0, beatPhase: 0, bpm: 0,
      bands, wave, spec,
    };
  }

  function draw(t, frameIndex) {
    if (!gl || broken) return;
    try {
      sampleAnalyser();
      uploadAudio();
      const hasInput = ensureSource();
      let tex = hasInput ? sourceTex : blackTex;
      tex = renderLayer("base", opts.template, spec, params, t, tex, hasInput);
      if (hit && performance.now() < hit.until) {
        const local = (performance.now() - hit.start) / 1000;
        tex = renderLayer(`hit:${hit.id}`, hit.id, hit.tpl, hit.params, local, tex, true);
      } else if (hit) {
        hit = null;
      }
      if (!broken) present(tex, frameIndex);
    } catch (error) {
      fail(opts.template, error.message);
    }
  }

  function tick(now) {
    if (hold || reduced || paused || offscreen || tripped) return;
    rafId = requestAnimationFrame(tick);
    const target = Math.round(((now - origin) / 1000) * fps);
    const next = Math.min(target, frame + 4);
    if (next === frame) return;
    for (let f = frame + 1; f <= next; f++) draw(f / fps, f);
    frame = next;
    guardFrame();
  }

  function start() {
    if (reduced || hold || paused || offscreen || tripped) return;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function boot() {
    broken = false;
    programs.clear();
    clearInstances();
    guard = null;
    gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) {
      fail(opts.template, "no WebGL2 context");
      return;
    }
    if (!gl.getExtension("EXT_color_buffer_float")) {
      fail(opts.template, "EXT_color_buffer_float missing");
      return;
    }
    gl.getExtension("OES_texture_float_linear");
    const [w, h] = pixelSize();
    W = w;
    H = h;
    canvas.width = w;
    canvas.height = h;
    vao = gl.createVertexArray();
    outputProgram = link(OUTPUT_FRAG, "output");
    if (!outputProgram) return;
    blackTex = floatTexture(1, 1, new Float32Array([0, 0, 0, 1]));
    audioTex = floatTexture(512, 2, new Float32Array(512 * 2 * 4).fill(0.5));
    fftTex = floatTexture(512, 1, new Float32Array(512 * 4));
    sourceTex = null;
    noteFlash(opts.template, spec.fx);
    draw(0, 0);
    if (!reduced) guardFrame();
    frame = 0;
    origin = performance.now();
    start();
  }

  function applySize() {
    const [w, h] = pixelSize();
    if (!gl || (w === W && h === H)) return;
    W = w;
    H = h;
    canvas.width = w;
    canvas.height = h;
    clearInstances();
    dropGuard();
    if (blackTex) {
      // targets were sized to the old buffer; the 1x1 and audio textures stay valid
    }
    if (hold) draw(frame / fps, frame);
    else if (reduced) draw(0, 0);
    else draw(frame / fps, frame);
  }

  const resize = new ResizeObserver(() => applySize());
  resize.observe(canvas);
  const visibility = new IntersectionObserver((entries) => {
    const entry = entries[0];
    offscreen = Boolean(entry) && entry.isIntersecting === false && entry.intersectionRatio === 0 && canvas.clientHeight > 0;
    if (offscreen) cancelAnimationFrame(rafId);
    else start();
  });
  visibility.observe(canvas);
  const onMotion = () => {
    if (opts.motion === "always") return;
    reduced = motionQuery.matches;
    if (reduced) {
      cancelAnimationFrame(rafId);
      draw(0, 0);
      frame = 0;
    } else {
      origin = performance.now() - (frame / fps) * 1000;
      start();
    }
  };
  motionQuery.addEventListener("change", onMotion);
  const onLost = (event) => {
    event.preventDefault();
    cancelAnimationFrame(rafId);
    instances.clear();
    programs.clear();
    sourceTex = null;
    guard = null;
    gl = null;
  };
  const onRestored = () => boot();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  boot();

  return {
    set(next) {
      params = { ...params, ...next };
    },
    trigger(templateId, extra = {}) {
      const tpl = opts.templates?.[templateId];
      if (!tpl) {
        console.error(`agentvfx: shader compile failed (${templateId} trigger): unknown template`);
        return;
      }
      noteFlash(templateId, tpl.fx);
      if (reduced) return;
      const durationMs = extra.durationMs ?? 400;
      hit = {
        id: templateId,
        tpl,
        params: resolveParams(tpl.fx, { preset: extra.preset ?? null, params: extra.params ?? {} }),
        start: performance.now(),
        until: performance.now() + durationMs,
      };
    },
    audio(media) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !media) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const node = media instanceof MediaStream ? audioCtx.createMediaStreamSource(media) : audioCtx.createMediaElementSource(media);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      node.connect(analyser);
      analyser.connect(audioCtx.destination);
    },
    pause() {
      paused = true;
      cancelAnimationFrame(rafId);
    },
    resume() {
      paused = false;
      hold = false;
      if (tripped) {
        tripped = false;
        dropGuard();
      }
      origin = performance.now() - (frame / fps) * 1000;
      start();
    },
    renderAt(t) {
      hold = true;
      cancelAnimationFrame(rafId);
      const f = Math.round(t * fps);
      frame = f;
      draw(t, f);
    },
    destroy() {
      cancelAnimationFrame(rafId);
      resize.disconnect();
      visibility.disconnect();
      motionQuery.removeEventListener("change", onMotion);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
        analyser = null;
      }
      if (gl) {
        clearInstances();
        dropGuard();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl = null;
    },
  };
}

export const AgentVfx = { mount, textSource };
export default AgentVfx;
