// atlas.js — builds the glyph atlas (typeface ramp + directional + dots + procedural braille)
import { textureFromCanvas } from './gl.js';

const RAMP_CANDIDATES = " .`',:;\"-~=+<>ilrczxvjft(){}[]/\\|!?*#%&$@BWM8";
const DIR_CHARS = ['-', '\\', '|', '/'];
const DOT_CHARS = ['·', '•', '●', '○', '◆', '■'];
const BLOCK_CHARS = ['░', '▒', '▓', '█', '▄', '▀', '▌', '▐'];

const BRAILLE_BITS = [
  [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]
];

function inkOf(ch, family, size) {
  if (ch === ' ') return 0;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  x.font = `${size}px ${family}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#fff';
  x.fillText(ch, 48, 48);
  const d = x.getImageData(0, 0, 96, 96).data;
  let ink = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
  return ink;
}

export async function buildAtlas({ cw = 72, ch = 120, cols = 16, family = 'JBM' } = {}) {
  await document.fonts.load(`400 120px ${family}`);
  await document.fonts.load(`700 120px ${family}`);
  await document.fonts.ready;

  // density-ordered ramp (measured ink, so luminance mapping is monotonic)
  const measured = RAMP_CANDIDATES.split('').map(c => ({ c, ink: inkOf(c, family, ch * 0.8) }));
  const ramp = measured.filter(m => m.ink > 0 || m.c === ' ').sort((a, b) => a.ink - b.ink).map(m => m.c);

  const sections = {};
  const index = new Map();
  let cell = 0;
  const place = (name, chars, drawFn) => {
    const base = cell;
    chars.forEach((c, i) => { index.set(c, cell + i); cell++; });
    sections[name] = { base, count: chars.length, chars, drawFn };
    return sections[name];
  };

  // draw order: font glyph sections first, braille block last (procedural)
  place('ramp', ramp);
  place('dir', DIR_CHARS);
  place('dot', DOT_CHARS);
  place('block', BLOCK_CHARS);

  const brailleChars = [];
  for (let i = 0; i < 256; i++) brailleChars.push(String.fromCharCode(0x2800 + i));
  place('braille', brailleChars);

  const rows = Math.ceil(cell / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cellXY = (i) => [ (i % cols) * cw, Math.floor(i / cols) * ch ];

  // font glyphs
  for (const name of ['ramp', 'dir', 'dot', 'block']) {
    const s = sections[name];
    ctx.font = `400 ${ch * 0.8}px ${family}`;
    s.chars.forEach((c, i) => {
      const [x, y] = cellXY(s.base + i);
      ctx.fillText(c, x + cw / 2, y + ch / 2);
    });
  }

  // braille: 2x4 procedurally drawn dots, pixel-exact and font independent
  ctx.fillStyle = '#fff';
  const s = sections.braille;
  const r = Math.min(cw * 0.135, ch * 0.072);
  for (let i = 0; i < 256; i++) {
    const [x0, y0] = cellXY(s.base + i);
    for (let b = 0; b < 8; b++) {
      if (!((i >> b) & 1)) continue;
      const [col, row] = BRAILLE_BITS[b];
      const cx = x0 + cw * (0.28 + col * 0.44);
      const cy = y0 + ch * (0.115 + row * 0.257);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    canvas, cols, rows, cellW: cw, cellH: ch, index, sections, ramp,
    size: [cols, rows],
    idx(ch) { return index.has(ch) ? index.get(ch) : 0; },
    rampIndex(v) {
      const n = sections.ramp.count;
      return sections.ramp.base + Math.min(n - 1, Math.max(0, Math.round(v * (n - 1))));
    }
  };
}

export function uploadAtlas(gl, atlas) {
  atlas.texture = textureFromCanvas(gl, atlas.canvas, { nearest: false });
  return atlas.texture;
}
