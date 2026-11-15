// TIDE — a ribbon of curl-noise flow, its tangent written out in characters
export default {
  id: 'tide',
  title: 'TIDE',
  subtitle: 'One current, drawn as type. A snaking centreline carries the field; every cell takes the local tangent, so the ribbon reads as a single moving body of water instead of noise.',
  tags: ['ribbon', 'flow tangents', 'curl noise', 'bloom'],
  specs: 'TANGENT BLEND · 5-OCT FBM · ONE PASS',
  cell: 22,

  post: { threshold: 0.35, bloom: 1.0, exposure: 1.2, ca: 0.0006, grain: 0.02, vignette: 0.72, contrast: 1.06 },

  frag: `
void main(){
  vec2 uv = centerUV();
  vec2 a  = geo(uv);
  float t = uTime * 0.34;

  // ---- composition: one river, a slow S-curve across the frame
  float cy  = 0.50 + 0.15 * sin(a.x * 2.15 + t * 0.45) + 0.055 * sin(a.x * 4.9 - t * 0.70);
  float dcy = 0.15 * 2.15 * cos(a.x * 2.15 + t * 0.45) + 0.055 * 4.9 * cos(a.x * 4.9 - t * 0.70);
  float dy  = a.y - cy;

  // ---- turbulence: warp the band edges so the ribbon frays
  vec2 w = vec2(fbm(a * 2.2 + vec2(0.0, t * 0.25), 3),
                fbm(a * 2.2 + vec2(5.1, -t * 0.20), 3)) - 0.5;
  float dyw = dy + w.x * 0.10 + w.y * 0.05;

  float band  = exp(-pow(abs(dyw) / 0.205, 1.7));
  float inner = exp(-pow(abs(dyw) / 0.075, 1.8));

  float grain = fbm(a * 6.5 + w * 1.8 - vec2(t * 0.5, t * 0.22), 4);
  float dens  = band * (0.45 + 0.95 * grain);
  dens *= smoothstep(0.06, 0.55, band);

  // ---- direction: curl field blended toward the ribbon tangent
  vec2 fl = curl(a * 1.9, t * 0.7) * 0.55 + vec2(1.0, dcy * 0.8) * 0.75;
  float ang = atan(fl.y, fl.x);

  float idx = dirIdx(ang);
  // sparse wakes and spray outside the core
  float wisps = smoothstep(0.62, 0.88, fbm(a * 3.4 - w * 2.2 + vec2(t * 0.6, -t * 0.3), 4)) * (1.0 - band);
  idx = mix(idx, dotIdx(0.0), step(0.55, wisps));

  vec3 deep = srgb(vec3(0.02, 0.11, 0.16));
  vec3 mid  = srgb(vec3(0.07, 0.55, 0.52));
  vec3 hot  = srgb(vec3(0.60, 1.0, 0.85));
  vec3 spark = srgb(vec3(1.0, 0.45, 0.34));

  vec3 col = mix(deep, mid, smoothstep(0.0, 0.55, band + 0.25 * grain));
  col = mix(col, hot, smoothstep(0.75, 1.0, inner + 0.25 * grain));
  col *= 0.30 + 1.55 * dens;
  col += hot * pow(inner * grain, 3.0) * 0.9;

  // sparks: the rare hot character riding the fastest water
  float sp = step(0.985, hash12(floor(uv * uGrid) + floor(uTime * 6.0))) * band;
  col = mix(col, spark, sp * 0.9);

  // wisps: dim character dust in the wake
  col += mid * wisps * 0.34;

  outColor = vec4(col, idx);
}
`
};
