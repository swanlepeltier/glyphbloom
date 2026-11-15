// glyph.js — the display pass: one cell-resolution sample -> one rasterised character
import { program } from './gl.js';

export const GLYPH_FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uCell;    // rgb = colour, a = glyph index
uniform sampler2D uAtlas;
uniform vec2  uRes;
uniform vec2  uGrid;
uniform vec3  uAtlasInfo;   // cols, rows, aspect
uniform float uGain;        // per-pixel gain for bloom pickup
uniform float uInk;         // 0 = pure mask, 1 = soft phosphor edges
uniform float uDebug;       // 0 = render, 1 = cell rgb, 2 = glyph mask, 3 = indices

float glyphMask(float idx, vec2 local){
  float cols = uAtlasInfo.x, rows = uAtlasInfo.y;
  float px = mod(idx, cols);
  float py = floor(idx / cols);
  vec2 uv = (vec2(px, py) + clamp(local, 0.02, 0.98)) / vec2(cols, rows);
  return texture(uAtlas, uv).r;
}

void main(){
  vec2 p     = vec2(vUv.x * uGrid.x, (1.0 - vUv.y) * uGrid.y);   // cell space, y down
  vec2 cell  = floor(p);
  vec2 local = fract(p);
  // GL textures are bottom-up, cell space is top-down: flip the lookup row
  vec2 cellUVc = vec2((cell.x + 0.5) / uGrid.x, 1.0 - (cell.y + 0.5) / uGrid.y);
  vec4 c = texture(uCell, cellUVc);
  float idx = floor(c.a + 0.5);
  float m = glyphMask(idx, local);
  if (uDebug > 0.5 && uDebug < 1.5) { outColor = vec4(c.rgb * 6.0, 1.0); return; }
  if (uDebug > 1.5 && uDebug < 2.5) { outColor = vec4(vec3(m), 1.0); return; }
  if (uDebug > 2.5) { outColor = vec4(idx / 300.0, c.a / 300.0, c.rgb.r * 20.0, 1.0); return; }
  // a hair of intra-cell light so glyphs sit in their own glow
  float halo = uInk * 0.10;
  outColor = vec4(c.rgb * (m * uGain + halo), 1.0);
}`;

export function createGlyphPass(gl) {
  const prog = program(gl, GLYPH_FRAG, undefined, 'glyphpass');
  return {
    program: prog,
    render(cellTex, atlas, grid, res, { gain = 1, ink = 0, debug = 0 } = {}) {
      prog.use().set({
        uCell: 0,
        uAtlas: 1,
        uRes: res,
        uGrid: grid,
        uAtlasInfo: [atlas.cols, atlas.rows, 0.6],
        uGain: gain,
        uInk: ink,
        uDebug: debug
      });
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
}
