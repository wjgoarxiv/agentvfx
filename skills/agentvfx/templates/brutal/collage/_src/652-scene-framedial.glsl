// Scene 15 (variant 5, rot 1), frame-loop-dial: a dark aubergine field with a line of Georgia text that runs round the border of the
// frame (every onset jumps it ahead, a quick double speed); an arch window with the plate as a peach Bayer dither; a dial of 60 ticks
// filled up on every beat with a split-flap countdown in its middle (the top half of the old digit folds away in 3 frames); a typed Menlo
// input line. Palette: ground (aubergine), ink (off-white), accent (peach), tintA (plum). Text set 16: r the border line and the
// MesloLGS NF atlas, g the typed line.
float fdFlap(vec2 q, vec2 lo, vec2 sz, float oldD, float newD, float u) {
  float fs = sz.y * 0.8;
  vec2 org = lo + vec2((sz.x - 0.602 * fs) * 0.5, (sz.y - fs) * 0.5);
  float mid = lo.y + 0.5 * sz.y;
  vec2 pn = q - org * scU;
  float dn = aNum(pn, fs * scU, newD, 1);
  float dOld = 0.0;
  float v = 0.0;
  if (q.y >= mid * scU) {
    v = u < 0.66 ? aNum(q - org * scU, fs * scU, oldD, 1) : dn;
  } else {
    float vis = 1.0 - u;
    float yy = mid * scU - (mid * scU - q.y) / max(vis, 0.001);
    if (u < 1.0 && (mid * scU - q.y) < 0.5 * sz.y * scU * vis) { v = aNum(vec2(q.x, yy) - org * scU, fs * scU, oldD, 1); }
    else if (u < 1.0) { v = dn; }
    else { v = dn; }
  }
  return crisp(v, 4.0);
}

void sceneFrameDial(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 off = inkColor.rgb;
  vec3 peach = accentColor.rgb;
  vec3 plum = tintA.rgb;
  float cut = floor(clk.x);
  float age = float(FRAMEINDEX) - clk.y;
  float u = cut < 0.5 ? 1.0 : clamp((age + 1.0) / 3.0, 0.0, 1.0);
  col = groundColor.rgb;
  // text round the border
  float bnd = 0.055;
  vec4 dd = vec4(c.y, A - c.x, 1.0 - c.y, c.x);
  float mn = min(min(dd.x, dd.y), min(dd.z, dd.w));
  float perim = 2.0 * A + 2.0;
  float s;
  float depth = mn;
  if (mn == dd.x) { s = c.x; }
  else if (mn == dd.y) { s = A + c.y; }
  else if (mn == dd.z) { s = A + 1.0 + (A - c.x); }
  else { s = 2.0 * A + 1.0 + (1.0 - c.y); }
  float tflow = TIME * 0.06 * perim + clk.z * 0.06;
  float k = RENDERSIZE.y;
  float ux = mod((s - tflow) * k, 5.0 * 101.8 * k / 360.0);
  float m = crisp(sheetC(vec2(ux, (0.012 + depth / bnd * 0.056) * k), 0), 1.0) * step(depth, bnd);
  col = mix(col, plum, step(depth, bnd));
  col = mix(col, peach, m);
  col = mix(col, peach, scLine(depth - bnd, 1.0) * 0.8);
  // arch window with a peach dither of the plate
  vec2 lo = vec2(0.17, 0.14);
  vec2 hi = vec2(0.84, 0.88);
  float px = scPx();
  vec2 pix = floor(q / px);
  float l = scTone((pix + 0.5) * px, lo * scU, hi * scU, 1.6, 0.06);
  col = mix(col, mix(plum, peach, step(scBayer(pix), l)), scAA(sdArch(c, lo, hi)));
  col = mix(col, off, scLine(sdArch(c, lo - 0.012, hi + 0.012), 1.0));
  // dial of 60 ticks and the split-flap countdown
  vec2 ctr = vec2(1.3, 0.5);
  float rr = length(c - ctr);
  float ang = (atan(c.y - ctr.y, c.x - ctr.x) / 6.28318 + 0.5) * 60.0;
  float tk = step(0.25, fract(ang)) * step(fract(ang), 0.75) * step(0.3, rr) * step(rr, 0.3 + 0.03 + 0.02 * step(mod(floor(ang), 5.0), 0.5));
  float on = step(floor(ang) + 0.5, mod(cut, 60.0));
  col = mix(col, mix(plum * 1.6, peach, on), tk);
  float val = mod(60.0 - cut, 100.0);
  float cw = 0.17;
  float v1 = fdFlap(q, vec2(ctr.x - 0.185, ctr.y - 0.13), vec2(cw, 0.26), floor(mod(60.0 - cut + 1.0, 100.0) / 10.0), floor(val / 10.0), u);
  float v2 = fdFlap(q, vec2(ctr.x + 0.015, ctr.y - 0.13), vec2(cw, 0.26), mod(60.0 - cut + 1.0, 10.0), mod(val, 10.0), u);
  col = mix(col, off, scAA(sdBox(c, vec2(ctr.x - 0.185, ctr.y - 0.13), vec2(ctr.x - 0.015, ctr.y + 0.13)) - 0.02));
  col = mix(col, off, scAA(sdBox(c, vec2(ctr.x + 0.015, ctr.y - 0.13), vec2(ctr.x + 0.185, ctr.y + 0.13)) - 0.02));
  col = mix(col, groundColor.rgb, min(v1 + v2, 1.0));
  col = mix(col, groundColor.rgb, scLine(c.y - ctr.y, 2.0) * scBox(c, vec2(ctr.x - 0.185, 0.0), vec2(ctr.x + 0.185, 1.0)));
  col = mix(col, peach, scSheet(q, 1));
  col = mix(col, off, max(scPlus(c, vec2(1.0, 0.18), 0.02), scPlus(c, vec2(1.6, 0.82), 0.02)));
}
