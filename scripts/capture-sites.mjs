// Capture every project that has a live URL in src/data/content.ts, deterministically.
//
//   captures/<slug>/hero.png       1280×800, after load + fonts + intro animations
//   captures/<slug>/section.png    a mid-page section
//   captures/<slug>/frames/*.jpg   scroll-through as individual frames (not real-time recording,
//                                   so a slow machine can't drop frames)
//
// Then run `npm run prepare-videos` to turn the frames into the web MP4/WebM + poster.
// Projects with a live URL but NO image get hero/section promoted to
// public/images/projects/<name>.png and <name>-2.png.
//
// Usage: node scripts/capture-sites.mjs [slug-filter]
// Needs Google Chrome installed (Playwright drives it via channel "chrome").
import { chromium } from "playwright";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import sharp from "sharp";
import { join } from "node:path";

const VIEWPORT = { width: 1280, height: 800 }; // 16:10, the card media aspect
const INTRO_WAIT = 3000; // after load + fonts, for intro/preloader animations
const OUT = "captures";

// Frame plan: hold on the hero, ease through the page, hold at the end. 30fps → ~6.7s.
const HOLD_START = 12;
const STEPS = 180;
const HOLD_END = 8;
const SETTLE_MS = 120; // per step, for scroll-driven animations to catch up
const MAX_DISTANCE = 3600; // px scrolled over the clip (≈4.5 viewports keeps it readable)

// Per-site tweaks. `section`: absolute scrollY for the section still (default 45% of the page).
// `name`: file name used when promoting into public/images/projects.
// `interact`: for single-screen apps (nothing to scroll), a scripted demo instead of the
// scroll-through. Gets (page, shot, glide) and captures its own frames; coordinates are for 1280x800.
// `css`: injected before capturing. Arden's hero photo carries a "HIGGSFIELD" watermark in its
// bottom-right corner; enlarging the image inside the (overflow: hidden) hero pushes that corner
// out of frame, so it never appears in the frames or the poster.
const OVERRIDES = {
  // Captured from the app itself (demo workspace) by scripts/capture-celaris.mjs.
  celaris: { skip: true },
  "crease-packaging": { section: 7888, name: "crease" },
  "nutribalance-pk": { name: "nutribalance" },
  // PixelMind: drag the original/processed split, add a Gaussian Blur step, reveal it, then raise saturation.
  pixelmind: {
    interact: async (page, shot, glide) => {
      await page.waitForTimeout(3000); // filter thumbnails render after load
      for (let i = 0; i < 10; i++) await shot();
      await glide({ x: 616, y: 311 }, [380, 860, 616], 72); // split handle sweep
      await page.mouse.click(226, 460); // Library → Gaussian Blur (adds a pipeline step)
      await page.waitForTimeout(1800);
      for (let i = 0; i < 18; i++) await shot();
      await glide({ x: 616, y: 311 }, [900], 30); // reveal more of the processed side
      for (let i = 0; i < 8; i++) await shot();
      for (let k = 1; k <= 6; k++) {
        // Saturation slider, in steps (each change re-runs the pipeline)
        await page.mouse.move(1098 + (k - 1) * 22, 746);
        await page.mouse.down();
        await page.mouse.move(1098 + k * 22, 746, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(700);
        for (let i = 0; i < 4; i++) await shot();
      }
      for (let i = 0; i < 12; i++) await shot();
    },
  },
  "arden-form": { css: ".hero__image { width: 116% !important; height: 116% !important; max-width: none !important; }" },
};

// Highlight reels for sites whose story lives far down the page (pinned, scroll-synced sections).
// Each segment scrolls between two positions computed from the live DOM at 1280x800.
//   CREASE: hero box-opening (image-sequence canvas, ~2.2s), then Form, Craft, Process, Planet, Proof (~1s each).
// Chapters are joined by a quick dip to black (`dip` frames), never a crossfade: blending two
// chapters double-exposes them.
const REELS = {
  "crease-packaging": {
    dip: 3, // frames between chapters: outgoing darkened, black, incoming darkened
    holdEnd: 10,
    // pin(selector): [pin start, pin start + pinned scroll distance]; top(selector): element top
    plan: (pin, top) => [
      { name: "hero", from: 0, to: pin("#top")[1], frames: 66, hold: 4, strictChange: true },
      { name: "form", from: pin("#products")[0] + 40, to: pin("#products")[1] - 60, frames: 30 },
      { name: "craft", from: pin("#unboxing")[0] + 20, to: pin("#unboxing")[1] - 20, frames: 30, strictChange: true },
      { name: "process", from: pin("#process")[0] + 20, to: pin("#process")[1] - 40, frames: 30, strictChange: true },
      { name: "planet", from: pin("#sustainability")[0] + 20, to: pin("#sustainability")[1] - 20, frames: 30, strictChange: true },
      { name: "proof", from: top("#numbers") - 260, to: top("#clients") + 120, frames: 30 },
    ],
  },
};

// Overlays that aren't part of the sites' designs; native smooth scrolling off so each
// scrollTo lands exactly where we ask.
const HIDE_CSS = `iframe#nl-badge-frame, [id^="nl-badge"], .cursor, .cursor-dot, .cursor-follower, .cursor-ring { display: none !important; }
html, body { scroll-behavior: auto !important; }`;

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Pull { title, live, hasImage } for every project / client entry out of content.ts. */
function readProjects() {
  const src = readFileSync("src/data/content.ts", "utf8");
  return src
    .split(/\n  \{\n/)
    .slice(1)
    .map((block) => {
      const title = block.match(/\btitle: "([^"]+)"/)?.[1];
      const live = block.match(/\blive: "([^"]+)"/)?.[1];
      return title && live ? { title, slug: slugify(title), live, hasImage: /\bimage: "/.test(block) } : null;
    })
    .filter(Boolean);
}

async function open(browser, site) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(site.live, { waitUntil: "load", timeout: 90_000 });
  await page.addStyleTag({ content: HIDE_CSS + (OVERRIDES[site.slug]?.css ?? "") });
  await page.evaluate(() => document.fonts?.ready);
  await sleep(INTRO_WAIT);
  // Take smooth-scroll libraries out of the loop if the site exposes them.
  const smooth = await page.evaluate(() => {
    const w = window;
    const libs = [w.lenis, w.__lenis, w.locomotiveScroll, w.scroll].filter((l) => l && (l.destroy || l.stop));
    libs.forEach((l) => (l.destroy ? l.destroy() : l.stop()));
    document.documentElement.classList.remove("lenis", "lenis-smooth", "lenis-stopped");
    return libs.length ? "disabled" : document.documentElement.className.includes("lenis") ? "lenis (no handle)" : "none";
  });
  return { context, page, smooth };
}

const scrollTo = (page, y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);

async function captureStills(browser, site, dir) {
  const { context, page } = await open(browser, site);
  await page.screenshot({ path: join(dir, "hero.png") });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const target = Math.min(OVERRIDES[site.slug]?.section ?? Math.round(height * 0.45), height - VIEWPORT.height);
  // Walk there in steps so scroll-triggered sections play out instead of being skipped.
  for (let y = 0; y < target; y += 400) {
    await scrollTo(page, y);
    await sleep(60);
  }
  await scrollTo(page, target);
  await sleep(1500);
  await page.screenshot({ path: join(dir, "section.png") });
  await context.close();
  return { height, target };
}

async function captureFrames(browser, site, dir) {
  const framesDir = join(dir, "frames");
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const { context, page, smooth } = await open(browser, site);
  await scrollTo(page, 0);
  await sleep(300);
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const distance = Math.max(0, Math.min(maxScroll, MAX_DISTANCE));

  let n = 0;
  const shot = () => page.screenshot({ path: join(framesDir, `${String(n++).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  const interact = OVERRIDES[site.slug]?.interact;
  if (interact) {
    // Drag from `from` through each x in `xs` (same y), eased, one frame per step.
    let at = null;
    const glide = async (from, xs, frames) => {
      at = at && at.y === from.y ? at : from;
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      const per = Math.max(1, Math.round(frames / xs.length));
      for (const x of xs) {
        const x0 = at.x;
        for (let k = 1; k <= per; k++) {
          await page.mouse.move(Math.round(x0 + (x - x0) * easeInOutCubic(k / per)), from.y);
          await sleep(40);
          await shot();
        }
        at = { x, y: from.y };
      }
      await page.mouse.up();
    };
    await interact(page, shot, glide);
    await context.close();
    return { frames: n, distance: 0, smooth };
  }
  for (let i = 0; i < HOLD_START; i++) await shot();
  for (let s = 1; s <= STEPS; s++) {
    await scrollTo(page, Math.round(easeInOutCubic(s / STEPS) * distance));
    await sleep(SETTLE_MS);
    await shot();
  }
  for (let i = 0; i < HOLD_END; i++) await shot();
  await context.close();
  return { frames: n, distance, smooth };
}

/**
 * Wait until the page has really drawn the frame for the current scroll position:
 * two rAF ticks + 350ms, any <video> finished seeking, and the visible <canvas> pixels
 * stable (and, for animating segments, different from the previous captured frame).
 * Returns the canvas signature so the caller can count duplicates.
 */
const settle = (page, prevSig, strictChange) =>
  page.evaluate(
    async ({ prevSig, strictChange }) => {
      const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await raf();
      await raf();
      await wait(350);
      await Promise.all(
        [...document.querySelectorAll("video")]
          .filter((v) => v.seeking)
          .map((v) => new Promise((r) => { v.addEventListener("seeked", r, { once: true }); setTimeout(r, 1500); }))
      );
      const probe = document.createElement("canvas");
      probe.width = 48;
      probe.height = 30;
      const pctx = probe.getContext("2d", { willReadFrequently: true });
      const sig = () => {
        const visible = [...document.querySelectorAll("canvas")].filter((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 100 && r.bottom > 0 && r.top < innerHeight;
        });
        if (!visible.length) return "none";
        let acc = "";
        for (const c of visible) {
          try {
            pctx.clearRect(0, 0, 48, 30);
            pctx.drawImage(c, 0, 0, 48, 30);
            const d = pctx.getImageData(0, 0, 48, 30).data;
            let h = 0;
            for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
            acc += h.toString(36) + ".";
          } catch {
            acc += "x.";
          }
        }
        return acc;
      };
      let last = sig();
      for (let t = 0; t < 2400; t += 120) {
        await wait(120);
        const now = sig();
        const stable = now === last;
        last = now;
        if (stable && (!strictChange || now !== prevSig || now === "none")) break;
      }
      return last;
    },
    { prevSig, strictChange }
  );

/**
 * Sweep a scroll range in small steps and return every position where the visible canvas
 * actually shows a new image (with that image's signature). Sampling only at these points
 * guarantees consecutive reel frames are different while a sequence is animating.
 */
const sweepChanges = (page, from, to, step = 8) =>
  page.evaluate(
    async ({ from, to, step }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
      const p = document.createElement("canvas");
      p.width = 48;
      p.height = 30;
      const c2 = p.getContext("2d", { willReadFrequently: true });
      const sig = () =>
        [...document.querySelectorAll("canvas")]
          .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 100 && r.bottom > 0 && r.top < innerHeight; })
          .map((c) => {
            c2.clearRect(0, 0, 48, 30);
            c2.drawImage(c, 0, 0, 48, 30);
            const d = c2.getImageData(0, 0, 48, 30).data;
            let h = 0;
            for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
            return h.toString(36);
          })
          .join(".");
      const out = [];
      let last = null;
      for (let y = from; y <= to; y += step) {
        window.scrollTo({ top: y, behavior: "instant" });
        await raf();
        await raf();
        await wait(40);
        let s = sig();
        for (let k = 0; k < 8; k++) {
          await wait(60);
          const s2 = sig();
          if (s2 === s) break;
          s = s2;
        }
        if (s && s !== last) {
          out.push({ y, sig: s });
          last = s;
        }
      }
      return out;
    },
    { from, to, step }
  );

/** Wait (bounded) until the visible canvas shows the expected image signature. */
const waitForSig = (page, expected) =>
  page.evaluate(async (expected) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    const p = document.createElement("canvas");
    p.width = 48;
    p.height = 30;
    const c2 = p.getContext("2d", { willReadFrequently: true });
    const sig = () =>
      [...document.querySelectorAll("canvas")]
        .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 100 && r.bottom > 0 && r.top < innerHeight; })
        .map((c) => {
          c2.clearRect(0, 0, 48, 30);
          c2.drawImage(c, 0, 0, 48, 30);
          const d = c2.getImageData(0, 0, 48, 30).data;
          let h = 0;
          for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
          return h.toString(36);
        })
        .join(".");
    await raf();
    await raf();
    await wait(350);
    for (let t = 0; t < 2400; t += 80) {
      if (sig() === expected) return true;
      await wait(80);
    }
    return false;
  }, expected);

/** Highlight reel: chapter segments joined by dips to black, every frame confirmed drawn before the screenshot. */
async function captureReel(browser, site, dir, reel) {
  const framesDir = join(dir, "frames");
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const { context, page, smooth } = await open(browser, site);
  const geo = await page.evaluate(() => {
    const out = { pins: {}, tops: {} };
    for (const el of document.querySelectorAll("[id]")) {
      const top = Math.round(el.getBoundingClientRect().top + scrollY);
      out.tops["#" + el.id] = top;
      const spacer = el.closest(".pin-spacer") ?? el.querySelector(":scope > .pin-spacer");
      const h = spacer ? spacer.offsetHeight : el.offsetHeight;
      out.pins["#" + el.id] = [top, top + Math.max(0, h - innerHeight)];
    }
    return out;
  });
  const need = (map, sel) => {
    if (!(sel in map)) throw new Error("reel: missing " + sel);
    return map[sel];
  };
  const plan = reel.plan((sel) => need(geo.pins, sel), (sel) => need(geo.tops, sel));

  let n = 0, prevSig = null, dupes = 0;
  const path = (i) => join(framesDir, String(i).padStart(4, "0") + ".jpg");
  const shot = () => page.screenshot({ path: path(n++), type: "jpeg", quality: 92 });
  const seams = [];

  for (const [si, seg] of plan.entries()) {
    // Jump to the segment start and let it settle fully before recording it.
    await scrollTo(page, seg.from);
    await page.waitForTimeout(si === 0 ? 300 : 900);
    prevSig = await settle(page, null, false);
    if (si > 0) seams.push(n); // the dip to black goes before this frame
    if (seg.strictChange) {
      // Measure where the sequence really changes, then capture only at those points.
      const changes = await sweepChanges(page, seg.from, seg.to);
      await scrollTo(page, seg.from);
      await settle(page, null, false);
      for (let i = 0; i < (seg.hold ?? 0); i++) await shot();
      const count = Math.min(seg.frames, changes.length);
      let lastIdx = -1, misses = 0;
      for (let k = 0; k < count; k++) {
        const t = count === 1 ? 1 : k / (count - 1);
        // eased, strictly increasing index into the change points
        let idx = Math.round(easeInOutCubic(t) * (changes.length - 1));
        if (idx <= lastIdx) idx = lastIdx + 1;
        if (idx > changes.length - 1 - (count - 1 - k)) idx = changes.length - 1 - (count - 1 - k);
        lastIdx = idx;
        await scrollTo(page, changes[idx].y);
        if (!(await waitForSig(page, changes[idx].sig))) misses++;
        await shot();
      }
      if (misses) dupes += misses;
      console.log("    " + seg.name.padEnd(8) + " " + seg.from + "->" + changes.at(-1).y + "px  " + count + " frames (" + changes.length + " distinct images, " + misses + " not confirmed)");
    } else {
      for (let i = 0; i < (seg.hold ?? 0); i++) await shot();
      for (let k = 0; k < seg.frames; k++) {
        const t = seg.frames === 1 ? 1 : k / (seg.frames - 1);
        await scrollTo(page, Math.round(seg.from + (seg.to - seg.from) * easeInOutCubic(t)));
        prevSig = await settle(page, prevSig, false);
        await shot();
      }
      console.log("    " + seg.name.padEnd(8) + " " + seg.from + "->" + seg.to + "px  " + seg.frames + " frames");
    }
  }
  for (let i = 0; i < (reel.holdEnd ?? 0); i++) await shot();
  await context.close();

  // Chapter seams: rebuild the sequence with a short dip to black before each new chapter
  // (outgoing frame darkened, black, incoming frame darkened). No two chapters are ever blended.
  if (reel.dip && seams.length) {
    const tmp = join(dir, "frames-raw");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp);
    const raw = (i) => join(tmp, String(i).padStart(4, "0") + ".jpg");
    for (let i = 0; i < n; i++) copyFileSync(path(i), raw(i));
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir);
    const dark = (src, k, dst) => sharp(src).linear(k, 0).jpeg({ quality: 92 }).toFile(dst);
    let out = 0;
    for (let i = 0; i < n; i++) {
      if (seams.includes(i)) {
        const mid = Math.floor(reel.dip / 2);
        for (let b = 0; b < reel.dip; b++) {
          if (b < mid) await dark(raw(i - 1), 0.4, path(out++));
          else if (b > mid || reel.dip === 1) await dark(raw(i), 0.4, path(out++));
          else await sharp({ create: { ...VIEWPORT, channels: 3, background: "#000" } }).jpeg().toFile(path(out++));
        }
      }
      copyFileSync(raw(i), path(out++));
    }
    rmSync(tmp, { recursive: true, force: true });
    n = out;
  }
  return { frames: n, dupes, smooth };
}

const filter = process.argv[2];
const sites = readProjects().filter((s) => !filter || s.slug.includes(filter));
const browser = await chromium.launch({ channel: "chrome" });
const promoted = [];

for (const site of sites) {
  if (OVERRIDES[site.slug]?.skip) {
    console.log(`• ${site.title.padEnd(20)} skipped (has its own capture script)`);
    continue;
  }
  const dir = join(OUT, site.slug);
  mkdirSync(dir, { recursive: true });
  rmSync(join(dir, "scroll.mp4"), { force: true }); // old real-time recording
  process.stdout.write(`• ${site.title.padEnd(20)} ${site.live}\n`);
  try {
    const t0 = Date.now();
    const { height } = await captureStills(browser, site, dir);
    if (REELS[site.slug]) {
      const { frames, dupes, smooth } = await captureReel(browser, site, dir, REELS[site.slug]);
      console.log(`  ✓ reel: ${frames} frames (${(frames / 30).toFixed(1)}s), canvas frames not confirmed: ${dupes}, smooth-scroll: ${smooth} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } else {
      const { frames, distance, smooth } = await captureFrames(browser, site, dir);
      console.log(`  ✓ ${frames} frames, scrolled ${distance}px of ${height}px, smooth-scroll: ${smooth} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    if (!site.hasImage) {
      const name = OVERRIDES[site.slug]?.name ?? site.slug;
      copyFileSync(join(dir, "hero.png"), `public/images/projects/${name}.png`);
      copyFileSync(join(dir, "section.png"), `public/images/projects/${name}-2.png`);
      promoted.push(`${site.title} → /images/projects/${name}.png`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message.split("\n")[0]}`);
  }
}
await browser.close();

console.log(`\nCaptured ${sites.length} site(s) into ./${OUT}/. Next: npm run prepare-videos`);
if (promoted.length) {
  console.log("Promoted (had no image; set `image:` in content.ts, then run npm run prepare-images):");
  promoted.forEach((p) => console.log("  " + p));
}
const leftovers = existsSync(OUT) ? readdirSync(OUT).filter((d) => !sites.some((s) => s.slug === d)) : [];
if (leftovers.length && !filter) console.log("Stale capture folders:", leftovers.join(", "));
