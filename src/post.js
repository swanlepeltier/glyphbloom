// post.js — HDR bloom chain + display finishing (tonemap, CA, scanlines, grain, vignette)
import { program, createTarget, resizeTarget } from './gl.js';

export const GLYPH_LIB = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 outColor;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uAtlasInfo;   // cols, rows, cellAspect
uniform vec2  uGrid;        // cells across / down
uniform vec3  uRamp;        // base, count, -
uniform vec3  uDir;         // base, count ( -, \\, |, / )
uniform vec3  uDot;
uniform vec3  uBlock;
uniform vec3  uBraille;

// scene fragments run at CELL resolution: one invocation per character
vec2 cellUV(){ return vec2(gl_FragCoord.x / uGrid.x, 1.0 - gl_FragCoord.y / uGrid.y); }
vec2 centerUV(){ vec2 c = cellUV(); return (floor(c * uGrid) + 0.5) / uGrid; }

float rampIdx(float v){
  v = clamp(v, 0.0, 1.0);
  return uRamp.x + floor(v * (uRamp.y - 0.001));
}
float dirIdx(float ang){          // ang in radians, screen space (y down)
  float a = mod(ang + 3.14159265, 3.14159265);
  float seg = floor(a / (3.14159265 / 4.0) + 0.5);
  return uDir.x + mod(seg, 4.0);   // -, \\, |, /
}
float dotIdx(float v){ return uDot.x + clamp(floor(v * uDot.y), 0.0, uDot.y - 1.0); }
float blockIdx(float v){ return uBlock.x + clamp(floor(v * uBlock.y), 0.0, uBlock.y - 1.0); }
float brailleIdx(float bits){ return uBraille.x + bits; }

// geometric space: x in screen-height units, y 0..1 top-down
vec2 geo(vec2 uv){ return vec2(uv.x * uGrid.x * 0.6 / uGrid.y, uv.y); }

// ---- noise -------------------------------------------------------------
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0));
  float c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    p = rot * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}
vec2 curl(vec2 p, float t){
  float e = 0.06;
  float n1 = fbm(p + vec2(0.0, e) + t, 4), n2 = fbm(p - vec2(0.0, e) + t, 4);
  float n3 = fbm(p + vec2(e, 0.0) + t, 4), n4 = fbm(p - vec2(e, 0.0) + t, 4);
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
// cross-processing-free ACES fit
vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 srgb(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
`;

const DOWN_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
void main(){
  vec4 s = texture(uTex, vUv + uTexel * vec2(-1.0, -1.0));
  s += texture(uTex, vUv + uTexel * vec2( 1.0, -1.0));
  s += texture(uTex, vUv + uTexel * vec2(-1.0,  1.0));
  s += texture(uTex, vUv + uTexel * vec2( 1.0,  1.0));
  outColor = s * 0.25;
}`;

const UP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
void main(){
  vec4 s = texture(uTex, vUv) * 4.0;
  s += texture(uTex, vUv + vec2(uTexel.x, 0.0)) * 2.0;
  s += texture(uTex, vUv - vec2(uTexel.x, 0.0)) * 2.0;
  s += texture(uTex, vUv + vec2(0.0, uTexel.y)) * 2.0;
  s += texture(uTex, vUv - vec2(0.0, uTexel.y)) * 2.0;
  s += texture(uTex, vUv + uTexel);
  s += texture(uTex, vUv - uTexel);
  s += texture(uTex, vUv + vec2(uTexel.x, -uTexel.y));
  s += texture(uTex, vUv + vec2(-uTexel.x, uTexel.y));
  outColor = s / 16.0;
}`;

const PREFILTER_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uThreshold;
uniform float uKnee;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  outColor = vec4(c * contrib, 1.0);
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uTime;
uniform float uExposure;
uniform float uBloomAmount;
uniform float uCA;
uniform float uGrain;
uniform float uScan;
uniform float uVignette;
uniform float uMask;
uniform float uContrast;
uniform float uSaturation;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * uCA * (0.4 + r2 * 2.2);

  vec3 col;
  col.r = texture(uScene, uv + off).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - off).b;

  vec3 bl;
  bl.r = texture(uBloom, uv + off * 2.5).r;
  bl.g = texture(uBloom, uv).g;
  bl.b = texture(uBloom, uv - off * 2.5).b;

  col += bl * uBloomAmount;
  col *= uExposure;
  col = aces(col);

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);

  // aperture-grille mask (device pixel scale)
  float m = 1.0;
  float px = mod(gl_FragCoord.x, 3.0);
  m = mix(1.0, (px < 1.0 ? 0.86 : (px < 2.0 ? 1.0 : 0.92)), uMask);
  float scan = 0.5 + 0.5 * cos(gl_FragCoord.y * 3.14159265);
  col *= mix(1.0, scan, uScan) * m;

  // grain, luminance-weighted so blacks stay clean
  float g = hash12(uv * uRes + fract(uTime) * 137.0) - 0.5;
  col += g * uGrain * (0.35 + 0.65 * sqrt(max(l, 0.0)));

  col *= mix(1.0, smoothstep(1.0, 0.18, r2 * 1.55), uVignette);

  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}`;

export function createPost(gl, quad, { levels = 6 } = {}) {
  const pre = program(gl, PREFILTER_FRAG, undefined, 'prefilter');
  const down = program(gl, DOWN_FRAG, undefined, 'down');
  const up = program(gl, UP_FRAG, undefined, 'up');
  const comp = program(gl, COMPOSITE_FRAG, undefined, 'composite');

  let mips = [];
  let w = 0, h = 0;

  function resize(width, height) {
    if (width === w && height === h) return;
    w = width; h = height;
    mips.forEach(m => { gl.deleteTexture(m.tex); gl.deleteFramebuffer(m.fbo); });
    mips = [];
    let mw = Math.max(2, w >> 1), mh = Math.max(2, h >> 1);
    for (let i = 0; i < levels; i++) {
      mips.push(createTarget(gl, mw, mh));
      mw = Math.max(2, mw >> 1);
      mh = Math.max(2, mh >> 1);
    }
  }

  function draw(target, prog) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(sceneTex, time, p = {}) {
    gl.disable(gl.BLEND);
    gl.bindVertexArray(quad);

    // prefilter -> mip0
    pre.use().set({ uTex: 0, uRes: [w, h], uThreshold: p.threshold ?? 0.55, uKnee: p.knee ?? 0.35 });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    draw(mips[0], pre);

    // downsample chain
    down.use().set({ uTex: 0 });
    for (let i = 1; i < mips.length; i++) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mips[i - 1].tex);
      down.set({ uTexel: [1 / mips[i - 1].w, 1 / mips[i - 1].h] });
      draw(mips[i], down);
    }

    // upsample + additive accumulate
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    up.use().set({ uTex: 0 });
    for (let i = mips.length - 1; i > 0; i--) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mips[i].tex);
      up.set({ uTexel: [1 / mips[i].w, 1 / mips[i].h] });
      draw(mips[i - 1], up);
    }
    gl.disable(gl.BLEND);

    // composite to screen
    comp.use().set({
      uScene: 0, uBloom: 1, uRes: [w, h], uTime: time,
      uExposure: p.exposure ?? 1.0,
      uBloomAmount: p.bloom ?? 0.9,
      uCA: p.ca ?? 0.0018,
      uGrain: p.grain ?? 0.035,
      uScan: p.scan ?? 0.0,
      uVignette: p.vignette ?? 0.55,
      uMask: p.mask ?? 0.0,
      uContrast: p.contrast ?? 1.02,
      uSaturation: p.saturation ?? 1.0
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mips[0].tex);
    draw(null, comp);
  }

  return { resize, render, mips: () => mips };
}
