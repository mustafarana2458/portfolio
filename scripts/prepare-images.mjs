// One-off: turn raw files in ./images into web-ready sources in ./public/images.
// next-image-export-optimizer then generates responsive WebP sizes at build time.
import sharp from "sharp";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC = "images";
const OUT = "public/images";
mkdirSync(`${OUT}/projects`, { recursive: true });

// Palette (keep in sync with src/app/globals.css)
const C = { bg: "#0C0C0E", surface: "#16161A", fg: "#F2EDE6", muted: "#8F8A83", accent: "#FF6B35" };

// ── Portrait: 4:5 crop around the subject → background removed → transparent PNG ──
const portrait = sharp(`${SRC}/Image_20260930_230604_586.jpeg`);
const { width } = await portrait.metadata();
const cropW = Math.round(width * 0.62);
const cropH = Math.round(cropW * 1.25);
const cropped = await portrait
  .extract({ left: Math.round(width * 0.18), top: Math.round(width * 0.075), width: cropW, height: cropH })
  .resize(1200, 1500)
  .png()
  .toBuffer();

const tmpIn = join(tmpdir(), "portrait-crop.png");
const tmpOut = join(tmpdir(), "portrait-cutout.png");
writeFileSync(tmpIn, cropped);
execFileSync(process.execPath, ["scripts/remove-bg.mjs", tmpIn, tmpOut], { stdio: "inherit" });
await sharp(tmpOut).png({ compressionLevel: 9 }).toFile(`${OUT}/portrait.png`);
rmSync(`${OUT}/portrait.jpg`, { force: true });
console.log("portrait cutout written");

// ── Project screenshots ──
const shots = {
  "Screenshot 2026-09-20 170104.png": "celaris",
  "Screenshot 2026-09-20 170214.png": "groovegen",
  "Screenshot 2026-09-20 170400.png": "thebe-adspot",
  "Screenshot 2026-09-20 170603.png": "pixel-mind",
  "Screenshot 2026-09-20 170753.png": "c4-cleaning",
  "Screenshot 2026-09-20 170917.png": "arden-form",
};
for (const [file, name] of Object.entries(shots)) {
  await sharp(`${SRC}/${file}`)
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(`${OUT}/projects/${name}.jpg`);
}
console.log("screenshots prepared");

// ── Live-site captures (PNG, from scripts/capture-sites.mjs or saved by hand) → optimized in place ──
const captures = readdirSync(`${OUT}/projects`).filter((f) => f.endsWith(".png"));
for (const file of captures) {
  const path = `${OUT}/projects/${file}`;
  const input = readFileSync(path);
  const out = await sharp(input).resize({ width: 1600, withoutEnlargement: true }).png({ compressionLevel: 9, effort: 10 }).toBuffer();
  writeFileSync(path, out);
  console.log(`${file}: ${Math.round(input.length / 1024)} KB → ${Math.round(out.length / 1024)} KB`);
}

// ── Open Graph card (1200×630) → public/og.png ──
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${C.bg}"/>
  <g font-family="Segoe UI, Arial, Helvetica, sans-serif">
    <text x="80" y="120" font-size="30" letter-spacing="6" fill="${C.muted}">GMR<tspan fill="${C.accent}">.</tspan></text>
    <text x="80" y="380" font-size="80" font-weight="700" letter-spacing="-2" fill="${C.fg}">Ghulam Mustafa Rana</text>
    <text x="80" y="450" font-size="42" fill="${C.fg}">Full-Stack &amp; <tspan fill="${C.accent}">AI Automation</tspan> Engineer</text>
    <text x="80" y="550" font-size="26" fill="${C.muted}">Co-Founder &amp; CTO @ Aevia · Building Celaris · Lahore, Pakistan</text>
  </g>
  <rect x="80" y="585" width="64" height="4" rx="2" fill="${C.accent}"/>
</svg>`;
await sharp(Buffer.from(og)).png().toFile("public/og.png");
console.log("og image written");

// ── Apple touch icon from the SVG favicon ──
await sharp("src/app/icon.svg", { density: 400 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
console.log("apple icon written");
