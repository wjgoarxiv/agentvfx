// punch-shake: a hit layer. The frame is scaled about its centre by 1 + punch*env, rolled and shifted
// by a decaying random kick that flips sign every frame. The kick is integrated over the shutter
// interval (previous frame's pose to this frame's pose) so a fast punch smears along its motion.
float hitEnv(float n, float total, float hold, float curve) {
  if (n < 0.0 || n >= total) return 0.0;
  if (n < hold) return 1.0;
  float k = (n - hold + 1.0) / (total - hold + 1.0);
  return pow(clamp(1.0 - k, 0.0, 1.0), curve);
}

// pose: x = zoom, y = roll, zw = offset (uv units)
vec4 poseAt(float n, float aspect) {
  float env = hitEnv(n, float(hitFrames), float(holdFrames), decayCurve);
  float a = hash12(vec2(n, 11.0)) * 6.28318;
  float sgn = mod(n, 2.0) < 1.0 ? 1.0 : -0.8;
  vec2 off = vec2(cos(a) / aspect, sin(a)) * shake * env * sgn;
  float rl = roll * env * sgn * (hash12(vec2(n, 5.0)) > 0.5 ? 1.0 : -1.0);
  return vec4(1.0 + punch * env, rl, off);
}

vec2 edgeUv(vec2 uv) {
  if (edge == 0) {
    return 1.0 - abs(1.0 - mod(uv, 2.0));
  }
  return clamp(uv, 0.0, 1.0);
}

vec3 tap(vec4 pose, float aspect, float zk) {
  vec2 c = vUv - 0.5;
  c.x *= aspect;
  c = rot(pose.y) * c;
  c /= pose.x * zk;
  c.x /= aspect;
  vec2 uv = c + 0.5 + pose.zw;
  vec3 col = texture(inputImage, edgeUv(uv)).rgb;
  if (edge == 2 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) {
    col = vec3(0.0);
  }
  return col;
}

void main() {
  float aspect = RENDERSIZE.x / max(RENDERSIZE.y, 1.0);
  float n = floor(TIME / TIMEDELTA + 0.5);
  float env = hitEnv(n, float(hitFrames), float(holdFrames), decayCurve);
  if (env <= 0.0) {
    fragColor = vec4(texture(inputImage, vUv).rgb, 1.0);
    return;
  }
  vec4 now = poseAt(n, aspect);
  vec4 prev = poseAt(n - 1.0, aspect);
  vec3 acc = vec3(0.0);
  const int TAPS = 14;
  for (int k = 0; k < TAPS; k++) {
    float u = float(k) / float(TAPS - 1) * shutter;
    vec4 pose = mix(now, prev, u);
    float zr = 1.0 + split * env;
    float zb = 1.0 - split * env;
    acc += vec3(tap(pose, aspect, zr).r, tap(pose, aspect, 1.0).g, tap(pose, aspect, zb).b);
  }
  fragColor = vec4(acc / float(TAPS), 1.0);
}
