// Open Graph card (1200×630) → public/og.png, in the site's look: the hero's wire network
// (same seeded layout as the canvas/SVG) with glowing orange nodes on the right, name, title
// and tagline on the left, in the site's own fonts.
//
// Fonts come from the production build, so run `npm run build` first. Rendered by Chrome
// (Playwright, channel "chrome", like the capture scripts) at exactly 1200×630.
//
// Usage: npm run build && npm run og-image
import { chromium } from "playwright";
import sharp from "sharp";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildNetwork, edgeControls, cubicAt } from "../src/components/pipeline/network.ts";

const W = 1200;
const H = 630;
const URL_TEXT = "mustafarana.netlify.app";
// Palette (keep in sync with src/app/globals.css)
const C = { bg: "#0C0C0E", surface: "#16161A", fg: "#F2EDE6", muted: "#8F8A83", accent: "#FF6B35" };

// ── Fonts: the latin subset of each next/font face, from the build's CSS ──
const CSS_DIR = "out/_next/static/css";
if (!existsSync(CSS_DIR)) throw new Error("No build found: run `npm run build` first (the card uses the site's fonts).");
const css = readdirSync(CSS_DIR).map((f) => readFileSync(join(CSS_DIR, f), "utf8")).join("\n");
const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
function font(family, weight) {
  const face = faces.find((f) => f.includes(`__${family}_`) && !f.includes("Fallback") && f.includes("u+00??") && (!weight || f.includes(`font-weight:${weight}`)));
  const url = face?.match(/url\((\/_next\/static\/media\/[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error(`font not found in build: ${family}`);
  return `data:font/woff2;base64,${readFileSync(join("out", url)).toString("base64")}`;
}
const fonts = {
  display: font("Space_Grotesk"),
  serif: font("Instrument_Serif"),
  mono: font("JetBrains_Mono", 500),
  body: font("Inter"),
};

// ── Network: the hero layout (1440×900 design space), covering the card, faded in from the left ──
const NW = 1440, NH = 900;
const s = Math.max(W / NW, H / NH);
const ox = (W - NW * s) / 2, oy = (H - NH * s) / 2;
const { nodes, edges } = buildNetwork(48);
const P = nodes.map((n) => ({ x: n.x * NW * s + ox, y: n.y * NH * s + oy }));
const f1 = (v) => v.toFixed(1);
// "Data flowing": a deterministic handful of edges on the right side light up, with a packet each.
const lit = new Set(
  edges
    .map((e, i) => ({ e, i }))
    .filter(({ e: [a, b] }) => P[a].x > W * 0.7 && P[b].x > W * 0.7 && P[a].y > 40 && P[b].y < H - 30)
    .filter((_, k) => k % 3 === 0)
    .map(({ i }) => i)
);
const hot = new Set([...lit].flatMap((i) => edges[i]));
const path = ([a, b]) => {
  const [c1x, c1y, c2x, c2y] = edgeControls(P[a].x, P[a].y, P[b].x, P[b].y);
  return { d: `M${f1(P[a].x)} ${f1(P[a].y)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(P[b].x)} ${f1(P[b].y)}`, c: [P[a].x, P[a].y, c1x, c1y, c2x, c2y, P[b].x, P[b].y] };
};
const labelAt = ["webhook", "LLM", "deploy"]
  .map((text, k) => {
    const cands = nodes.map((_, i) => i).filter((i) => P[i].x > W * 0.66 && P[i].x < W - 110 && P[i].y > 70 && P[i].y < H - 70);
    return { text, i: cands[Math.round(((k + 0.5) / 3) * (cands.length - 1))] };
  })
  .filter((l) => l.i !== undefined);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
    <radialGradient id="hot"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.75"/><stop offset="0.35" stop-color="${C.accent}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <g fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.2">${edges.filter((_, i) => !lit.has(i)).map((e) => `<path d="${path(e).d}"/>`).join("")}</g>
  <g fill="none" stroke="rgba(255,107,53,0.7)" stroke-width="1.6">${[...lit].map((i) => `<path d="${path(edges[i]).d}"/>`).join("")}</g>
  ${nodes.map((n, i) => `<circle cx="${f1(P[i].x)}" cy="${f1(P[i].y)}" r="${hot.has(i) ? 26 : n.big ? 18 : 11}" fill="url(#${hot.has(i) ? "hot" : "glow"})"/>`).join("")}
  ${nodes
    .map((n, i) =>
      n.big
        ? `<rect x="${f1(P[i].x - 9)}" y="${f1(P[i].y - 7)}" width="18" height="14" rx="4" fill="${C.surface}" stroke="${hot.has(i) ? C.accent : "rgba(255,255,255,0.5)"}"/>`
        : `<circle cx="${f1(P[i].x)}" cy="${f1(P[i].y)}" r="${hot.has(i) ? n.r + 1 : n.r}" fill="${hot.has(i) ? C.accent : C.surface}" stroke="${hot.has(i) ? C.accent : "rgba(255,255,255,0.45)"}"/>`
    )
    .join("")}
  ${[...lit]
    .map((i, k) => {
      const c = path(edges[i]).c, t = 0.3 + ((k * 0.37) % 0.45);
      const x = cubicAt(t, c[0], c[2], c[4], c[6]), y = cubicAt(t, c[1], c[3], c[5], c[7]);
      return `<circle cx="${f1(x)}" cy="${f1(y)}" r="18" fill="url(#hot)"/><circle cx="${f1(x)}" cy="${f1(y)}" r="3.5" fill="${C.accent}"/>`;
    })
    .join("")}
  ${labelAt.map(({ text, i }) => `<text x="${f1(P[i].x + 15)}" y="${f1(P[i].y + 4)}" font-family="OgMono" font-weight="500" font-size="13" fill="rgba(242,237,230,0.72)">${text}</text>`).join("")}
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:OgDisplay;src:url(${fonts.display}) format("woff2");font-weight:300 700}
@font-face{font-family:OgSerif;src:url(${fonts.serif}) format("woff2");font-style:italic;font-weight:400}
@font-face{font-family:OgMono;src:url(${fonts.mono}) format("woff2");font-weight:400 500}
@font-face{font-family:OgBody;src:url(${fonts.body}) format("woff2");font-weight:100 900}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${C.bg};-webkit-font-smoothing:antialiased}
.card{position:relative;width:${W}px;height:${H}px;background:${C.bg};
  background-image:radial-gradient(rgb(255 255 255 / 0.075) 1px, transparent 1.2px);background-size:24px 24px;background-position:12px 12px}
.net{position:absolute;inset:0;-webkit-mask-image:linear-gradient(to right, transparent 34%, rgba(0,0,0,0.35) 50%, #000 66%)}
.shade{position:absolute;inset:0;background:radial-gradient(ellipse 50% 72% at 24% 50%, rgb(12 12 14 / 0.9) 0%, rgb(12 12 14 / 0.6) 55%, transparent 100%)}
.copy{position:absolute;left:80px;top:0;bottom:0;width:700px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font:500 15px OgMono;letter-spacing:0.16em;text-transform:uppercase;color:${C.muted};display:flex;align-items:center;gap:12px}
.dot{width:7px;height:7px;border-radius:50%;background:#4ADE80}
h1{margin-top:26px;font:600 70px/1 OgDisplay;letter-spacing:-0.03em;color:${C.fg}}
.title{margin-top:16px;font:400 27px OgBody;color:rgb(242 237 230 / 0.86)}
.tag{margin-top:40px;font:600 40px/1.08 OgDisplay;letter-spacing:-0.03em;color:${C.fg}}
.tag em{font:italic 400 44px OgSerif;letter-spacing:-0.01em}
.url{position:absolute;left:80px;bottom:52px;display:flex;align-items:center;gap:12px;font:500 17px OgMono;color:${C.muted};letter-spacing:0.02em}
.edge{width:44px;height:2px;background:${C.accent};position:relative}
.edge::after{content:"";position:absolute;right:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:${C.accent};box-shadow:0 0 10px 3px rgb(255 107 53 / 0.55)}
.mark{position:absolute;left:80px;top:52px;font:700 22px OgDisplay;letter-spacing:-0.02em;color:${C.fg}}
.mark span{color:${C.accent}}
</style></head><body><div class="card">
  <div class="net">${svg}</div>
  <div class="shade"></div>
  <div class="mark">GMR<span>.</span></div>
  <div class="copy">
    <p class="eyebrow"><span class="dot"></span>Available for work · Lahore, Pakistan</p>
    <h1>Ghulam Mustafa Rana</h1>
    <p class="title">Full-Stack &amp; AI Automation Engineer</p>
    <p class="tag">I build software that <em>runs itself.</em></p>
  </div>
  <p class="url"><span class="edge"></span>${URL_TEXT}</p>
</div></body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const missing = await page.evaluate(() =>
  ["600 70px OgDisplay", "italic 400 44px OgSerif", "500 17px OgMono", "400 27px OgBody"].filter((f) => !document.fonts.check(f))
);
if (missing.length) throw new Error(`fonts did not load: ${missing.join(", ")}`);
const png = await page.screenshot({ type: "png" });
await browser.close();
await sharp(png).png({ compressionLevel: 9 }).toFile("public/og.png");
console.log("og image written: public/og.png (1200×630)");
