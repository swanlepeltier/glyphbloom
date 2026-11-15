// VEIL — a curtain of filaments, each one a curve written in characters
export default {
  id: 'veil',
  title: 'VEIL',
  subtitle: 'Eleven filaments, each with its own frequency. Every cell asks which curve it is closest to and writes that curve\'s tangent, so the curtain reads as woven linework rather than as a field.',
  tags: ['filaments', 'tangent glyphs', 'travelling light', 'bloom'],
  specs: '11 CURVES · 2 HARMONICS · ONE LIGHT WAVE',
  cell: 15,
  post: { threshold: 0.34, bloom: 1.15, exposure: 1.1, ca: 0.0009, grain: 0.022, vignette: 0.9, contrast: 1.05 },

  frag: `
void main(){
  vec2 uv = centerUV();
  vec2 g  = geo(uv);
  float t = uTime * 0.35;

  float best = 1e9;
  float bestSlope = 0.0;
  float bestId = 0.0;

  const int N = 11;
  for (int i = 0; i < N; i++){
    float fi = float(i) / float(N);
    float k1 = 1.10 + 1.60 * fract(fi * 3.7 + 0.21);
    float k2 = 2.70 + 2.90 * fract(fi * 7.1 + 0.63);
    float ph = fi * 6.2831;

    float y  = 0.50 + 0.20 * sin(g.x * k1 + t * 0.55 + ph)
                    + 0.055 * sin(g.x * k2 - t * 0.85 + ph * 1.7)
                    + (fi - 0.5) * 0.16;
    float dy = 0.20 * k1 * cos(g.x * k1 + t * 0.55 + ph)
             + 0.055 * k2 * cos(g.x * k2 - t * 0.85 + ph * 1.7);

    float dist = abs(g.y - y) / sqrt(1.0 + dy * dy);
    if (dist < best){ best = dist; bestSlope = dy; bestId = fi; }
  }

  float thick = 0.0075 + 0.0055 * bestId;
  float line = smoothstep(thick, 0.0, best);

  // light travelling along the curtain
  float wave = 0.55 + 0.45 * sin(g.x * 3.4 - uTime * 0.9 + bestId * 9.0);
  float glow = smoothstep(0.055, 0.0, best) * 0.75;

  vec3 cold = srgb(vec3(0.12, 0.42, 0.62));
  vec3 mid  = srgb(vec3(0.16, 0.86, 0.78));
  vec3 warm = srgb(vec3(1.0, 0.52, 0.38));
  vec3 col = mix(cold, mid, smoothstep(0.0, 0.55, bestId));
  col = mix(col, warm, smoothstep(0.62, 1.0, bestId) * 0.85);
  col *= 0.30 + 2.3 * line * wave;
  col += col * glow * 0.5;

  float idx = dirIdx(atan(bestSlope, 1.0));
  idx = mix(idx, dotIdx(0.0), step(0.6, 1.0 - line) * step(0.20, best) * 0.0);

  // dust between the threads
  float dust = smoothstep(0.86, 0.98, fbm(g * 7.0 + vec2(t * 0.4, -t * 0.3), 3));
  idx = mix(idx, dotIdx(0.0), step(0.5, dust) * step(0.5, line + 0.02));
  col += mid * dust * 0.22;

  outColor = vec4(col, idx);
}
`
};
