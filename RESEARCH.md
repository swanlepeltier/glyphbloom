# The look, decoded

Notes gathered while building GLYPHBLOOM. This is the reading of the trend that
drove the design decisions, with sources at the bottom.

## 1. It has a name, and the name is not "ASCII"

The 2026 trend reports file this under **cyberbrutalism**: ASCII aesthetics,
glitch, pixel art, decoratively repurposed system UI, deliberately broken
layouts. Muzli's report is careful about it — the rawness has to be *intentional
and controlled*, "the digital equivalent of a band releasing an album with
intentional tape hiss". Tilda's 2026 list says the same thing in different words:
ASCII-inspired visuals, glitch and pixel art as "a digital-first aesthetic rooted
in early computer culture".

Two practical consequences:

- It works for developer tools, studios, music, culture. It fails for finance,
  health, enterprise — anywhere polish signals trust.
- The tell of a bad execution is randomness. The tell of a good one is a system:
  one grid, one ramp, one palette, one glow.

Adjacent vocabulary worth using when talking about it: **ditherpunk / 1-bit**,
**LED matrix**, **phosphor / CRT**, **halftone**, **dot-matrix**, **teletext**,
**blue-noise dither**.

## 2. The motion is never in the letters

Nothing in this style animates glyphs directly. What moves is a **field** —
curl noise, fbm, a metaball SDF, a reaction-diffusion — and the character grid is
just a sampler on top of it. That is why it reads as fluid and organic rather
than as a typewriter effect: the letters inherit the derivatives of a continuous
function.

Corollary: the field must be sampled *before* the glyph is chosen, which is why
every good implementation has a cell-resolution pass and a glyph-resolution pass.
Compute per pixel and braille (8 sub-dots/cell) becomes 8× the cost, and your
grid density gets coupled to your output resolution.

## 3. Anatomy of the look

| Layer | What it does | Cheap version | Good version |
|---|---|---|---|
| Field | decides where matter is | `fbm(p)` | domain-warped fbm, curl of a potential, or an SDF |
| Glyph choice | decides which character | density ramp | ramp **sorted by measured ink**, plus a 4-way direction set for flow tangents, plus braille for sub-cell pixels |
| Colour | separates materials | one hue | duotone body + one accent reserved for the hottest 2% |
| Bloom | sells the light | `filter: blur` | threshold → 6 mips → tent upsample-add, ACES, then grain |
| Frame | makes it a poster | none | index, title, one-line caption, tags, specs on one grid |

The **hybrid** is the actual signature of the trend: pixel-art core (braille,
2×4 sub-pixels per cell) inside an ASCII contour (characters on the membrane),
with the glow bleeding over both. Pure ASCII reads retro; pure pixel reads
retro; the two together read *contemporary*.

## 4. Rules that decided the difference between "noise" and "design"

Learned the hard way, in this order:

1. **Every piece needs a subject.** An all-over fbm field gets read as
   "unresolved texture" by any reviewer, however good the grain. A specimen, a
   ribbon centreline, a word, a horizon — one silhouette plus deliberate negative
   space.
2. **Cap the fill so bloom cannot eat the grid.** A fully-on braille cell is a
   solid block; at the hottest point the dots fuse and the texture dies. Keep the
   dither shade of the brightest region ≈0.75 and let colour intensity carry the
   brightness.
3. **Type needs 20+ cells per letter.** Below that the letterform dissolves into
   dashes — reviewers literally read a different word (BLOOM → "BTOOH").
4. **Fill with one steady weight, edge with the heavy one.** A single mid ramp
   glyph inside the letters plus the densest glyph on the SDF contour reads
   clean; a density-ramp or block fill turns letters into noise under bloom.
5. **Cilia and dust must be placed, not sprinkled.** Placing the tendrils by ray
   index (18 rays, length from a hash) reads intentional; thresholding noise for
   "hair" reads like stray pixels.
6. **Poster = art + typography.** The same render judged alone scored 4.5–7/10;
   with a frame, an index, a title and specs it scored 7.5–8.5/10. The UI is not
   decoration, it is what turns a shader demo into a series.

## 5. Where the style is being productised

- **ASCII Magic** (image/video → ASCII, pixel, LED matrix, halftone, dither,
  CRT, with stackable post effects: bloom, scanlines, RGB split, grain). It is a
  good checklist of what the market considers the required feature set.
- **ditherer** (open source): ASCII, halftone, CMYK, dot matrix, Braille-ish
  variants, flip-dot, teletext, CRT, VHS — the same catalogue, from the other end.
- **shaders.com** component library: ASCII stylise, dot matrix, fluid-driven
  particle dust, vorticity smoke.
- **Google Flow "Pixel Machine"** (2026): bitmap / ASCII / CRT / pixel-art
  stylisation for title treatments and transitions — the trend has reached the
  tooling layer of motion design.

What none of them do well, and what the interesting space is: **the glyph as a
material with structure** — direction glyphs carrying a flow tangent, braille
carrying 8 bits of halftone, contours of a distance field carrying legibility.
That is where a designed piece still beats a filter.

## Sources

- Muzli, *Landing Page Design Trends 2026* — cyberbrutalism, "intentional and
  controlled" rawness, narrow audience window.
  https://store.muz.li/articles/landing-page-design-trends-2026
- Tilda Education, *Web Design Trends 2026* — ASCII-inspired visuals, pixel
  fonts, anti-grid.
  https://tilda.education/en/web-design-trends-2026
- ASCII Magic — styles catalogue, LED matrix, per-character bloom, post effects.
  https://www.ascii-magic.com/styles · https://www.ascii-magic.com/llms.txt
- gyng/ditherer — gallery of ~90 render styles (ASCII, halftone, dot matrix,
  teletext, CRT, phosphor decay).
  https://github.com/gyng/ditherer/blob/master/docs/gallery/GALLERY.md
- shaders.com — ASCII stylise, dot matrix, fluid particle dust.
  https://shaders.com/docs/components
- Lumitree, *ASCII Art* — ramp density, line-height 1.0, coloured per-character
  output, fire/landscape examples.
  https://lumitree.art/blog/ascii-art
- Stream Reducer on Google Flow's 2026 artist tools (Pixel Machine: ASCII, CRT,
  bitmap, pixel art).
