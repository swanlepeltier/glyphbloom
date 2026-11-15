// gl.js — tiny WebGL2 helper layer (programs, render targets, uniform binding)
export const VS_QUAD = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  return gl;
}

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || '';
    const numbered = src.split('\n').map((l, i) => String(i + 1).padStart(3) + ' | ' + l).join('\n');
    const m = /0:(\d+)/.exec(log);
    const around = m ? numbered.split('\n').slice(Math.max(0, +m[1] - 6), +m[1] + 5).join('\n') : numbered;
    throw new Error(`[${label}] shader compile failed: ${log}\n${around}`);
  }
  return s;
}

export function program(gl, fsSource, vsSource = VS_QUAD, label = 'prog') {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSource, label + ':vs');
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource, label + ':fs');
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`[${label}] link failed: ${gl.getProgramInfoLog(p)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }

  return {
    program: p,
    uniforms,
    use() { gl.useProgram(p); return this; },
    set(values) {
      for (const [name, val] of Object.entries(values)) {
        const u = uniforms[name];
        if (!u || val === undefined || val === null) continue;
        switch (u.type) {
          case gl.FLOAT: gl.uniform1f(u.loc, val); break;
          case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, val); break;
          case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, val); break;
          case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, val); break;
          case gl.INT:
          case gl.BOOL:
          case gl.SAMPLER_2D: gl.uniform1i(u.loc, val); break;
          case gl.INT_VEC2: gl.uniform2iv(u.loc, val); break;
          case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, val); break;
          case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, val); break;
          default: break;
        }
      }
      return this;
    }
  };
}

export function createTarget(gl, w, h, { float = true, filter = 'linear' } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const internal = float ? gl.RGBA16F : gl.RGBA8;
  const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
  const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('incomplete FBO ' + status);
  return { tex, fbo, w, h };
}

export function resizeTarget(gl, target, w, h) {
  if (target.w === w && target.h === h) return target;
  gl.deleteTexture(target.tex);
  gl.deleteFramebuffer(target.fbo);
  const t = createTarget(gl, w, h);
  Object.assign(target, t);
  return target;
}

export function quadVAO(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

export function textureFromCanvas(gl, canvas, { nearest = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  const f = nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
