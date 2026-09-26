import sharp from "sharp";
import path from "path";

// Hanko seal icon: vermillion square, stacked 稽古 in washi white.
// Regular icons (rounded) + maskable (full-bleed, glyph inside 80% safe zone).
const FONT = "IPAGothic";
const INK = "#B8492F";
const PAPER = "#F7F2E6";

function svg(size, { rounded, scale }) {
  const pad = rounded ? 0 : size * 0.04;
  const glyph = size * scale;
  const r = rounded ? size * 0.18 : 0;
  const center1 = size * 0.32 + pad / 2;
  const center2 = size * 0.72 + pad / 2;
  const baseline = glyph * 0.35; // approx vertical centering of CJK glyphs
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${INK}"/>
  <text x="${size / 2}" y="${center1 + baseline}" font-family="${FONT}" font-size="${glyph}" fill="${PAPER}" text-anchor="middle">稽</text>
  <text x="${size / 2}" y="${center2 + baseline}" font-family="${FONT}" font-size="${glyph}" fill="${PAPER}" text-anchor="middle">古</text>
</svg>`;
}

async function make(name, size, opts) {
  await sharp(Buffer.from(svg(size, opts)))
    .png()
    .toFile(path.join("/home/z/my-project/public", name));
  console.log("wrote", name);
}

await make("icon-512.png", 512, { rounded: true, scale: 0.34 });
await make("icon-192.png", 192, { rounded: true, scale: 0.34 });
await make("icon-maskable-512.png", 512, { rounded: false, scale: 0.3 });
await make("apple-touch-icon.png", 180, { rounded: true, scale: 0.34 });
