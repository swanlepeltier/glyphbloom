// main.js — app shell: atlas, cell pass, glyph pass, bloom, deterministic render API
import { createGL, program, createTarget, quadVAO } from './gl.js';
import { buildAtlas, uploadAtlas } from './atlas.js';
import { createPost, GLYPH_LIB } from './post.js';
import { createGlyphPass } from './glyph.js';
import { SCENES } from './scenes/index.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('stage');
const gl = createGL(canvas);
const quad = quadVAO(gl);

const state = {
  sceneId: qs.get('scene') || SCENES[0].id,
  time: parseFloat(qs.get('t') || '0') || 0,
  paused: qs.has('t'),
  ui: qs.get('ui') !== '0',
  dpr: Math.min(window.devicePixelRatio || 1, 2)
};

let atlas, post, glyphPass, sceneTarget, cellTarget, W = 0, H = 0, grid = [0, 0];
const built = new Map();

function sizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(canvas.clientWidth * state.dpr));
  const h = Math.max(2, Math.round(canvas.clientHeight * state.dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  W = w; H = h;
  if (sceneTarget) {
    gl.deleteTexture(sceneTarget.tex);
    gl.deleteFramebuffer(sceneTarget.fbo);
  }
  sceneTarget = createTarget(gl, W, H);
  post.resize(W, H);
}

function cellTargetFor(cols, rows) {
  if (!cellTarget || cellTarget.w !== cols || cellTarget.h !== rows) {
    if (cellTarget) { gl.deleteTexture(cellTarget.tex); gl.deleteFramebuffer(cellTarget.fbo); }
    cellTarget = createTarget(gl, cols, rows, { filter: 'nearest' });
  }
  return cellTarget;
}

function sceneOf(id) { return SCENES.find(s => s.id === id) || SCENES[0]; }

function build(scene) {
  if (built.has(scene.id)) return built.get(scene.id);
  const prog = program(gl, GLYPH_LIB + scene.frag, undefined, scene.id);
  const entry = {
    prog,
    textures: scene.textures ? scene.textures({ gl, atlas, res: [W, H] }) : []
  };
  built.set(scene.id, entry);
  return entry;
}

function gridFor(scene) {
  const cellPx = scene.cell * state.dpr;
  const rows = Math.max(6, Math.round(H / cellPx));
  const cellH = H / rows;
  const cols = Math.max(6, Math.round(W / (cellH * 0.6)));
  grid = [cols, rows];
  return { cols, rows };
}

function draw(t) {
  const scene = sceneOf(state.sceneId);
  const { cols, rows } = gridFor(scene);
  const entry = build(scene);
  const p = scene.post || {};
  const cells = cellTargetFor(cols, rows);

  const resEl = document.getElementById('res');
  const resTxt = `${W}×${H} PX · ${cols}×${rows} CELLS`;
  if (resEl && resEl.textContent !== resTxt) resEl.textContent = resTxt;

  const u = {
    uTime: t,
    uRes: [W, H],
    uGrid: [cols, rows],
    uAtlasInfo: [atlas.cols, atlas.rows, 0.6],
    uRamp: [atlas.sections.ramp.base, atlas.sections.ramp.count, 0],
    uDir: [atlas.sections.dir.base, atlas.sections.dir.count, 0],
    uDot: [atlas.sections.dot.base, atlas.sections.dot.count, 0],
    uBlock: [atlas.sections.block.base, atlas.sections.block.count, 0],
    uBraille: [atlas.sections.braille.base, atlas.sections.braille.count, 0]
  };
  if (scene.uniforms) Object.assign(u, scene.uniforms({ atlas, t, res: [W, H], grid: [cols, rows] }));

  // 1. cell pass — one invocation per character
  gl.bindFramebuffer(gl.FRAMEBUFFER, cells.fbo);
  gl.viewport(0, 0, cols, rows);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(quad);
  entry.prog.use().set(u);
  entry.textures.forEach((tex, i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  });
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // 2. glyph pass — rasterise the chosen character per cell
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.fbo);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  glyphPass.render(cells.tex, atlas, [cols, rows], [W, H], Object.assign({}, scene.ink || {}, { debug: parseFloat(qs.get('debug') || '0') }));

  // 3. bloom + finishing
  post.render(sceneTarget.tex, t, p);
  gl.bindVertexArray(null);
}

function updateLabels() {
  const scene = sceneOf(state.sceneId);
  document.getElementById('title').textContent = scene.title;
  document.getElementById('subtitle').textContent = scene.subtitle;
  document.getElementById('tags').innerHTML = scene.tags.map(t => `<span>${t}</span>`).join('');
  document.getElementById('specs').textContent = scene.specs || '';
  const n = SCENES.indexOf(scene) + 1;
  document.getElementById('idx').textContent = String(n).padStart(2, '0');
  document.querySelector('.counter .dim').textContent = '/' + String(SCENES.length).padStart(2, '0');
  document.getElementById('res').textContent = `${W}×${H} PX · ${grid[0]}×${grid[1]} CELLS`;
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.id === scene.id));
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = SCENES.map((s, i) =>
    `<button class="tab" data-id="${s.id}"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="bar"></span>${s.title}</button>`
  ).join('');
  nav.querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => setScene(el.dataset.id)));
}

function setScene(id) {
  state.sceneId = id;
  const u = new URL(location.href);
  u.searchParams.set('scene', id);
  history.replaceState(null, '', u);
  updateLabels();
}

function setUI(on) {
  state.ui = on;
  document.getElementById('ui').classList.toggle('hidden', !on);
}

let last = performance.now();
let elapsed = state.time;
let fpsAcc = 0, fpsN = 0, fpsShown = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.paused) elapsed += dt;
  draw(elapsed);
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = elapsed.toFixed(2).padStart(6, '0');
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}

function attachKeys() {
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const i = SCENES.findIndex(s => s.id === state.sceneId);
      setScene(SCENES[(i + 1) % SCENES.length].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const i = SCENES.findIndex(s => s.id === state.sceneId);
      setScene(SCENES[(i - 1 + SCENES.length) % SCENES.length].id);
    } else if (e.key === 'h' || e.key === 'H') {
      setUI(!state.ui);
    } else if (e.key === ' ') {
      e.preventDefault();
      state.paused = !state.paused;
    } else if (e.key === 's' || e.key === 'S') {
      const a = document.createElement('a');
      a.download = `glyphbloom-${state.sceneId}-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } else if (/^[1-9]$/.test(e.key)) {
      const s = SCENES[parseInt(e.key, 10) - 1];
      if (s) setScene(s.id);
    }
  });
  addEventListener('resize', () => { sizeCanvas(); updateLabels(); });
}

async function init() {
  await document.fonts.load('700 240px JBM');
  await document.fonts.ready;
  atlas = await buildAtlas({ cw: 72, ch: 120, cols: 16 });
  atlas.texture = uploadAtlas(gl, atlas);
  post = createPost(gl, quad, { levels: 6 });
  glyphPass = createGlyphPass(gl);
  sizeCanvas();
  buildTabs();
  updateLabels();
  setUI(state.ui);
  attachKeys();

  window.__render = (t) => { elapsed = t; state.paused = true; state.time = t; draw(t); };
  window.__setScene = (id) => { setScene(id); draw(elapsed); };
  window.__atlasCanvas = atlas.canvas;

  window.__info = () => ({
    scene: state.sceneId, size: [W, H], grid,
    ramp: atlas.sections.ramp.chars.join(''), fps: fpsShown
  });
  window.__ready = true;

  if (!state.paused) requestAnimationFrame(frame);
  else draw(elapsed);
}

init().catch(err => {
  console.error('INIT FAILED', err && err.stack || err);
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;left:20px;bottom:20px;color:#ff5c6e;font:11px monospace;white-space:pre-wrap;max-width:90vw">${String(err && err.message || err)}</pre>`);
});
