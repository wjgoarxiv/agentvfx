// Scene 18 (variant 8, rot 1), lens-wrap: an olive field; the plate wrapped on a sphere (longitude / latitude mapping, a red-blue lens
// fringe, a specular patch) whose size swells with the bass; a perspective floor of pink tile lines that steps toward you on every beat;
// a 4 x 3 block of small panels that each turn a quarter on every third onset; Didot and Courier New type. Palette: ground (olive),
// ink (pink), accent (black), tintA (dark olive), tintB (cream). Text set 19: r the word (Didot), g the caption (Courier New).
void sceneLens(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 pink = inkColor.rgb;
  vec3 blk = accentColor.rgb;
  vec3 cream = tintB.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  // perspective floor
  float hy = 0.58;
  float t = 0.1 / max(c.y - hy + 0.004, 0.004);
  float wx = (c.x - 0.5 * A) * t * 1.2;
  float wz = t * 1.2 + cut * 0.5;
  float gx = 1.0 - clamp((0.5 - abs(fract(wx) - 0.5)) / max(fwidth(wx) * 1.2, 1e-3), 0.0, 1.0);
  float gz = 1.0 - clamp((0.5 - abs(fract(wz) - 0.5)) / max(fwidth(wz) * 1.2, 1e-3), 0.0, 1.0);
  float below = step(hy, c.y);
  col = mix(col, tintA.rgb, 0.6 * below);
  col = mix(col, pink, max(gx, gz) * smoothstep(0.0, 0.08, c.y - hy) * 0.9 * below);
  col = mix(col, pink, scLine(c.y - hy, 1.0) * 0.8);
  // sphere
  vec2 ctr = vec2(0.62, 0.45);
  float R = 0.3 + 0.05 * stLevel().r;
  vec2 d = (c - ctr) / R;
  float r2 = dot(d, d);
  float z = sqrt(max(1.0 - r2, 0.0));
  vec2 uv = vec2(0.5 + atan(d.x, max(z, 0.001)) / 3.0, 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.0);
  vec3 f = vec3(scPlate((uv - 0.5) * S + 0.5 * S, vec2(0.0), S).r, scPlate((uv - 0.5) * 1.025 * S + 0.5 * S, vec2(0.0), S).g, scPlate((uv - 0.5) * 1.05 * S + 0.5 * S, vec2(0.0), S).b);
  f = clamp((f - 0.06) * 1.3, 0.0, 1.0) * (0.35 + 0.65 * z);
  float spec = smoothstep(0.28, 0.0, length((d - vec2(-0.38, -0.42)) * vec2(1.0, 1.6)));
  f = mix(f, cream, spec * 0.55);
  col = mix(col, f, scAA((sqrt(r2) - 1.0) * R));
  col = mix(col, pink, scLine((sqrt(r2) - 1.0) * R, 2.0));
  col = mix(col, pink, scLine(length((c - ctr) * vec2(1.0, 3.2)) - 0.46, 1.0) * 0.8);
  // small panels that turn
  vec2 g = (c - vec2(A - 0.62, 0.06)) / 0.14;
  vec2 pid = floor(g);
  if (pid.x >= 0.0 && pid.x < 4.0 && pid.y >= 0.0 && pid.y < 3.0) {
    float i = pid.x + 4.0 * pid.y;
    vec2 p = (fract(g) - 0.5) * 0.14;
    if (abs(p.x) < 0.055 && abs(p.y) < 0.055) {
      p = stRot(p, floor((clk.z + i) / 3.0) * 1.5708);
      float bars = 0.0;
      for (int j = 0; j < 3; j++) {
        float h = 0.02 + 0.07 * hash12(vec2(i, float(j)));
        bars = max(bars, step(abs(p.x - (-0.03 + 0.03 * float(j))), 0.009) * step(-0.045, p.y) * step(p.y, -0.045 + h));
      }
      col = mix(cream, blk, bars);
    }
  }
  col = mix(col, cream, scSheet(q, 0));
  col = mix(col, cream, scSheet(q, 1));
  col = mix(col, blk, numTxt(q, vec2(0.05, 0.92) * scU, scCell() * 2.0, mod(cut * 3.0, 1000.0), 3));
}
