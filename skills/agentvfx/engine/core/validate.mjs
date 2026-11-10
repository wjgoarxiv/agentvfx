// agentvfx (Apache-2.0, see LICENSE). Hand-rolled validators for templates (fx.json) and FX scores. Every error
// names the JSON path that failed, so the model can fix the exact field.
import { PALETTE_NAMES } from "./palettes.mjs";
import { FAMILY_PATTERN } from "../web/text.mjs";

export const SPDX_ALLOWED = Object.freeze(["MIT", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "CC0-1.0"]);
export const INPUT_TYPES = Object.freeze(["float", "long", "bool", "color", "point2D", "image", "audio", "audioFFT", "event"]);
export const TEMPLATE_INPUT_KINDS = Object.freeze(["generative", "footage", "either"]);
export const FLASH_KINDS = Object.freeze(["none", "possible", "strobe"]);
export const SAFETY_MODES = Object.freeze(["stage", "broadcast-safe"]);
export const FPS_ALLOWED = Object.freeze([24, 25, 30, 50, 60]);
export const SCALAR_FEATURES = Object.freeze([
  "rms", "peak", "rmsDb", "bass", "mid", "treb", "bass_att", "mid_att", "treb_att",
  "flux", "onset", "beat", "beatPhase", "bpm", "corr", "width", "balance",
]);
const BAND_FEATURE = /^bands\.(?:[0-9]|[12][0-9]|3[01])$/u;
const SCORE_KEYS = Object.freeze(["version", "template", "preset", "params", "stack", "input", "durationSec", "fps", "seed", "bindings", "hits", "cuts", "palette", "safety", "credit", "out", "labels", "textStyle"]);
export const TEXT_FONTS = Object.freeze(["display", "tall", "grotesk", "mono", "serif"]);
const TEXT_KEYS = Object.freeze(["key", "default", "x", "y", "size", "font", "weight", "style", "align", "tracking", "box", "reveal", "revealStart", "revealDur", "maxWidth", "lineHeight", "channel", "family", "set"]);
export const TEXT_STYLE_KEYS = Object.freeze(["font", "family", "size", "x", "y", "tracking", "align", "weight"]);

/** Text item keys declared by any template the score uses (labels and textStyle must name one). */
function scoreTextKeys(score, lib) {
  const id = (l) => (typeof l === "string" ? l : l?.template);
  const ids = [score.template, ...(score.stack ?? []).map(id), ...(score.cuts ?? []).flatMap((c) => (c.layers ?? []).map(id)), ...(score.hits ?? []).map((h) => h.template)];
  return new Set(ids.flatMap((t) => lib.get(t)?.fx.X_AGENTVFX.text ?? []).map((t) => t.key));
}

/** X_AGENTVFX.text: engine-drawn text items (references/template-format.md "Text layer"). */
function checkTextSpec(list, err) {
  if (!Array.isArray(list)) return err("X_AGENTVFX.text", "must be a list of text items");
  const keys = new Set();
  list.forEach((t, i) => {
    const p = `X_AGENTVFX.text[${i}]`;
    if (!isObj(t)) return err(p, "must be an object");
    for (const k of Object.keys(t)) if (!TEXT_KEYS.includes(k)) err(`${p}.${k}`, `unknown key (allowed: ${TEXT_KEYS.join(", ")})`);
    if (typeof t.key !== "string" || !/^[a-z][a-zA-Z0-9_]*$/u.test(t.key)) err(`${p}.key`, "required identifier");
    else if (keys.has(t.key)) err(`${p}.key`, `duplicate key ${t.key}`);
    else keys.add(t.key);
    if (typeof t.default !== "string") err(`${p}.default`, "required string (\\n for new lines)");
    for (const k of ["x", "y"]) if (!(isNum(t[k]) && t[k] >= -0.5 && t[k] <= 1.5)) err(`${p}.${k}`, "required 0..1 (fraction of width/height, top-left origin)");
    if (!(isNum(t.size) && t.size > 0 && t.size <= 1)) err(`${p}.size`, "required 0..1 (fraction of frame height)");
    if (t.font !== undefined && !TEXT_FONTS.includes(t.font)) err(`${p}.font`, `must be one of ${TEXT_FONTS.join(", ")}`);
    if (t.style !== undefined && !["fill", "outline"].includes(t.style)) err(`${p}.style`, "fill or outline");
    if (t.align !== undefined && !["left", "center", "right"].includes(t.align)) err(`${p}.align`, "left, center or right");
    if (t.box !== undefined && !["none", "frame", "tab", "bar"].includes(t.box)) err(`${p}.box`, "none, frame, tab or bar");
    if (t.family !== undefined && !(typeof t.family === "string" && FAMILY_PATTERN.test(t.family))) err(`${p}.family`, "an installed font family name (letters, digits, spaces, . _ -; up to 64 characters)");
    if (t.channel !== undefined && !["r", "g", "b"].includes(t.channel)) err(`${p}.channel`, "r, g or b (the mask channel the glyph ink is drawn into)");
    if (t.set !== undefined && !(Number.isInteger(t.set) && t.set >= 0 && t.set <= 31)) err(`${p}.set`, "integer 0..31 (the item is drawn only while the template input textSet equals it; default 0)");
    if (t.reveal !== undefined && !["none", "type", "decode"].includes(t.reveal)) err(`${p}.reveal`, "none, type or decode");
    for (const k of ["weight", "tracking", "revealStart", "revealDur", "maxWidth", "lineHeight"]) if (t[k] !== undefined && !isNum(t[k])) err(`${p}.${k}`, "must be a number");
  });
}
const HEX = /^#[0-9a-f]{6}$/iu;
/** Names an INPUT may not take: GLSL ES 3.00 built-ins and keywords, and the prelude's own names. */
export const RESERVED_NAMES = Object.freeze(new Set([
  "step", "mix", "clamp", "min", "max", "abs", "sign", "floor", "ceil", "fract", "mod", "modf", "round", "trunc", "pow", "exp", "exp2",
  "log", "log2", "sqrt", "inversesqrt", "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "radians", "degrees",
  "length", "distance", "dot", "cross", "normalize", "reflect", "refract", "faceforward", "smoothstep", "texture", "textureSize",
  "texelFetch", "textureLod", "dFdx", "dFdy", "fwidth", "isnan", "isinf", "any", "all", "not", "equal", "lessThan", "greaterThan",
  "transpose", "inverse", "determinant", "outerProduct", "matrixCompMult", "packHalf2x16", "unpackHalf2x16",
  "float", "int", "uint", "bool", "vec2", "vec3", "vec4", "ivec2", "ivec3", "ivec4", "mat2", "mat3", "mat4", "sampler2D",
  "in", "out", "inout", "uniform", "const", "if", "else", "for", "while", "do", "break", "continue", "return", "discard", "true", "false",
  "struct", "void", "main", "precision", "highp", "mediump", "lowp", "layout", "flat", "smooth", "centroid", "invariant", "switch", "case", "default",
  "TIME", "TIMEDELTA", "FRAMEINDEX", "PASSINDEX", "RENDERSIZE", "SEED", "HAS_INPUT", "PALETTE", "PALETTE_COUNT", "vUv", "fragColor",
  "inputImage", "audio", "audioFFT", "AUDIO_RMS", "AUDIO_PEAK", "AUDIO_BASS", "AUDIO_MID", "AUDIO_TREB", "AUDIO_BASS_ATT", "AUDIO_MID_ATT",
  "AUDIO_TREB_ATT", "AUDIO_FLUX", "AUDIO_ONSET", "AUDIO_BEAT", "AUDIO_BEATPHASE", "AUDIO_BPM", "AUDIO_BANDS",
  "hash12", "hash22", "vnoise", "fbm", "luma", "rgb2hsv", "hsv2rgb", "cosPalette", "paletteRamp", "paletteCycle", "srgbToLinear",
  "linearToSrgb", "rot", "isf_FragNormCoord", "TEXTMASK", "HAS_TEXT",
]));

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);

/** Check one parameter value against its ISF input declaration. Returns an error message or null. */
export function checkParamValue(input, value) {
  switch (input.TYPE) {
    case "float":
      if (!isNum(value)) return "must be a number";
      break;
    case "long":
      if (!isInt(value)) return "must be an integer";
      if (Array.isArray(input.VALUES) && !input.VALUES.includes(value)) return `must be one of ${input.VALUES.join(", ")}`;
      break;
    case "bool":
      if (typeof value !== "boolean") return "must be true or false";
      return null;
    case "color":
      if (!Array.isArray(value) || value.length !== 4 || !value.every((c) => isNum(c) && c >= 0 && c <= 1)) return "must be [r, g, b, a] with each 0..1";
      return null;
    case "point2D":
      if (!Array.isArray(value) || value.length !== 2 || !value.every(isNum)) return "must be [x, y]";
      return null;
    default:
      return `${input.TYPE} inputs cannot be set by a parameter`;
  }
  if (isNum(input.MIN) && value < input.MIN) return `must be >= ${input.MIN}`;
  if (isNum(input.MAX) && value > input.MAX) return `must be <= ${input.MAX}`;
  return null;
}

/** Validate one template's fx.json. `folderId` is the expected id (the folder name). */
export function validateTemplate(fx, folderId = null) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });
  if (!isObj(fx)) return { ok: false, errors: [{ path: "", message: "fx.json must be an object" }] };
  if (typeof fx.DESCRIPTION !== "string" || !fx.DESCRIPTION) err("DESCRIPTION", "required string");
  if (fx.CATEGORIES !== undefined && !(Array.isArray(fx.CATEGORIES) && fx.CATEGORIES.every((c) => typeof c === "string"))) err("CATEGORIES", "must be a list of strings");
  const inputs = fx.INPUTS ?? [];
  if (!Array.isArray(inputs)) err("INPUTS", "must be a list");
  const byName = new Map();
  (Array.isArray(inputs) ? inputs : []).forEach((input, i) => {
    const p = `INPUTS[${i}]`;
    if (!isObj(input) || typeof input.NAME !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(input.NAME)) return err(`${p}.NAME`, "required GLSL identifier");
    if (byName.has(input.NAME)) err(`${p}.NAME`, `duplicate input ${input.NAME}`);
    if (RESERVED_NAMES.has(input.NAME) || input.NAME.startsWith("gl_")) err(`${p}.NAME`, `${input.NAME} is a GLSL built-in or prelude name; pick another`);
    byName.set(input.NAME, input);
    if (!INPUT_TYPES.includes(input.TYPE)) return err(`${p}.TYPE`, `must be one of ${INPUT_TYPES.join(", ")}`);
    if ((input.TYPE === "float" || input.TYPE === "long") && (!isNum(input.MIN) || !isNum(input.MAX) || input.MIN > input.MAX)) err(p, "float/long inputs need numeric MIN <= MAX");
    if (input.DEFAULT !== undefined) {
      const m = checkParamValue(input, input.DEFAULT);
      if (m) err(`${p}.DEFAULT`, m);
    }
  });
  if (fx.PASSES !== undefined) {
    if (!Array.isArray(fx.PASSES) || fx.PASSES.length === 0) err("PASSES", "must be a non-empty list");
    else fx.PASSES.forEach((pass, i) => {
      if (!isObj(pass)) return err(`PASSES[${i}]`, "must be an object");
      if (pass.TARGET !== undefined && (typeof pass.TARGET !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(pass.TARGET) || RESERVED_NAMES.has(pass.TARGET))) err(`PASSES[${i}].TARGET`, "must be a GLSL identifier that is not a built-in or prelude name");
      if (pass.PERSISTENT !== undefined && typeof pass.PERSISTENT !== "boolean") err(`PASSES[${i}].PERSISTENT`, "must be boolean");
      if (pass.FLOAT !== undefined && typeof pass.FLOAT !== "boolean") err(`PASSES[${i}].FLOAT`, "must be boolean");
    });
  }
  const x = fx.X_AGENTVFX;
  if (!isObj(x)) {
    err("X_AGENTVFX", "required object");
    return { ok: false, errors };
  }
  if (typeof x.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(x.id)) err("X_AGENTVFX.id", "required kebab-case id");
  else if (folderId && x.id !== folderId && !folderId.endsWith(`/${x.id}`)) err("X_AGENTVFX.id", `must match the folder (${folderId})`);
  if (typeof x.family !== "string" || !x.family) err("X_AGENTVFX.family", "required string");
  if (!TEMPLATE_INPUT_KINDS.includes(x.input)) err("X_AGENTVFX.input", `must be one of ${TEMPLATE_INPUT_KINDS.join(", ")}`);
  if (!SPDX_ALLOWED.includes(x.spdx)) err("X_AGENTVFX.spdx", `must be one of ${SPDX_ALLOWED.join(", ")}`);
  if (!FLASH_KINDS.includes(x.flash)) err("X_AGENTVFX.flash", `must be one of ${FLASH_KINDS.join(", ")}`);
  if (x.fps !== undefined && !FPS_ALLOWED.includes(x.fps)) err("X_AGENTVFX.fps", `must be one of ${FPS_ALLOWED.join(", ")}`);
  if (x.palette !== undefined && typeof x.palette !== "boolean") err("X_AGENTVFX.palette", "must be boolean");
  if (x.credits !== undefined && !(Array.isArray(x.credits) && x.credits.every((c) => typeof c === "string"))) err("X_AGENTVFX.credits", "must be a list of strings");
  if (x.audioBind !== undefined && !isObj(x.audioBind)) err("X_AGENTVFX.audioBind", "must be an object of param -> feature hint");
  if (x.safeSubstitute !== undefined && !isObj(x.safeSubstitute)) err("X_AGENTVFX.safeSubstitute", "must be an object { template?, params? }");
  if (x.text !== undefined) checkTextSpec(x.text, err);
  if (!isObj(x.presets) || Object.keys(x.presets).length < 3) err("X_AGENTVFX.presets", "needs at least 3 named presets");
  else for (const [name, values] of Object.entries(x.presets)) {
    if (!isObj(values)) {
      err(`X_AGENTVFX.presets.${name}`, "must be an object of parameter values");
      continue;
    }
    for (const [param, value] of Object.entries(values)) {
      const input = byName.get(param);
      if (!input) err(`X_AGENTVFX.presets.${name}.${param}`, "is not a declared input");
      else {
        const m = checkParamValue(input, value);
        if (m) err(`X_AGENTVFX.presets.${name}.${param}`, m);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function checkLayer(layer, path, lib, err) {
  const ref = typeof layer === "string" ? { template: layer } : layer;
  if (!isObj(ref) || typeof ref.template !== "string") return err(path, "must be a template id or { template, preset?, params? }");
  const tpl = lib.get(ref.template);
  if (!tpl) return err(`${path}.template`, `unknown template ${ref.template}`);
  checkPresetParams(tpl, ref, path, err);
}

function checkPresetParams(tpl, ref, base, err) {
  const pre = base ? `${base}.` : "";
  if (ref.preset !== undefined && !(typeof ref.preset === "string" && tpl.fx.X_AGENTVFX.presets[ref.preset])) {
    err(`${pre}preset`, `unknown preset for ${tpl.id}: ${ref.preset} (have ${Object.keys(tpl.fx.X_AGENTVFX.presets).join(", ")})`);
  }
  if (ref.params !== undefined) {
    if (!isObj(ref.params)) return err(`${pre}params`, "must be an object");
    const inputs = new Map((tpl.fx.INPUTS ?? []).map((i) => [i.NAME, i]));
    for (const [name, value] of Object.entries(ref.params)) {
      const input = inputs.get(name);
      if (!input) err(`${pre}params.${name}`, `not an input of ${tpl.id}`);
      else {
        const m = checkParamValue(input, value);
        if (m) err(`${pre}params.${name}`, m);
      }
    }
  }
}

function checkWhen(obj, path, err, keys) {
  const present = keys.filter((k) => obj[k] !== undefined);
  if (present.length !== 1) return err(path, `needs exactly one of ${keys.join(" | ")}`);
  const k = present[0];
  if (k === "t" ? !(isNum(obj.t) && obj.t >= 0) : !(isInt(obj[k]) && obj[k] >= 0)) err(`${path}.${k}`, k === "t" ? "must be seconds >= 0" : "must be an index >= 0");
}

/**
 * Validate an FX score against the library. Returns { ok, errors: [{path, message}], value } where
 * value is the score with defaults resolved (fps, safety).
 */
export function validateScore(score, lib) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });
  if (!isObj(score)) return { ok: false, errors: [{ path: "", message: "the score must be a JSON object" }], value: null };
  for (const key of Object.keys(score)) if (!SCORE_KEYS.includes(key)) err(key, `unknown key (allowed: ${SCORE_KEYS.join(", ")})`);
  if (score.version !== 1) err("version", "must be 1");
  const tpl = typeof score.template === "string" ? lib.get(score.template) : null;
  if (!tpl) err("template", `unknown template ${JSON.stringify(score.template)} (run vfx.mjs list)`);
  else checkPresetParams(tpl, score, "", err);
  if (score.stack !== undefined) {
    if (!Array.isArray(score.stack) || score.stack.length > 2) err("stack", "must be a list of at most 2 layers (3 with the base template)");
    else score.stack.forEach((l, i) => checkLayer(l, `stack[${i}]`, lib, err));
  }
  if (!(isNum(score.durationSec) && score.durationSec >= 3 && score.durationSec <= 5)) err("durationSec", "must be a number from 3 to 5");
  const fps = score.fps ?? tpl?.fx.X_AGENTVFX.fps ?? 30;
  if (!FPS_ALLOWED.includes(fps)) err("fps", `must be one of ${FPS_ALLOWED.join(", ")}`);
  if (!(isInt(score.seed) && score.seed >= 0 && score.seed <= 0xffffffff)) err("seed", "must be an integer 0..2^32-1");
  if (score.input !== undefined) {
    if (!isObj(score.input)) err("input", "must be { video?, audio?, startSec? }");
    else {
      for (const k of Object.keys(score.input)) if (!["video", "audio", "startSec"].includes(k)) err(`input.${k}`, "unknown key");
      for (const k of ["video", "audio"]) if (score.input[k] !== undefined && (typeof score.input[k] !== "string" || !score.input[k])) err(`input.${k}`, "must be a file path");
      if (score.input.startSec !== undefined && !(isNum(score.input.startSec) && score.input.startSec >= 0)) err("input.startSec", "must be seconds >= 0");
    }
  }
  if (tpl && tpl.fx.X_AGENTVFX.input === "footage" && !score.input?.video) err("input.video", `${tpl.id} needs a video clip`);
  if (score.bindings !== undefined) {
    if (!Array.isArray(score.bindings)) err("bindings", "must be a list");
    else score.bindings.forEach((b, i) => {
      const p = `bindings[${i}]`;
      if (!isObj(b)) return err(p, "must be an object");
      const inputs = new Map((tpl?.fx.INPUTS ?? []).map((x) => [x.NAME, x]));
      const input = inputs.get(b.param);
      if (!input) err(`${p}.param`, `not an input of ${score.template}`);
      else if (!["float", "long", "bool"].includes(input.TYPE)) err(`${p}.param`, "only float, long and bool inputs can be bound");
      if (!(SCALAR_FEATURES.includes(b.feature) || BAND_FEATURE.test(b.feature ?? ""))) err(`${p}.feature`, `must be one of ${SCALAR_FEATURES.join(", ")} or bands.0..bands.31`);
      for (const k of ["gain", "offset"]) if (!isNum(b[k])) err(`${p}.${k}`, "required number");
      for (const k of ["attackMs", "releaseMs"]) if (b[k] !== undefined && !(isNum(b[k]) && b[k] >= 0)) err(`${p}.${k}`, "must be ms >= 0");
    });
    if (score.bindings.length && !score.input?.audio && !(tpl && score.input?.video)) err("input.audio", "bindings need an audio source (input.audio, or a video with sound)");
  }
  if (score.hits !== undefined) {
    if (!Array.isArray(score.hits)) err("hits", "must be a list");
    else score.hits.forEach((h, i) => {
      const p = `hits[${i}]`;
      if (!isObj(h)) return err(p, "must be an object");
      checkWhen(h, p, err, ["t", "onset", "beat"]);
      checkLayer({ template: h.template, preset: h.preset, params: h.params }, p, lib, err);
      if (!(isInt(h.durationFrames) && h.durationFrames >= 1)) err(`${p}.durationFrames`, "must be an integer >= 1");
    });
  }
  if (score.cuts !== undefined) {
    if (!Array.isArray(score.cuts)) err("cuts", "must be a list");
    else score.cuts.forEach((c, i) => {
      const p = `cuts[${i}]`;
      if (!isObj(c)) return err(p, "must be an object");
      checkWhen(c, p, err, ["t", "beat"]);
      if (!Array.isArray(c.layers) || c.layers.length < 1 || c.layers.length > 3) err(`${p}.layers`, "must be a list of 1 to 3 layers");
      else c.layers.forEach((l, j) => checkLayer(l, `${p}.layers[${j}]`, lib, err));
    });
  }
  if (score.palette !== undefined) {
    const ok = typeof score.palette === "string" ? PALETTE_NAMES.includes(score.palette)
      : Array.isArray(score.palette) && score.palette.length >= 2 && score.palette.length <= 8 && score.palette.every((h) => HEX.test(h));
    if (!ok) err("palette", `must be one of ${PALETTE_NAMES.join(", ")} or a list of 2-8 #rrggbb colours`);
  }
  const safety = { mode: "stage", safeVariant: false };
  if (score.safety !== undefined) {
    if (!isObj(score.safety)) err("safety", "must be { mode?, safeVariant? }");
    else {
      for (const k of Object.keys(score.safety)) if (!["mode", "safeVariant"].includes(k)) err(`safety.${k}`, "unknown key");
      if (score.safety.mode !== undefined) {
        if (!SAFETY_MODES.includes(score.safety.mode)) err("safety.mode", `must be one of ${SAFETY_MODES.join(", ")}`);
        else safety.mode = score.safety.mode;
      }
      if (score.safety.safeVariant !== undefined) {
        if (typeof score.safety.safeVariant !== "boolean") err("safety.safeVariant", "must be boolean");
        else safety.safeVariant = score.safety.safeVariant;
      }
    }
  }
  // On-screen credit: a small corner mark on by default; the score may opt out.
  const credit = { overlay: true };
  if (score.credit !== undefined) {
    if (!isObj(score.credit)) err("credit", "must be { overlay? }");
    else {
      for (const k of Object.keys(score.credit)) if (k !== "overlay") err(`credit.${k}`, "unknown key");
      if (score.credit.overlay !== undefined) {
        if (typeof score.credit.overlay !== "boolean") err("credit.overlay", "must be boolean");
        else credit.overlay = score.credit.overlay;
      }
    }
  }
  if (score.out !== undefined && (typeof score.out !== "string" || !score.out)) err("out", "must be a non-empty string");
  if (score.labels !== undefined) {
    if (!isObj(score.labels)) err("labels", "must be an object of text key -> string");
    else {
      const known = scoreTextKeys(score, lib);
      for (const [k, v] of Object.entries(score.labels)) {
        if (typeof v !== "string") err(`labels.${k}`, "must be a string");
        else if (!known.has(k)) err(`labels.${k}`, `no template in this score declares a text item "${k}" (have ${[...known].join(", ") || "none"})`);
      }
    }
  }
  if (score.textStyle !== undefined) {
    if (!isObj(score.textStyle)) err("textStyle", "must be an object of text key -> { font?, size?, x?, y?, tracking?, align? }");
    else {
      const known = scoreTextKeys(score, lib);
      for (const [k, v] of Object.entries(score.textStyle)) {
        if (!known.has(k)) err(`textStyle.${k}`, `no template in this score declares a text item "${k}" (have ${[...known].join(", ") || "none"})`);
        else if (!isObj(v)) err(`textStyle.${k}`, "must be an object");
        else {
          for (const p of Object.keys(v)) if (!TEXT_STYLE_KEYS.includes(p)) err(`textStyle.${k}.${p}`, `unknown key (allowed: ${TEXT_STYLE_KEYS.join(", ")})`);
          if (v.font !== undefined && !TEXT_FONTS.includes(v.font)) err(`textStyle.${k}.font`, `must be one of ${TEXT_FONTS.join(", ")}`);
          if (v.family !== undefined && !(typeof v.family === "string" && FAMILY_PATTERN.test(v.family))) err(`textStyle.${k}.family`, "an installed font family name (letters, digits, spaces, . _ -; up to 64 characters)");
          if (v.size !== undefined && !(isNum(v.size) && v.size > 0 && v.size <= 1)) err(`textStyle.${k}.size`, "must be 0..1 (fraction of frame height)");
          for (const p of ["x", "y"]) if (v[p] !== undefined && !(isNum(v[p]) && v[p] >= -0.5 && v[p] <= 1.5)) err(`textStyle.${k}.${p}`, "must be a fraction of the frame, -0.5..1.5");
          if (v.weight !== undefined && !(isNum(v.weight) && v.weight >= 100 && v.weight <= 900)) err(`textStyle.${k}.weight`, "must be 100..900");
          if (v.tracking !== undefined && !(isNum(v.tracking) && v.tracking >= -0.2 && v.tracking <= 2)) err(`textStyle.${k}.tracking`, "must be -0.2..2 (em)");
          if (v.align !== undefined && !["left", "center", "right"].includes(v.align)) err(`textStyle.${k}.align`, "left, center or right");
        }
      }
    }
  }
  const value = errors.length ? null : { ...score, fps, safety, credit };
  return { ok: errors.length === 0, errors, value };
}
