import sharp from "sharp";
import path from "path";

// OG share card (1200x630): washi paper, vermillion hanko seal 稽古,
// sumi ink title. Kanji via IPAGothic, latin via Liberation Sans.
const W = 1200;
const H = 630;
const INK = "#26231E";
const INK_SOFT = "#6F6A5F";
const SEAL = "#B8492F";
const PAPER = "#F6F2E7";
const HAIR = "#D8D2C4";

function grainFilter(id) {
  return `
  <filter id="${id}">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.35 0.35 0.35 0 0"/>
    <feComposite operator="over" in2="SourceGraphic"/>
  </filter>`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${grainFilter("grain")}</defs>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>

  <!-- left content column -->
  <text x="96" y="212" font-family="IPAGothic" font-size="104" fill="${INK}" letter-spacing="14">稽古日誌</text>
  <text x="100" y="278" font-family="Liberation Sans" font-size="30" fill="${INK_SOFT}" letter-spacing="10">LOG LATIHAN TEATER</text>

  <rect x="100" y="326" width="440" height="2" fill="${SEAL}"/>

  <text x="100" y="402" font-family="Liberation Sans" font-size="34" fill="${INK}">Catat latihan hari ini — durasi, catatan, dan foto.</text>
  <text x="100" y="452" font-family="Liberation Sans" font-size="34" fill="${INK_SOFT}">Tampil rapi per pekan dan per bulan.</text>

  <text x="100" y="556" font-family="IPAGothic" font-size="26" fill="${SEAL}" letter-spacing="12">継続は力なり</text>

  <!-- hanko seal, right -->
  <g>
    <rect x="850" y="150" width="290" height="330" rx="26" fill="${SEAL}"/>
    <rect x="866" y="166" width="258" height="298" rx="16" fill="none" stroke="${PAPER}" stroke-opacity="0.35" stroke-width="3"/>
    <text x="995" y="272" font-family="IPAGothic" font-size="96" fill="${PAPER}" text-anchor="middle">稽</text>
    <text x="995" y="404" font-family="IPAGothic" font-size="96" fill="${PAPER}" text-anchor="middle">古</text>
  </g>

  <!-- hairline bottom -->
  <rect x="96" y="${H - 64}" width="${W - 192}" height="1" fill="${HAIR}"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(path.join("/home/z/my-project/public", "og-image.png"));
console.log("wrote og-image.png");
