// Procedural outline glyphs (original shapes). p is relative to the glyph centre, R is its radius in design units.
float iconCylinder(vec2 p, float R) {
  float w = R * 0.62;
  float h = R * 0.78;
  float e = R * 0.27;
  float d = min(sdSeg(p, vec2(-w, -h), vec2(-w, h)), sdSeg(p, vec2(w, -h), vec2(w, h)));
  d = min(d, abs(sdEll(p - vec2(0.0, -h), vec2(w, e))));
  if (p.y > h) d = min(d, abs(sdEll(p - vec2(0.0, h), vec2(w, e))));
  return strokeAA(d, 1.5);
}
float iconFolder(vec2 p, float R) {
  float d = abs(sdRound(p - vec2(0.0, R * 0.14), vec2(R * 0.95, R * 0.62), 2.0));
  d = min(d, sdSeg(p, vec2(-R * 0.95, -R * 0.48), vec2(-R * 0.95, -R * 0.76)));
  d = min(d, sdSeg(p, vec2(-R * 0.95, -R * 0.76), vec2(-R * 0.25, -R * 0.76)));
  d = min(d, sdSeg(p, vec2(-R * 0.25, -R * 0.76), vec2(R * 0.02, -R * 0.48)));
  return strokeAA(d, 1.5);
}
float iconSwirl(vec2 p, float R) {
  float r = length(p);
  return max(burst(p, R * 0.2, R, 14.0, 1.2, 0.0, 1.7), fillAA(r - R * 0.11));
}
float iconLayers(vec2 p, float R) {
  float d = abs(sdRhomb(p - vec2(0.0, -R * 0.38), vec2(R, R * 0.46)));
  vec2 a = vec2(-R, R * 0.04);
  vec2 b = vec2(0.0, R * 0.5);
  vec2 c = vec2(R, R * 0.04);
  d = min(d, min(sdSeg(p, a, b), sdSeg(p, b, c)));
  d = min(d, min(sdSeg(p, a + vec2(0.0, R * 0.42), b + vec2(0.0, R * 0.42)), sdSeg(p, b + vec2(0.0, R * 0.42), c + vec2(0.0, R * 0.42))));
  return strokeAA(d, 1.5);
}
float iconMoon(vec2 p, float R) {
  return fillAA(max(length(p) - R * 0.88, -(length(p - vec2(R * 0.46, -R * 0.14)) - R * 0.74)));
}
float iconSnow(vec2 p, float R) {
  float m = max(burst(p, R * 0.3, R, 8.0, 1.3, 0.3927, 0.0), burst(p, R * 0.3, R * 0.62, 8.0, 1.3, 0.0, 0.0));
  return max(m, strokeAA(length(p) - R * 0.22, 1.4));
}
float iconTrefoil(vec2 p, float R) {
  float r = R * 0.34;
  float d = abs(sdTri(vec2(p.x, -(p.y + R * 0.5)), r));
  d = min(d, abs(sdTri(vec2(p.x + R * 0.5, -(p.y - R * 0.36)), r)));
  d = min(d, abs(sdTri(vec2(p.x - R * 0.5, -(p.y - R * 0.36)), r)));
  return max(strokeAA(d, 1.4), fillAA(length(p - vec2(0.0, R * 0.12)) - R * 0.07));
}
float iconDots(vec2 p, float R) {
  float d = abs(sdEll(p, vec2(R, R * 0.78)));
  d = min(d, abs(length(p - vec2(-R * 0.3, 0.0)) - R * 0.2));
  d = min(d, abs(length(p - vec2(R * 0.3, 0.0)) - R * 0.2));
  return strokeAA(d, 1.4);
}
float iconCube(vec2 p, float R) {
  float d = 1e3;
  vec2 prev = R * vec2(cos(0.5236), sin(0.5236));
  for (int i = 1; i <= 6; i++) {
    float a = 0.5236 + float(i) * 1.0472;
    vec2 cur = R * vec2(cos(a), sin(a));
    d = min(d, sdSeg(p, prev, cur));
    prev = cur;
  }
  d = min(d, sdSeg(p, vec2(0.0), R * vec2(cos(0.5236), sin(0.5236))));
  d = min(d, sdSeg(p, vec2(0.0), R * vec2(cos(2.618), sin(2.618))));
  d = min(d, sdSeg(p, vec2(0.0), R * vec2(0.0, -1.0)));
  float grid = step(0.5, mod(floor(p.x / 3.0) + floor(p.y / 3.0), 2.0)) * fillAA(sdBox(p - R * vec2(0.28, 0.2), R * vec2(0.22, 0.28)));
  return max(strokeAA(d, 1.5), grid);
}
float iconCircleCross(vec2 p, float R) {
  return max(strokeAA(length(p) - R, 1.3), plusMark(p, R * 1.2));
}
float iconOverlap(vec2 p, float R) {
  float d = min(abs(length(p - vec2(-R * 0.25, -R * 0.2)) - R * 0.62), abs(sdBox(p - vec2(R * 0.28, R * 0.25), vec2(R * 0.5))));
  return strokeAA(d, 1.3);
}
