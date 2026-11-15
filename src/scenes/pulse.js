// PULSE — a heavy bloomed LED panel specimen: dot ramp, panel mask, travelling rings
export default {
  id: 'pulse',
  title: 'PULSE',
  subtitle: 'The same organism, gone physical. Coarse cells, a five-lobe body, a dot ramp instead of letters — and a travelling ring that reads as current running through a sign.',
  tags: ['led matrix', 'dot ramp', 'travelling wave', 'heavy bloom'],
  specs: '88 × 33 CELLS · 5-LOBE SDF · APERTURE MASK',
  cell: 34,
  post: { threshold: 0.32, bloom: 1.5, exposure: 1.05, ca: 0.0012, grain: 0.03, vignette: 0.95, contrast: 1.08, mask: 0.55 },

  frag: `
float blob(vec2 p, float t){
  float sdf = 1e9;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float ang = fi * 1.2566 + sin(t * 0.38 + fi * 1.7) * 0.45;
    vec2 c = vec2(cos(ang), sin(ang)) * (0.085 + 0.040 * sin(t * 0.55 + fi));
    float rr = 0.100 + 0.020 * sin(t * 0.85 + fi * 2.1);
    sdf = smin(sdf, length(p - c) - rr, 0.075);
  }
  // breathing + heartbeat
  float beat = pow(0.5 + 0.5 * sin(t * 1.55), 6.0);
  sdf -= 0.022 * beat;
  sdf += 0.006 * sin(p.y * 26.0 + t * 2.0) * smoothstep(0.16, 0.0, length(p));
  return sdf;
}

void main(){
  vec2 uv = centerUV();
  vec2 g  = geo(uv);
  vec2 p  = g - vec2(0.80, 0.50);
  float t = uTime * 0.65;

  float sd = blob(p, t);

  vec2 e = vec2(0.006, 0.0);
  float gx = blob(p + e.xy, t) - blob(p - e.xy, t);
  float gy = blob(p + e.yx, t) - blob(p - e.yx, t);
  vec3 n = normalize(vec3(gx, gy, 0.55));

  vec3 L = normalize(vec3(-0.35, -0.70, 0.62));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);

  float inside = smoothstep(0.005, -0.005, sd);
  float shell  = smoothstep(0.018, 0.0, abs(sd));

  // current rings running out of the body
  float rings = 0.5 + 0.5 * sin(length(p) * 34.0 - t * 3.4);
  rings = smoothstep(0.55, 1.0, rings);

  float lit = inside * (0.30 + 0.85 * diff + 0.55 * spec) + shell * 0.9 + rings * inside * 0.35;
  lit *= 0.80 + 0.30 * hash12(floor(g * 240.0));

  vec3 amber = srgb(vec3(1.0, 0.52, 0.20));
  vec3 coral = srgb(vec3(1.0, 0.24, 0.24));
  vec3 cream = srgb(vec3(1.0, 0.94, 0.80));
  vec3 col = mix(coral, amber, smoothstep(0.15, 0.65, lit));
  col = mix(col, cream, smoothstep(0.70, 1.0, lit));
  col *= 0.25 + 1.9 * lit;

  outColor = vec4(col, dotIdx(clamp(lit, 0.0, 1.0)));
}
`
};
