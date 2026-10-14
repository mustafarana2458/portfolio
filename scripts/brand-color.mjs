// Brand / accent colour of a site, from its screenshot (used by scripts/auto-projects.mjs).
//
// The most prominent *saturated* colour wins: pixels that are near-white, near-black or grey are
// ignored, the rest are binned by hue (weighted by saturation, so a vivid button beats a large
// washed-out area) and the heaviest bin's average is taken. Its lightness is then raised until it
// reads on the site's dark background. Nothing usable (e.g. a black-and-white site) → FALLBACK.
import sharp from "sharp";

export const FALLBACK = "#FF6B35"; // the site's orange accent
const BG = [12, 12, 14]; // --bg #0C0C0E
const MIN_CONTRAST = 5; // vs --bg; wires are drawn faint, so the base colour must be clearly bright
const MIN_SHARE = 0.004; // the winning hue must cover ≥0.4% of the (weighted) frame
const BINS = 36; // 10° hue bins

const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const lum = ([r, g, b]) => {
  const c = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Raise lightness (and keep some saturation) until the colour stands out on the dark background. */
export function forDarkBg([r, g, b]) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.max(s, 0.45);
  l = Math.max(l, 0.45);
  let rgb = hslToRgb(h, s, l);
  while (contrast(rgb, BG) < MIN_CONTRAST && l < 0.85) {
    l += 0.02;
    rgb = hslToRgb(h, s, l);
  }
  return hex(...rgb);
}

/** "#RRGGBB" for the screenshot at `path`, or FALLBACK. */
export async function brandColor(path) {
  const { data, info } = await sharp(path).resize(160, 100, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    total++;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l < 0.12 || l > 0.92 || s < 0.3) continue; // near-black, near-white, grey
    const w = s * (1 - Math.abs(l - 0.5)); // vivid mid-tones weigh most
    const bin = bins[Math.floor(h / (360 / BINS)) % BINS];
    bin.w += w;
    bin.r += r * w;
    bin.g += g * w;
    bin.b += b * w;
  }
  // Merge each bin with its neighbours so a hue split across a bin edge isn't penalised.
  let best = -1, bestW = 0;
  for (let i = 0; i < BINS; i++) {
    const w = bins[(i + BINS - 1) % BINS].w * 0.5 + bins[i].w + bins[(i + 1) % BINS].w * 0.5;
    if (w > bestW) [best, bestW] = [i, w];
  }
  if (best < 0 || bestW / total < MIN_SHARE) return FALLBACK;
  const bin = bins[best];
  if (!bin.w) return FALLBACK;
  return forDarkBg([bin.r / bin.w, bin.g / bin.w, bin.b / bin.w]);
}

/** Manual override from a repo topic like "color-2563eb" (or "color-25e"). */
export function topicColor(topics = []) {
  for (const t of topics) {
    const m = /^colou?r-([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(t);
    if (m) {
      const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
      return "#" + h.toUpperCase();
    }
  }
  return null;
}
