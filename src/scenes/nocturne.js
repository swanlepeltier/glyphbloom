// NOCTURNE — 1-bit braille dither: an ink cloud printed in eight sub-pixels per cell
export default {
  id: 'nocturne',
  title: 'NOCTURNE',
  subtitle: 'A one-bit plate. The cloud is halftoned at sub-pixel resolution against an 8×8 Bayer matrix, so eight dots per character do the work of an entire greyscale.',
  tags: ['1-bit dither', 'bayer 8×8', 'braille pixels', 'print plate'],
  specs: 'TWO INKS · 8 BITS PER CELL · NO GREYSCALE',
  cell: 16,
  post: { threshold: 0.30, bloom: 0.75, exposure: 1.0, ca: 0.0005, grain: 0.03, vignette: 0.75, contrast: 1.02, scan: 0.25 },

  frag: `
float bayer8(vec2 q){
  // 8x8 ordered dither, normalised 0..1
  vec2 i = floor(mod(q, 8.0));
  float x = i.x, y = i.y;
  float m = 0.0;
  if (y < 0.5)      m = (x<0.5)?0.0:(x<1.5)?32.0:(x<2.5)?8.0:(x<3.5)?40.0:(x<4.5)?2.0:(x<5.5)?34.0:(x<6.5)?10.0:42.0;
  else if (y < 1.5) m = (x<0.5)?48.0:(x<1.5)?16.0:(x<2.5)?56.0:(x<3.5)?24.0:(x<4.5)?50.0:(x<5.5)?18.0:(x<6.5)?58.0:26.0;
  else if (y < 2.5) m = (x<0.5)?12.0:(x<1.5)?44.0:(x<2.5)?4.0:(x<3.5)?36.0:(x<4.5)?14.0:(x<5.5)?46.0:(x<6.5)?6.0:38.0;
  else if (y < 3.5) m = (x<0.5)?60.0:(x<1.5)?28.0:(x<2.5)?52.0:(x<3.5)?20.0:(x<4.5)?62.0:(x<5.5)?30.0:(x<6.5)?54.0:22.0;
  else if (y < 4.5) m = (x<0.5)?3.0:(x<1.5)?35.0:(x<2.5)?11.0:(x<3.5)?43.0:(x<4.5)?1.0:(x<5.5)?33.0:(x<6.5)?9.0:41.0;
  else if (y < 5.5) m = (x<0.5)?51.0:(x<1.5)?19.0:(x<2.5)?59.0:(x<3.5)?27.0:(x<4.5)?49.0:(x<5.5)?17.0:(x<6.5)?57.0:25.0;
  else if (y < 6.5) m = (x<0.5)?15.0:(x<1.5)?47.0:(x<2.5)?7.0:(x<3.5)?39.0:(x<4.5)?13.0:(x<5.5)?45.0:(x<6.5)?5.0:37.0;
  else              m = (x<0.5)?63.0:(x<1.5)?31.0:(x<2.5)?55.0:(x<3.5)?23.0:(x<4.5)?61.0:(x<5.5)?29.0:(x<6.5)?53.0:21.0;
  return (m + 0.5) / 64.0;
}

float cloud(vec2 p, float t){
  vec2 w = vec2(fbm(p * 1.2 + vec2(0.0, t * 0.10), 4),
                fbm(p * 1.2 + vec2(6.4, -t * 0.08), 4)) - 0.5;
  vec2 q = p * 1.6 + w * 1.7;
  float f  = fbm(q + vec2(t * 0.05, 0.0), 5);
  f += 0.35 * fbm(q * 2.6 - w * 1.2, 4);
  f = f / 1.35;
  // fold it into one big mass with a luminous rim
  float mass = smoothstep(0.40, 0.74, f);
  float edge = smoothstep(0.44, 0.54, f) * smoothstep(0.74, 0.58, f);
  float d = length((p - vec2(0.02, 0.0)) * vec2(0.85, 1.25));
  float fall = smoothstep(0.62, 0.06, d);
  return clamp((mass * 0.9 + edge * 0.45) * (0.06 + 0.94 * fall), 0.0, 1.0);
}

void main(){
  vec2 uv = centerUV();
  vec2 g  = geo(uv);
  vec2 p  = g - vec2(0.80, 0.50);
  float t = uTime * 0.30;

  vec2 cellG = vec2(0.6, 1.0) / uGrid.y;
  vec2 cellId = floor(uv * uGrid);

  float bits = 0.0;
  float top = 0.0;

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

    float f = cloud(sp, t);
    vec2 px = vec2(cellId.x * 2.0 + bp.x, cellId.y * 4.0 + bp.y);
    float on = step(bayer8(px), f);
    if (on > 0.5) bits += pow(2.0, mod(float(b), 8.0));
    top = max(top, f * on);
  }

  // two inks: bone paper and a cold accent for the densest cores
  vec3 paper  = srgb(vec3(0.86, 0.82, 0.72));
  vec3 accent = srgb(vec3(0.35, 0.72, 1.0));
  vec3 col = mix(paper, accent, smoothstep(0.86, 1.0, top));
  col *= 0.72 + 0.55 * top;

  outColor = vec4(col, brailleIdx(bits));
}
`
};
