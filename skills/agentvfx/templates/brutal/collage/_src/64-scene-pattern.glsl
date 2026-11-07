// Scene 4, pattern-sheet: a bone sheet inside a signal-green frame border. The plate is a black line-screen engraving inside the
// big circle; a heavy grotesk label between magenta serif quote marks; outline circles whose radius steps on every onset; thin
// rules, ticks and crosshairs; QR-like pixel stamps that re-seed on every beat; a vertical waveform strip with a 0 to 5 ruler on the
// left edge. Palette: ground (frame green), ink (black), accent (magenta), tintA (bone). Text set 4: r the label and caption,
// g the quote marks.
void scenePattern(vec2 q, vec2 S, vec4 clk, inout vec3 col) {
  vec2 c = q / scU;
  float A = S.x / S.y;
  vec3 ink = inkColor.rgb;
  vec3 mag = accentColor.rgb;
  vec3 bone = tintA.rgb;
  float cut = floor(clk.x);
  col = groundColor.rgb;
  col = mix(col, bone, scAA(sdBox(c, vec2(0.05), vec2(A - 0.05, 0.95))));
  // the big circle with the plate as a horizontal line screen
  vec2 ctr = vec2(1.30, 0.46);
  float R = 0.31;
  float pitch = max(3.0, 8.0 * U);
  float yc = (floor(q.y / pitch) + 0.5) * pitch;
  float l = scTone(vec2(q.x, yc), (ctr - R) * scU, (ctr + R) * scU, 1.5, 0.12);
  float line = clamp(((1.0 - l) * 0.95 * pitch * 0.5) - abs(q.y - yc) + 0.5, 0.0, 1.0);
  float inC = scAA(length(c - ctr) - R);
  col = mix(col, mix(bone, ink, line), inC);
  col = mix(col, ink, scLine(length(c - ctr) - R, 1.6));
  // outline circles; the radii step on every onset
  float st = mod(clk.z, 5.0);
  col = mix(col, ink, scLine(length(c - vec2(0.98, 0.74)) - (0.14 + 0.014 * st), 1.2));
  col = mix(col, ink, scLine(length(c - vec2(0.98, 0.74)) - (0.2 + 0.014 * st), 1.2) * step(0.0, sin(atan(c.y - 0.74, c.x - 0.98) * 18.0 + 1.0)));
  col = mix(col, mag, scLine(length(c - vec2(1.62, 0.80)) - (0.06 + 0.012 * st), 2.0));
  col = mix(col, ink, scLine(length(c - vec2(1.62, 0.80)) - 0.1, 1.0));
  // rules, ticks and crosshairs
  float ex = step(0.2, c.x) * step(c.x, A - 0.05);
  col = mix(col, ink, max(scLine(c.y - 0.87, 1.2) * ex, step(mod(q.x, 0.025 * scU), 1.0) * step(abs(c.y - 0.885), 0.013) * ex));
  col = mix(col, ink, scLine(c.x - 0.92, 1.0) * step(0.05, c.y) * step(c.y, 0.32) * 0.9);
  col = mix(col, ink, scLine((c.x - 0.2) - (0.95 - c.y), 1.0) * step(0.2, c.x) * step(c.x, 0.5) * step(0.75, c.y) * 0.8);
  col = mix(col, ink, scAA(length(c - vec2(0.92, 0.87)) - 0.016));
  col = mix(col, mag, scAA(length(c - vec2(1.62, 0.80)) - 0.016));
  for (int i = 0; i < 4; i++) {
    vec2 p = vec2(0.26 + 0.52 * float(i), 0.46);
    col = mix(col, ink, max(scLine(c.y - p.y, 1.0) * step(abs(c.x - p.x), 0.018), scLine(c.x - p.x, 1.0) * step(abs(c.y - p.y), 0.018)) * step(float(i), 1.5));
  }
  // QR stamps, re-seeded on the beat
  float q1 = scQR(c, vec2(0.25, 0.09), 0.17, cut);
  float q2 = scQR(c, vec2(0.62, 0.09), 0.11, cut + 41.0);
  col = mix(col, ink, step(0.5, q1));
  col = mix(col, ink, step(-0.5, q2));
  col = mix(col, bone, step(0.5, q2));
  // the vertical waveform strip and its 0..5 ruler
  float t = clamp((c.y - 0.09) / 0.82, 0.0, 1.0);
  float amp = clamp(waveI(floor(t * 255.0) * 2.0) * scopeGain * 0.08, -0.028, 0.028);
  float rowOn = step(mod(q.y, 2.0), 1.0);
  float wv = step(0.075, c.x) * step(c.x, 0.135) * step(0.09, c.y) * step(c.y, 0.91) * rowOn * step(abs(c.x - 0.105), abs(amp) + 0.0015);
  col = mix(col, ink, wv);
  col = mix(col, ink, scLine(sdBox(c, vec2(0.075, 0.09), vec2(0.135, 0.91)), 1.0));
  float rk = (c.y - 0.09) / 0.82 * 25.0;
  float major = step(abs(rk - floor(rk / 5.0 + 0.5) * 5.0), 0.12) * step(0.0, rk) * step(rk, 25.2);
  float minor = step(abs(rk - floor(rk + 0.5)), 0.12) * step(0.0, rk) * step(rk, 25.2);
  col = mix(col, ink, max(major * step(0.14, c.x) * step(c.x, 0.165), minor * step(0.14, c.x) * step(c.x, 0.152)));
  float dc = scCell();
  for (int i = 0; i < 6; i++) { col = mix(col, ink, numTxt(q, vec2(0.172, 0.09 + 0.164 * float(i) - 0.012) * scU, dc, float(i), 1)); }
  // the label and the quote marks
  col = mix(col, ink, scSheet(q, 0));
  col = mix(col, mag, scSheet(q, 1));
}
