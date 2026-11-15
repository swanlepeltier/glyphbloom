// SPORE — a breathing specimen: halftone braille interior, ASCII rim, radial cilia
export default {
  id: 'spore',
  title: 'SPORE',
  subtitle: 'A specimen kept in the dark. Its body is halftoned into braille sub-pixels, its membrane is written in ASCII, and its cilia are placed by ray index rather than by noise.',
  tags: ['braille halftone', 'sdf organism', 'ascii rim', 'radial cilia'],
  specs: '2×4 SUB-PIXELS · 5-FOLD MEMBRANE · 18 RAYS',
  cell: 20,
  post: { threshold: 0.42, bloom: 1.0, exposure: 1.0, ca: 0.0009, grain: 0.022, vignette: 0.92, contrast: 1.06 },

  frag: `
float membrane(vec2 p, float t){
  float r  = length(p);
  float th = atan(p.y, p.x);
  float rr = 0.300 * (1.0 + 0.028 * sin(t * 1.05));
  rr += 0.070 * sin(th * 5.0 + t * 0.70);
  rr += 0.020 * sin(th * 11.0 - t * 1.15);
  rr += 0.038 * (fbm(vec2(cos(th), sin(th)) * 2.1 + vec2(t * 0.18, -t * 0.15), 3) - 0.45);
  return r - rr;
}

float bayer4(vec2 q){
  vec2 i = floor(mod(q, 4.0));
  float x = i.x, y = i.y;
  float b = 0.0;
  if (y < 0.5) b = (x < 0.5) ? 0.0 : 8.0;
  else if (y < 1.5) b = (x < 0.5) ? 12.0 : 4.0;
  else if (y < 2.5) b = (x < 0.5) ? 3.0 : 11.0;
  else b = (x < 0.5) ? 15.0 : 7.0;
  return (b + 0.5) / 16.0;
}

void main(){
  vec2 uv = centerUV();
  vec2 g  = geo(uv);
  vec2 p  = g - vec2(0.80, 0.50);
  float t = uTime * 0.50;

  float r  = length(p);
  float th = atan(p.y, p.x);

  float dCell = membrane(p, t);
  float outside = smoothstep(-0.006, 0.010, dCell);

  vec3 col = vec3(0.0);
  float idx = brailleIdx(0.0);

  vec2 cellG = vec2(0.6, 1.0) / uGrid.y;
  vec2 cellId = floor(uv * uGrid);

  // ---------- interior: eight halftone probes per cell ----------
  if (outside < 0.995){
    float bits = 0.0;
    float lum = 0.0;

    vec3 L = normalize(vec3(-0.42, -0.62, 0.66));
    float rrBase = max(0.02, 0.300 + 0.070 * sin(th * 5.0 + t * 0.70));

    for (int b = 0; b < 8; b++){
      vec2 bp = vec2(0.0);
      if (b == 0) bp = vec2(0.0, 0.0);
      else if (b == 1) bp = vec2(0.0, 1.0);
      else if (b == 2) bp = vec2(0.0, 2.0);
      else if (b == 3) bp = vec2(1.0, 0.0);
      else if (b == 4) bp = vec2(1.0, 1.0);
      else if (b == 5) bp = vec2(1.0, 2.0);
      else if (b == 6) bp = vec2(0.0, 3.0);
      else bp = vec2(1.0, 3.0);

      vec2 local = vec2(bp.x * 0.5 + 0.25, bp.y * 0.25 + 0.125);
      vec2 sp = p + (local - 0.5) * cellG;

      float sd = membrane(sp, t);
      float inside = smoothstep(0.003, -0.003, sd);
      float u = clamp(-sd / rrBase, 0.0, 1.0);
      float nz = sqrt(max(0.0, 1.0 - pow(1.0 - u, 2.0)));
      vec3 n = normalize(vec3(normalize(sp + 1e-5) * (1.0 - u), nz + 0.15));
      float diff = clamp(dot(n, L), 0.0, 1.0);

      float rings = 0.5 + 0.5 * sin(u * 20.0 - t * 1.3 + th * 0.6);
      float channels = 0.5 + 0.5 * sin(th * 7.0 + u * 5.0);
      float shade = 0.10 + 0.62 * diff;
      shade *= 0.86 + 0.20 * rings;
      shade *= 0.92 + 0.12 * channels;
      // nucleus
      shade += 0.14 * exp(-pow(u / 0.22, 2.0));
      shade += 0.20 * pow(1.0 - nz, 2.2);

      float on = step(bayer4(vec2(cellId.x * 2.0 + bp.x, cellId.y * 4.0 + bp.y)), shade);
      on *= inside;
      on = max(on, smoothstep(0.006, 0.0, abs(sd)));

      if (on > 0.5) bits += pow(2.0, mod(float(b), 8.0));
      lum += on * shade;
    }

    idx = brailleIdx(bits);

    float ink = clamp(lum / 8.0, 0.0, 1.0);
    vec3 cold = srgb(vec3(0.06, 0.50, 0.50));
    vec3 warm = srgb(vec3(0.50, 0.98, 0.88));
    vec3 core = srgb(vec3(0.95, 1.0, 0.99));
    col = mix(cold, warm, smoothstep(0.12, 0.62, ink));
    col = mix(col, core, smoothstep(0.80, 1.0, ink) * 0.55);
    col *= 0.50 + 0.95 * pow(ink, 0.85);
  }

  // ---------- membrane edge: ASCII contour, just outside the body ----------
  float rimBand = smoothstep(0.030, 0.004, dCell) * outside;
  if (rimBand > 0.03){
    float cidx = rampIdx(0.55 + 0.35 * fbm(p * 9.0 + t, 2));
    idx = mix(idx, cidx, step(0.30, rimBand));
    vec3 rimCol = srgb(vec3(1.0, 0.40, 0.32));
    col = mix(col, rimCol * (0.45 + 1.5 * rimBand), rimBand);
  }

  // ---------- cilia: radial rays, placed by ray index, drawn as characters ----------
  float nRay = 18.0;
  float rt   = (th / 6.2831853 + 0.5) * nRay;
  float rid  = floor(rt);
  float frac = fract(rt) - 0.5;
  float has  = step(0.55, hash11(rid * 7.13 + 1.7));
  float len  = 0.070 + 0.300 * hash11(rid * 3.71 + 0.3);
  float along = (r - 0.300) / len;
  float thin = smoothstep(0.13, 0.0, abs(frac)) * smoothstep(1.0, 0.45, along) * step(0.0, along) * has;
  idx = mix(idx, dirIdx(th), step(0.4, thin));
  col += srgb(vec3(1.0, 0.44, 0.34)) * thin * (1.0 - 0.55 * along) * 0.62;

  // ---------- dust ----------
  float dust = smoothstep(0.90, 0.985, fbm(p * 5.0 + vec2(t * 0.30, -t * 0.24), 4)) * smoothstep(0.06, 0.30, r);
  idx = mix(idx, dotIdx(0.0), step(0.5, dust) * step(0.5, thin + 0.01));
  col += srgb(vec3(0.05, 0.34, 0.34)) * dust * 0.18;

  // microscope scan line
  float scan = exp(-pow((uv.y - fract(uTime * 0.075)) / 0.045, 2.0));
  col += srgb(vec3(0.40, 1.0, 0.88)) * scan * 0.16;

  outColor = vec4(col, idx);
}
`
};
