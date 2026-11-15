// words.js — rasterise a word and turn it into a signed distance texture for the morph scene
const cache = new Map();

function distanceField(mask, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : INF;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) v = Math.min(v, d[i - w] + 1);
      if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + 1.4142);
      if (x < w - 1 && y > 0) v = Math.min(v, d[i - w + 1] + 1.4142);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) v = Math.min(v, d[i + w] + 1);
      if (x < w - 1 && y < h - 1) v = Math.min(v, d[i + w + 1] + 1.4142);
      if (x > 0 && y < h - 1) v = Math.min(v, d[i + w - 1] + 1.4142);
      d[i] = v;
    }
  }
  return d;
}

export function makeWordCanvas(word, { w = 1200, h = 750, radius = 42 } = {}) {
  // 1. draw the word at a fixed size on a scratch canvas, then fit it by its *ink bbox*
  //    (canvas measureText can report 0 for a web font that has not finished loading)
  const S = 220;
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');
  sctx.font = `700 ${S}px JBM, monospace`;
  const m = sctx.measureText(word);
  scratch.width = Math.ceil(Math.max(m.width, 10) + S * 0.6);
  scratch.height = Math.ceil(S * 1.8);
  sctx.font = `700 ${S}px JBM, monospace`;
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillStyle = '#fff';
  sctx.fillText(word, scratch.width / 2, scratch.height / 2);

  const sd = sctx.getImageData(0, 0, scratch.width, scratch.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < scratch.height; y++) {
    for (let x = 0; x < scratch.width; x++) {
      if (sd[(y * scratch.width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = scratch.width - 1; y1 = scratch.height - 1; }

  // 2. composite it into the target at 84% of the width
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const scale = Math.min((w * 0.86) / bw, (h * 0.60) / bh);
  const dw = bw * scale, dh = bh * scale;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.drawImage(scratch, x0, y0, bw, bh, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();

  // 3. signed distance field, encoded 0..1 (0.5 = contour)
  const img = ctx.getImageData(0, 0, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = img.data[i * 4] > 127 ? 1 : 0;

  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
  const dIn  = distanceField(inv, w, h);   // inside pixels -> nearest outside pixel
  const dOut = distanceField(mask, w, h);  // outside pixels -> nearest inside pixel

  const out = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const s = mask[i] ? -dIn[i] : dOut[i];   // negative inside, positive outside
    const v = Math.max(0, Math.min(255, Math.round(255 * (0.5 + Math.max(-0.5, Math.min(0.5, s / (2 * radius)))))));
    out.data[i * 4] = v;
    out.data[i * 4 + 1] = v;
    out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

export function makeWordAtlas(words, opts = {}) {
  const w = opts.w || 1200, h = opts.h || 750;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h * words.length;
  const ctx = c.getContext('2d');
  words.forEach((word, i) => {
    const one = makeWordCanvas(word, { w, h, radius: opts.radius || 42 });
    ctx.drawImage(one, 0, i * h);
  });
  return c;
}

export function wordAtlasTexture(gl, words, opts = {}) {
  const canvas = makeWordAtlas(words, opts);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
