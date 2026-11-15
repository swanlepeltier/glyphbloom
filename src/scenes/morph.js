// MORPH — words assemble and dissolve cell by cell out of a noise field
import { wordAtlasTexture } from '../words.js';

const WORDS = ['MORPH', 'BLOOM', 'SPORE', 'ASCII'];
const PERIOD = 7.0;

export default {
  id: 'morph',
  title: 'MORPH',
  subtitle: 'Type as weather. Four words sit in a signed distance atlas; a noise threshold dissolves one into the other cell by cell, so the letters are always either arriving or leaving.',
  tags: ['sdf type', 'dissolve', 'cell order', 'bloom'],
  specs: '4 WORDS · NOISE THRESHOLD · SDF CONTOUR',
  cell: 11,
  post: { threshold: 0.46, bloom: 0.6, exposure: 0.95, ca: 0.0007, grain: 0.024, vignette: 0.85, contrast: 1.06 },

  textures({ gl }) {
    return [wordAtlasTexture(gl, WORDS)];
  },

  uniforms({ t }) {
    const phase = t / PERIOD;
    const i = Math.floor(phase) % WORDS.length;
    const j = (i + 1) % WORDS.length;
    const local = phase - Math.floor(phase);
    const mix = Math.min(1, Math.max(0, (local - 0.55) / 0.45));
    return {
      uWords: 0,
      uRows: WORDS.length,
      uRowA: i,
      uRowB: j,
      uMix: mix * mix * (3 - 2 * mix)
    };
  },

  frag: `
uniform sampler2D uWords;
uniform float uRows;
uniform float uRowA;
uniform float uRowB;
uniform float uMix;

void main(){
  vec2 uv = centerUV();
  vec2 g  = geo(uv);
  float t = uTime;

  vec2 wob = vec2(fbm(g * 3.2 + vec2(t * 0.13, 0.0), 3),
                  fbm(g * 3.2 + vec2(4.7, 1.3) - vec2(t * 0.11), 3)) - 0.5;
  vec2 suv = uv + wob * 0.004;

  float vy = mix(0.035, 0.965, clamp(suv.y, 0.0, 1.0));   // keep clear of atlas row seams
  float sdA = (texture(uWords, vec2(suv.x, (uRowA + vy) / uRows)).r - 0.5) * 96.0;
  float sdB = (texture(uWords, vec2(suv.x, (uRowB + vy) / uRows)).r - 0.5) * 96.0;

  float inA = smoothstep(1.4, -1.4, sdA);
  float inB = smoothstep(1.4, -1.4, sdB);

  float n = fbm(g * 5.5 + vec2(t * 0.18, -t * 0.14), 4);
  float th = uMix * 1.45 - 0.18;
  float wA = inA * smoothstep(th - 0.06, th + 0.06, n);
  float wB = inB * (1.0 - smoothstep(th - 0.06, th + 0.06, n));

  float body = wA + wB;
  float interior = 0.74 + 0.16 * fbm(g * 9.0 + vec2(t * 0.22, 0.0), 3);
  interior -= 0.10 * smoothstep(0.2, 0.9, g.y);

  // contour: the letter edge stays lit even mid-dissolve
  float edge = max(smoothstep(3.5, 0.5, abs(sdA)) * inA, smoothstep(3.5, 0.5, abs(sdB)) * inB);

  float heat = clamp(body * interior + edge * 0.30, 0.0, 1.0);
  // one steady weight carries the letterform; the contour takes the heaviest glyph
  float grain2 = hash12(floor(uv * uGrid) * 0.77);
  float idx = rampIdx(0.52 + 0.10 * grain2);
  idx = mix(idx, rampIdx(0.94), smoothstep(0.55, 0.95, edge));

  vec3 dim  = srgb(vec3(0.10, 0.46, 0.44));
  vec3 mint = srgb(vec3(0.40, 1.0, 0.80));
  vec3 white = srgb(vec3(0.94, 1.0, 0.97));
  vec3 col = mix(dim, mint, smoothstep(0.45, 0.95, heat));
  col = mix(col, white, smoothstep(0.70, 1.0, heat));
  col *= 0.22 + 0.95 * heat;

  // halo of characters around the words
  float halo = smoothstep(0.66, 0.94, fbm(g * 6.0 - vec2(t * 0.3, t * 0.1), 4)) * (1.0 - body);
  idx = mix(idx, dotIdx(0.0), step(0.55, halo));
  col += srgb(vec3(0.05, 0.34, 0.36)) * halo * 0.45;

  // sparks where the type is lifting
  float lift = body * (1.0 - body) * 4.0;
  idx = mix(idx, dotIdx(0.0), step(0.75, lift) * step(0.6, hash12(floor(uv * uGrid) + floor(t * 4.0))));
  col += srgb(vec3(1.0, 0.45, 0.35)) * lift * 0.35;

  outColor = vec4(col, idx);
}
`
};
