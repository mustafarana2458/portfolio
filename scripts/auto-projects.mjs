// Sync my public GitHub repos that have a live website into src/data/auto-projects.json, with the
// same media as the featured projects (run daily by .github/workflows/auto-projects.yml).
//
//   public/images/projects/auto/<slug>.jpg         hero screenshot (1280×800)
//   public/images/projects/auto/<slug>-2.jpg       mid-page section (project page gallery)
//   public/images/projects/auto/<slug>-poster.jpg  first video frame (card still)
//   public/videos/auto/<slug>.mp4 / .webm / -m.mp4 desktop + phone hover previews
//
// Included: every public repo of OWNER except forks, archived repos, repos with the topic
// "no-portfolio", and repos already in content.ts (same repo, slug or live URL, or site.url).
// A repo is added ONLY if it has a homepage URL that answers HTTP 200 and renders a page at
// capture time, and the capture succeeds. No homepage or a broken site: skipped, no card.
// An already-synced project keeps its last capture if its site later goes down (or a re-capture
// fails); it is dropped only when it stops qualifying above (e.g. its homepage is removed).
// A synced project is re-captured when its repo was pushed since the last capture or its homepage
// changed. Capture + encode reuse scripts/capture-sites.mjs and scripts/prepare-videos.mjs.
// The README summary is extracted, never generated: first paragraph + "Features" bullets.
//
// Safety: at most MAX entries. If the GitHub API fails nothing is written (last data stays).
// Always exits 0.
//
// Usage: node scripts/auto-projects.mjs [--force]
// Env: GITHUB_TOKEN (optional locally; raises the API rate limit).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { captureFrames, captureStills } from "./capture-sites.mjs";
import { encodeClip } from "./prepare-videos.mjs";

const OWNER = "mustafarana2458";
const OPT_OUT = "no-portfolio"; // repo topic that keeps a repo off the site
const MAX = 12;
const DATA = "src/data/auto-projects.json";
const IMG_DIR = "public/images/projects/auto";
const VID_DIR = "public/videos/auto";
const WORK = "captures/.auto"; // gitignored; prepare-videos.mjs skips it (no frames/ at this level)
const CAPTURE_TIMEOUT = 6 * 60_000;
const FORCE = process.argv.includes("--force");
const TOKEN = process.env.GITHUB_TOKEN;

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normUrl = (u) => {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return null;
  }
};
/** Repo homepage as an http(s) URL ("example.com" → "https://example.com/"), or null. */
const homepageOf = (raw) => {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
const pub = (p) => "/" + p.replace(/\\/g, "/").replace(/^public\//, ""); // file path → site path (also on Windows)
const file = (p) => join("public", p); // site path → file path

// ─── GitHub ─────────────────────────────────────────────────

async function gh(path, accept = "application/vnd.github+json") {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${OWNER}-portfolio-sync`,
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return accept.includes("raw") ? res.text() : res.json();
}

async function listRepos() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(`/users/${OWNER}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

// ─── README summary (extracted, no AI) ──────────────────────

/** Markdown inline → plain text. */
function inline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images / badges
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "") // linked badges
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1") // reference links
    .replace(/<[^>]+>/g, "") // html tags
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,:;!?]|$)/g, "$1$2")
    .replace(/:[a-z0-9_+-]+:/g, "") // emoji shortcodes
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const clip = (s, max) => (s.length <= max ? s : s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[,;:\s]+$/, "") + "…");

export function summarize(md) {
  const lines = md.replace(/\r/g, "").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  // Blank out fenced code so nothing inside it is read as prose or a list.
  let fence = false;
  const L = lines.map((l) => {
    if (/^\s*(```|~~~)/.test(l)) {
      fence = !fence;
      return "";
    }
    return fence ? "" : l;
  });
  const headingLevel = (i) => {
    const m = L[i].match(/^(#{1,6})\s+\S/);
    if (m) return m[1].length;
    if (L[i].trim() && i + 1 < L.length && /^\s*(=+|-+)\s*$/.test(L[i + 1])) return L[i + 1].includes("=") ? 1 : 2;
    return 0;
  };
  const headingText = (i) => inline(L[i].replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, ""));
  const isList = (l) => /^\s*([-*+]|\d+[.)])\s+/.test(l);
  const isRule = (l) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);

  let title = null;
  for (let i = 0; i < L.length; i++) {
    if (headingLevel(i) === 1) {
      title = headingText(i) || null;
      break;
    }
  }

  // First paragraph: consecutive prose lines (not headings, lists, tables, rules or badge rows).
  let intro = "";
  for (let i = 0; i < L.length && !intro; i++) {
    const l = L[i];
    if (!l.trim() || headingLevel(i) || /^\s*(=+|-+)\s*$/.test(l) || isList(l) || isRule(l) || /^\s*\|/.test(l)) continue;
    const para = [];
    let j = i;
    while (j < L.length && L[j].trim() && !headingLevel(j) && !isList(L[j]) && !/^\s*\|/.test(L[j]) && !isRule(L[j])) {
      para.push(L[j].replace(/^\s*>\s?/, ""));
      j++;
    }
    const text = inline(para.join(" "));
    if (text.length >= 30 && /[a-z]/i.test(text)) intro = clip(text, 480);
    i = j;
  }

  // Feature bullets: top-level list items under a "Features"-like heading.
  const features = [];
  for (let i = 0; i < L.length; i++) {
    const lvl = headingLevel(i);
    if (!lvl || !/feature|highlight|what it does|capabilit|key points/i.test(headingText(i))) continue;
    for (let j = i + 1; j < L.length && features.length < 6; j++) {
      const h = headingLevel(j);
      if (h && h <= lvl) break;
      const m = L[j].match(/^( {0,1})([-*+]|\d+[.)])\s+(.*)$/);
      if (m) {
        let text = m[3];
        // continuation lines of the same item
        while (j + 1 < L.length && /^\s{2,}\S/.test(L[j + 1]) && !isList(L[j + 1])) text += " " + L[++j].trim();
        const t = inline(text.replace(/^\[[ x]\]\s*/i, ""));
        if (t.length >= 3) features.push(clip(t, 200));
      }
    }
    if (features.length) break;
  }
  return { title, intro, features };
}

// ─── content.ts exclusions ──────────────────────────────────

function contentKeys() {
  const src = readFileSync("src/data/content.ts", "utf8");
  const all = (re) => [...src.matchAll(re)].map((m) => m[1]);
  return {
    repos: new Set(all(/\bgithub: "https:\/\/github\.com\/([^"]+?)\/?"/g).map((r) => r.toLowerCase())),
    slugs: new Set(all(/\bslug: "([^"]+)"/g)),
    // project / client live URLs, plus site.url (so this portfolio's own repo never lists itself)
    lives: new Set(all(/\b(?:live|url): "(https?:[^"]+)"/g).map(normUrl).filter(Boolean)),
  };
}

// ─── media ──────────────────────────────────────────────────

let browser = null;
const getBrowser = async () => (browser ??= await chromium.launch({ channel: "chrome" }));
async function resetBrowser() {
  await browser?.close().catch(() => {});
  browser = null;
}

function withTimeout(p, ms, what) {
  let timer;
  const t = new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms)));
  return Promise.race([p, t]).finally(() => clearTimeout(timer)); // a pending timer would keep node alive
}

/**
 * Is the site up right now? The final response (after redirects) must be HTTP 200 and the page
 * must render something visible: text, or a sizeable image / canvas / svg / video.
 */
async function probe(url) {
  const context = await (await getBrowser()).newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    if (!res) throw new Error("no response");
    if (res.status() !== 200) throw new Error(`HTTP ${res.status()}`);
    await page.waitForTimeout(2000);
    const rendered = await page.evaluate(() => {
      const b = document.body;
      if (!b || b.getBoundingClientRect().height < 50) return false;
      if (b.innerText.trim().length > 20) return true;
      return [...document.querySelectorAll("img, canvas, svg, video")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });
    });
    if (!rendered) throw new Error("page did not render");
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Screenshot + scroll-through video of the homepage. Everything is built in a staging folder and
 * only copied into public/ once all of it succeeded, so a failed re-capture never touches the
 * last good one. Returns media paths (site paths).
 */
async function captureSite(slug, homepage, title) {
  const dir = join(WORK, slug);
  const stage = join(dir, "out");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  const site = { slug, title, live: homepage };
  const b = await getBrowser();
  await captureStills(b, site, dir);
  const { frames } = await captureFrames(b, site, dir);
  if (frames < 30) throw new Error(`only ${frames} frames`);

  const files = {
    [join(IMG_DIR, `${slug}.jpg`)]: join(stage, "image.jpg"),
    [join(IMG_DIR, `${slug}-2.jpg`)]: join(stage, "section.jpg"),
    [join(IMG_DIR, `${slug}-poster.jpg`)]: join(stage, "poster.jpg"),
    [join(VID_DIR, `${slug}.mp4`)]: join(stage, "video.mp4"),
    [join(VID_DIR, `${slug}.webm`)]: join(stage, "video.webm"),
    [join(VID_DIR, `${slug}-m.mp4`)]: join(stage, "video-m.mp4"),
  };
  await sharp(join(dir, "hero.png")).jpeg({ quality: 84, mozjpeg: true }).toFile(join(stage, "image.jpg"));
  await sharp(join(dir, "section.png")).jpeg({ quality: 84, mozjpeg: true }).toFile(join(stage, "section.jpg"));
  await encodeClip({
    frames: join(dir, "frames"),
    mp4: join(stage, "video.mp4"),
    webm: join(stage, "video.webm"),
    mobile: join(stage, "video-m.mp4"),
    poster: join(stage, "poster.jpg"),
  });
  for (const src of Object.values(files)) if (!existsSync(src)) throw new Error(`missing ${src}`);
  for (const [dest, src] of Object.entries(files)) copyFileSync(src, dest);
  rmSync(dir, { recursive: true, force: true });
  return {
    image: pub(join(IMG_DIR, `${slug}.jpg`)),
    imageFit: "cover",
    video: pub(join(VID_DIR, `${slug}.mp4`)),
    poster: pub(join(IMG_DIR, `${slug}-poster.jpg`)),
    gallery: [{ src: pub(join(IMG_DIR, `${slug}-2.jpg`)), caption: "Further down the page" }],
  };
}

/** A complete capture on disk: screenshot, poster and all three videos. */
const mediaExists = (m) =>
  !!m?.image &&
  !!m.video &&
  !!m.poster &&
  [m.image, m.poster, m.video, m.video.replace(/\.mp4$/, ".webm"), m.video.replace(/\.mp4$/, "-m.mp4")].every((p) => existsSync(file(p)));

// ─── main ───────────────────────────────────────────────────

function readPrevious() {
  try {
    const d = JSON.parse(readFileSync(DATA, "utf8"));
    return Array.isArray(d.projects) ? d.projects : [];
  } catch {
    return [];
  }
}

const prettyName = (name) => name.replace(/[-_]+/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

async function main() {
  const prev = readPrevious();
  let repos;
  try {
    repos = await listRepos();
  } catch (err) {
    console.log(`✗ GitHub API failed (${err.message}); keeping the last data.`);
    return;
  }

  const keys = contentKeys();
  const skipped = [];
  const candidates = repos
    .filter((r) => !r.private && !r.fork && !r.archived && !(r.topics ?? []).includes(OPT_OUT))
    .filter((r) => {
      const home = homepageOf(r.homepage);
      if (!home) return false; // no website: never a card
      const dup = keys.repos.has(r.full_name.toLowerCase()) || keys.slugs.has(slugify(r.name)) || keys.lives.has(normUrl(home));
      if (dup) skipped.push(r.name);
      return !dup;
    })
    .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""));
  if (skipped.length) console.log(`• already in content.ts, skipped: ${skipped.join(", ")}`);
  console.log(`• ${candidates.length} public repo(s) with a homepage to check`);

  mkdirSync(IMG_DIR, { recursive: true });
  mkdirSync(VID_DIR, { recursive: true });
  const next = [];
  const seen = new Set();

  for (const r of candidates) {
    if (next.length >= MAX) break;
    const slug = slugify(r.name);
    if (!slug || seen.has(slug)) continue;
    const homepage = homepageOf(r.homepage);
    const old = prev.find((e) => e.repo === r.full_name);
    const kept = old && mediaExists(old.media) ? old : null; // a complete earlier capture

    let media = kept?.media ?? null;
    let captured = { pushedAt: kept?.capturedPushedAt ?? null, at: kept?.capturedAt ?? null, homepage: kept?.homepageCaptured ?? null };
    if (FORCE || !kept || captured.homepage !== homepage || captured.pushedAt !== r.pushed_at) {
      process.stdout.write(`• ${slug}: ${homepage}\n`);
      try {
        await withTimeout(probe(homepage), 90_000, "live check");
        media = await withTimeout(captureSite(slug, homepage, r.name), CAPTURE_TIMEOUT, "capture");
        captured = { pushedAt: r.pushed_at, at: new Date().toISOString(), homepage };
        console.log("  ✓ live, captured");
      } catch (err) {
        await resetBrowser();
        const why = err.message.split("\n")[0];
        if (!kept) {
          console.log(`  ✗ skipped (${why})`);
          continue; // never synced: no live site, no card
        }
        console.log(`  ✗ ${why}; keeping the last capture`);
      }
    }
    seen.add(slug);

    let summary = { title: null, intro: kept?.summary?.intro ?? "", features: kept?.summary?.features ?? [] };
    try {
      summary = summarize(await gh(`/repos/${r.full_name}/readme`, "application/vnd.github.raw+json"));
    } catch (err) {
      console.log(`  ${slug}: README unavailable (${err.message})`);
    }
    const title = summary.title && summary.title.length <= 48 ? summary.title : kept?.title ?? prettyName(r.name);

    next.push({
      repo: r.full_name,
      slug,
      title,
      description: (r.description ?? "").trim(),
      homepage,
      github: r.html_url,
      language: r.language ?? null,
      topics: r.topics ?? [],
      pushedAt: r.pushed_at,
      summary: { intro: summary.intro, features: summary.features },
      media,
      capturedAt: captured.at,
      capturedPushedAt: captured.pushedAt,
      homepageCaptured: captured.homepage,
    });
  }
  await resetBrowser();

  const json =
    JSON.stringify(
      { $comment: "Generated by scripts/auto-projects.mjs (GitHub Action). Do not edit; entries in content.ts win.", projects: next },
      null,
      2
    ) + "\n";
  const before = existsSync(DATA) ? readFileSync(DATA, "utf8") : "";
  if (json !== before) {
    writeFileSync(DATA, json);
    console.log(`✓ wrote ${DATA} (${next.length} project(s))`);
  } else console.log("• no data changes");

  // Then prune media no entry references any more (repo no longer qualifies, renamed or deleted).
  // Files only: build output folders (next-image-export-optimizer) and dotfiles are left alone.
  const used = new Set(
    next.flatMap((e) => {
      const m = e.media;
      const v = [m.video, m.video.replace(/\.mp4$/, ".webm"), m.video.replace(/\.mp4$/, "-m.mp4")];
      return [m.image, m.poster, ...v, ...(m.gallery ?? []).map((g) => g.src)].filter(Boolean).map(file);
    })
  );
  for (const dir of [IMG_DIR, VID_DIR]) {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isFile() && !f.name.startsWith(".") && !used.has(p)) {
        rmSync(p, { force: true });
        console.log(`• removed stale ${p}`);
      }
    }
  }
}

try {
  await main();
} catch (err) {
  // Never fail the workflow on a sync problem: whatever was written stays, the rest is untouched.
  console.log(`✗ sync aborted: ${err?.stack ?? err}`);
  await resetBrowser();
}
