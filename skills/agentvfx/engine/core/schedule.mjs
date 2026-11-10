// agentvfx (Apache-2.0, see LICENSE). The score compositor's timeline: for each frame, which layers are active
// (base stack, cuts, hits), their parameter values (preset, params, audio bindings) and their local
// time. Pure and deterministic; the page only draws what this returns.
import { resolveParams } from "./templates.mjs";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Resolve a `t` / `beat` / `onset` reference to a frame index. */
export function resolveFrame(ref, { fps, features }, path) {
  if (ref.t !== undefined) return Math.round(ref.t * fps);
  const kind = ref.beat !== undefined ? "beat" : "onset";
  const list = kind === "beat" ? features?.meta?.beats : features?.meta?.onsets;
  if (!list) throw Object.assign(new Error(`${path}.${kind}: needs an audio source (input.audio or a video with sound)`), { path: `${path}.${kind}` });
  const idx = ref[kind];
  if (idx >= list.length) throw Object.assign(new Error(`${path}.${kind}: index ${idx} but the track has ${list.length} ${kind}s`), { path: `${path}.${kind}` });
  return list[idx];
}

const layerRef = (l) => (typeof l === "string" ? { template: l } : l);

/** Feature value for a binding ("bands.12" or a scalar name) on one frame of features. */
function featureValue(frame, feature) {
  if (!frame) return 0;
  if (feature.startsWith("bands.")) return Number(frame.bands?.[Number(feature.slice(6))] ?? 0);
  return Number(frame[feature] ?? 0);
}

/**
 * Build the per-frame plan. Returns { frameCount, frames: [{ layers: [{key, template, params, t}] }],
 * templatesUsed: Set, events: [frame...] } where events are the frames of hits and cuts (for strips).
 */
export function buildSchedule(score, lib, { features = null } = {}) {
  const fps = score.fps;
  const frameCount = Math.round(score.durationSec * fps);
  const ctx = { fps, features };
  const used = new Set();
  const resolve = (ref) => {
    const tpl = lib.get(ref.template);
    used.add(ref.template);
    const text = tpl.fx.X_AGENTVFX.text;
    const labels = text ? Object.fromEntries(text.map((t) => [t.key, score.labels?.[t.key] ?? t.default])) : null;
    const styled = text && score.textStyle ? text.filter((t) => score.textStyle[t.key]) : [];
    const textStyle = styled.length ? Object.fromEntries(styled.map((t) => [t.key, score.textStyle[t.key]])) : null;
    return { template: ref.template, params: resolveParams(tpl.fx, ref), inputs: tpl.fx.INPUTS ?? [], labels, textStyle };
  };
  const initial = [{ template: score.template, preset: score.preset, params: score.params }, ...(score.stack ?? []).map(layerRef)].map(resolve);
  const cuts = (score.cuts ?? []).map((c, i) => ({ frame: resolveFrame(c, ctx, `cuts[${i}]`), index: i, layers: c.layers.map(layerRef).map(resolve) }))
    .sort((a, b) => a.frame - b.frame || a.index - b.index);
  const hits = (score.hits ?? []).map((h, i) => ({ start: resolveFrame(h, ctx, `hits[${i}]`), index: i, duration: h.durationFrames, layer: resolve({ template: h.template, preset: h.preset, params: h.params }) }));

  const bindings = (score.bindings ?? []).map((b) => ({ ...b, state: 0 }));
  const frames = [];
  for (let f = 0; f < frameCount; f++) {
    let base = { id: "b", layers: initial };
    for (const c of cuts) if (c.frame <= f) base = { id: `c${c.index}`, layers: c.layers };
    const featureFrame = features?.frames?.[f] ?? null;
    const bound = {};
    for (const b of bindings) {
      const raw = featureValue(featureFrame, b.feature);
      const ms = raw > b.state ? b.attackMs : b.releaseMs;
      const k = isNum(ms) && ms > 0 ? Math.exp(-1000 / (fps * ms)) : 0;
      b.state = k * b.state + (1 - k) * raw;
      bound[b.param] = b.offset + b.gain * b.state;
    }
    const applyBindings = (layer) => {
      if (layer.template !== score.template || !bindings.length) return layer.params;
      const params = { ...layer.params };
      for (const input of layer.inputs) {
        if (bound[input.NAME] === undefined) continue;
        let v = bound[input.NAME];
        if (isNum(input.MIN)) v = Math.max(input.MIN, v);
        if (isNum(input.MAX)) v = Math.min(input.MAX, v);
        params[input.NAME] = input.TYPE === "long" ? Math.round(v) : input.TYPE === "bool" ? v > 0.5 : v;
      }
      return params;
    };
    const layers = base.layers.map((l, i) => ({ key: `${base.id}:${i}`, template: l.template, params: applyBindings(l), t: f / fps, ...(l.labels ? { labels: l.labels } : {}), ...(l.textStyle ? { textStyle: l.textStyle } : {}) }));
    for (const h of hits) {
      if (f >= h.start && f < h.start + h.duration) layers.push({ key: `h${h.index}`, template: h.layer.template, params: h.layer.params, t: (f - h.start) / fps, ...(h.layer.labels ? { labels: h.layer.labels } : {}), ...(h.layer.textStyle ? { textStyle: h.layer.textStyle } : {}) });
    }
    frames.push({ layers });
  }
  const events = [...new Set([...cuts.map((c) => c.frame), ...hits.map((h) => h.start)])].filter((f) => f >= 0 && f < frameCount).sort((a, b) => a - b);
  return { frameCount, fps, frames, templatesUsed: used, events };
}
