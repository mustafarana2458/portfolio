// Sync GitHub repos tagged with the "portfolio" topic into src/data/auto-projects.json, with the
// same media as the featured projects (run daily by .github/workflows/auto-projects.yml).
//
//   public/images/projects/auto/<slug>.jpg         hero screenshot (1280×800)
//   public/images/projects/auto/<slug>-2.jpg       mid-page section (case page gallery)
//   public/images/projects/auto/<slug>-poster.jpg  first video frame (card still)
//   public/videos/auto/<slug>.mp4 / .webm / -m.mp4 desktop + phone hover previews
//   public/images/projects/auto/<slug>-og.jpg      GitHub social preview (repos without a homepage)
//
// Capture + encode reuse scripts/capture-sites.mjs and scripts/prepare-videos.mjs. A repo is
// (re)captured when it has no video yet, its homepage changed, or it was pushed since the last
// capture. The README summary is extracted, never generated: first paragraph + "Features" bullets.
//
// Safety: public repos only; repos already in content.ts (same repo, slug or live URL) are
// skipped; at most MAX entries. If the GitHub API fails nothing is written (last data stays);
// if one capture fails that project keeps its previous media. Always exits 0.
//
// Usage: node scripts/auto-projects.mjs [--force] [--no-capture]
// Env: GITHUB_TOKEN (optional locally; raises the rate limit and enables custom social previews).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { captureFrames, captureStills } from "./capture-sites.mjs";
import { encodeClip } from "./prepare-videos.mjs";

const OWNER = "mustafarana2458";
const TOPIC = "portfolio";
const MAX = 12;
const DATA = "src/data/auto-projects.json";
const IMG_DIR = "public/images/projects/auto";
const VID_DIR = "public/videos/auto";
const WORK = "captures/.auto"; // gitignored; prepare-videos.mjs skips it (no frames/ at this level)
const CAPTURE_TIMEOUT = 6 * 60_000;
const FORCE = process.argv.includes("--force");
const NO_CAPTURE = process.argv.includes("--no-capture");
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
const isHttp = (u) => {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
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

/** The repo's social preview (custom one if set). GraphQL needs a token; otherwise the generated card. */
async function socialPreviewUrl(repo) {
  if (TOKEN) {
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": `${OWNER}-portfolio-sync` },
        body: JSON.stringify({
          query: "query($o:String!,$n:String!){repository(owner:$o,name:$n){openGraphImageUrl}}",
          variables: { o: repo.owner.login, n: repo.name },
        }),
      });
      const url = (await res.json())?.data?.repository?.openGraphImageUrl;
      if (url) return url;
    } catch {}
  }
  return `https://opengraph.githubassets.com/1/${repo.full_name}`;
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
    lives: new Set(all(/\blive: "([^"]+)"/g).map(normUrl).filter(Boolean)),
  };
}

// ─── media ──────────────────────────────────────────────────

let browser = null;
const getBrowser = async () => (browser ??= await chromium.launch({ channel: "chrome" }));
async function resetBrowser() {
  await browser?.close().catch(() => {});
  browser = null;
}

const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms))]);

/** Screenshot + scroll-through video of the homepage. Returns media paths (site paths). */
async function captureSite(slug, homepage, title) {
  const dir = join(WORK, slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const site = { slug, title, live: homepage };
  const b = await getBrowser();
  await captureStills(b, site, dir);
  const { frames } = await captureFrames(b, site, dir);
  if (frames < 30) throw new Error(`only ${frames} frames`);

  const image = join(IMG_DIR, `${slug}.jpg`);
  const section = join(IMG_DIR, `${slug}-2.jpg`);
  await sharp(join(dir, "hero.png")).jpeg({ quality: 84, mozjpeg: true }).toFile(image);
  await sharp(join(dir, "section.png")).jpeg({ quality: 84, mozjpeg: true }).toFile(section);
  const out = {
    frames: join(dir, "frames"),
    mp4: join(VID_DIR, `${slug}.mp4`),
    webm: join(VID_DIR, `${slug}.webm`),
    mobile: join(VID_DIR, `${slug}-m.mp4`),
    poster: join(IMG_DIR, `${slug}-poster.jpg`),
  };
  await encodeClip(out);
  rmSync(dir, { recursive: true, force: true });
  return {
    image: pub(image),
    imageFit: "cover",
    video: pub(out.mp4),
    poster: pub(out.poster),
    gallery: [{ src: pub(section), caption: "Further down the page" }],
  };
}

async function socialPreview(repo, slug) {
  const res = await fetch(await socialPreviewUrl(repo), { headers: { "User-Agent": `${OWNER}-portfolio-sync` } });
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`social preview ${res.status}`);
  const dest = join(IMG_DIR, `${slug}-og.jpg`);
  await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1280, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toFile(dest);
  // Social previews are 2:1, not 16:10: shown whole ("contain") instead of cropped.
  return { image: pub(dest), imageFit: "contain", video: null, poster: null, gallery: [] };
}

const mediaExists = (m) => !!m?.image && existsSync(file(m.image)) && (!m.video || (existsSync(file(m.video)) && existsSync(file(m.poster))));

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
    .filter((r) => !r.private && (r.topics ?? []).includes(TOPIC))
    .filter((r) => {
      const slug = slugify(r.name);
      const home = r.homepage && isHttp(r.homepage) ? normUrl(r.homepage) : null;
      const dup = keys.repos.has(r.full_name.toLowerCase()) || keys.slugs.has(slug) || (home && keys.lives.has(home));
      if (dup) skipped.push(r.full_name);
      return !dup;
    })
    .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, MAX);
  if (skipped.length) console.log(`• already in content.ts, skipped: ${skipped.join(", ")}`);
  console.log(`• ${candidates.length} repo(s) with topic "${TOPIC}"`);

  mkdirSync(IMG_DIR, { recursive: true });
  mkdirSync(VID_DIR, { recursive: true });
  const next = [];
  const seen = new Set();

  for (const r of candidates) {
    const slug = slugify(r.name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const old = prev.find((e) => e.repo === r.full_name);
    const homepage = r.homepage && isHttp(r.homepage) ? r.homepage : null;

    let summary = old?.summary ?? { title: null, intro: "", features: [] };
    try {
      summary = summarize(await gh(`/repos/${r.full_name}/readme`, "application/vnd.github.raw+json"));
    } catch (err) {
      console.log(`  ${slug}: README unavailable (${err.message})`);
    }
    const title = summary.title && summary.title.length <= 48 ? summary.title : prettyName(r.name);

    let media = old?.media ?? null;
    let captured = { pushedAt: old?.capturedPushedAt ?? null, at: old?.capturedAt ?? null, homepage: old?.homepage ?? null };
    const pushedSince = captured.pushedAt !== r.pushed_at;
    if (homepage) {
      const need = FORCE || !media?.video || !mediaExists(media) || captured.homepage !== homepage || pushedSince;
      if (need && !NO_CAPTURE) {
        process.stdout.write(`• ${slug}: capturing ${homepage}\n`);
        try {
          media = await withTimeout(captureSite(slug, homepage, title), CAPTURE_TIMEOUT, "capture");
          captured = { pushedAt: r.pushed_at, at: new Date().toISOString(), homepage };
          console.log(`  ✓ captured`);
        } catch (err) {
          console.log(`  ✗ capture failed (${err.message.split("\n")[0]}); keeping previous media`);
          await resetBrowser();
        }
      }
    }
    // No homepage, or no usable capture: the GitHub social preview card.
    if (!homepage || !mediaExists(media)) {
      const hasOg = media && !media.video && mediaExists(media);
      if (!hasOg || pushedSince || FORCE) {
        try {
          media = await socialPreview(r, slug);
          captured = { pushedAt: r.pushed_at, at: new Date().toISOString(), homepage };
        } catch (err) {
          console.log(`  ${slug}: social preview failed (${err.message})`);
          if (!mediaExists(media)) media = null;
        }
      }
    }

    next.push({
      repo: r.full_name,
      slug,
      title,
      description: (r.description ?? "").trim(),
      homepage,
      github: r.html_url,
      language: r.language ?? null,
      topics: (r.topics ?? []).filter((t) => t !== TOPIC),
      pushedAt: r.pushed_at,
      summary: { intro: summary.intro, features: summary.features },
      media,
      capturedAt: captured.at,
      capturedPushedAt: captured.pushedAt,
      homepageCaptured: captured.homepage,
    });
  }
  await resetBrowser();

  // Prune media no entry references any more (repo untagged, renamed or deleted).
  const used = new Set(
    next.flatMap((e) => {
      const m = e.media;
      if (!m) return [];
      const v = m.video ? [m.video, m.video.replace(/\.mp4$/, ".webm"), m.video.replace(/\.mp4$/, "-m.mp4")] : [];
      return [m.image, m.poster, ...v, ...(m.gallery ?? []).map((g) => g.src)].filter(Boolean).map(file);
    })
  );
  for (const dir of [IMG_DIR, VID_DIR]) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (!used.has(p) && !f.startsWith(".")) {
        rmSync(p, { force: true });
        console.log(`• removed stale ${p}`);
      }
    }
  }

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
}

try {
  await main();
} catch (err) {
  // Never fail the workflow on a sync problem: whatever was written stays, the rest is untouched.
  console.log(`✗ sync aborted: ${err?.stack ?? err}`);
  await resetBrowser();
}
