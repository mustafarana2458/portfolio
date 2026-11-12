// Capture Mustify (live app, logged in with the owner's own Spotify account).
//
//   public/images/projects/mustify-{home,playlist,search,offline}.png   1440×900 stills
//   public/images/projects/mustify-mobile.jpg                           iPhone 13 screen (390×844 @2x)
//   captures/mustify/frames/*.jpg   ~12s at 1440×900: home → playlist (+ now-playing bar) → search → Offline
//   public/videos/mustify{.mp4,.webm,-m.mp4} + public/images/posters/mustify.jpg   (encodeClip, as prepare-videos)
//
// Login: the app needs a Spotify login, which is never automated. The script opens a HEADED
// Chrome with a persistent profile in .local/mustify-profile (gitignored, outside anything that is
// committed) and waits until you have logged in yourself in that window. Later runs reuse the
// session. Nothing (tokens, cookies, profile data) is written anywhere else, printed or committed.
//
// Privacy: during capture only, a stylesheet hides the "Playing on <device>" bar text and the
// account avatar, and a scrub masks your display name / user id / device names wherever they
// appear as text or in attributes. Those strings are read from the API in the page and kept in
// memory only. Before EVERY still and EVERY frame a guard checks the viewport (text, attributes,
// form values, visible avatar images) for them, your email and secret-looking strings; any hit
// aborts the run and that frame is not saved.
//
// Playback: by default nothing is started; the now-playing bar shows whatever your account is
// already playing (or last played). --play starts the opened playlist, which plays on your ACTIVE
// Spotify device (e.g. your phone), not necessarily in this muted window.
//
// Usage: node scripts/capture-mustify.mjs [--play]
import { chromium, devices } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { encodeClip } from "./prepare-videos.mjs";

const BASE = "https://mustify-topaz.vercel.app";
const PROFILE = ".local/mustify-profile";
const DIR = "captures/mustify";
const FRAMES = join(DIR, "frames");
const STILLS = "public/images/projects";
const PLAY = process.argv.includes("--play");
const LOGIN_TIMEOUT = 20 * 60_000;
// The app's own accent preset "Lavender": the portfolio's colour for this project.
const ACCENT = "#B39DFF";
const SECRETS = [/eyJ[\w-]{10,}\.[\w-]{10,}/, /\b(?:BQ|AQ)[\w-]{40,}/, /\b(?:access|refresh)[_-]?token\b\s*[:=]/i];

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const launch = (opts) =>
  chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: false,
    // Let Chrome fetch its Widevine component so the Web Playback SDK can play in this window.
    ignoreDefaultArgs: ["--disable-component-update"],
    args: ["--mute-audio"],
    ...opts,
  });

/** Capture-only styles: hide the device bar text and account avatars. */
const PRIVACY_CSS = `
  [style*="grid-area: device"] { font-size: 0 !important; }
  [style*="grid-area: device"] svg { display: none !important; }
  [style*="grid-area: device"]::after { content: "Playing on another device"; font-size: 14px; }
  [aria-label="Account menu"] img { visibility: hidden !important; }
  [data-cap-hidden] { visibility: hidden !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

/** Pins this profile's saved appearance (the app's own setting) to Dark + Lavender before it loads. */
const accentInit = (accent) => {
  try {
    const raw = localStorage.getItem("appearance");
    const saved = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    saved.state = { ...saved.state, accent, theme: "dark", tintBackgrounds: false, bgTint: 0 };
    localStorage.setItem("appearance", JSON.stringify(saved));
  } catch {
    /* ignore */
  }
};

/** Reads the strings that must never be shown, from the API inside the page. Kept in memory only. */
async function privateStrings(page) {
  return page.evaluate(async () => {
    const auth = JSON.parse(localStorage.getItem("auth") ?? "{}").state ?? {};
    const token = auth.accessToken;
    if (!token) throw new Error("no access token in the page");
    const get = (p) => fetch(`https://api.spotify.com/v1${p}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : {}));
    const me = await get("/me");
    if (!me.id) throw new Error("could not read the profile to build the privacy mask");
    const devices = (await get("/me/player/devices")).devices ?? [];
    return {
      names: [me.display_name, me.id, ...devices.map((d) => d.name)].filter((s) => typeof s === "string" && s.trim().length >= 3 && !/^mustify/i.test(s)),
      email: me.email ?? null,
      avatars: (me.images ?? []).map((i) => i.url),
    };
  });
}

function makeTools(page, priv) {
  /** Masks private strings in text nodes (nodeValue only, so React keeps working) and attributes. */
  const scrub = () =>
    page.evaluate(({ names }) => {
      if (!document.getElementById("cap-privacy")) return;
      // The app's own author credit uses the same name: hide that line rather than show "by •••".
      for (const el of document.querySelectorAll("p, span, div, a"))
        if (el.children.length <= 1 && /^\s*designed & built by/i.test(el.textContent ?? "")) el.setAttribute("data-cap-hidden", "");
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const res = names.map((n) => new RegExp(esc(n), "gi"));
      const mask = (s) => res.reduce((acc, re) => acc.replace(re, (m) => "•".repeat(Math.min(8, m.length))), s);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode()); ) {
        const v = n.nodeValue;
        if (v && res.some((re) => (re.lastIndex = 0, re.test(v)))) n.nodeValue = mask(v);
      }
      for (const el of document.querySelectorAll("[title], [aria-label], [alt], [placeholder]"))
        for (const a of ["title", "aria-label", "alt", "placeholder"]) {
          const v = el.getAttribute(a);
          if (v && res.some((re) => (re.lastIndex = 0, re.test(v)))) el.setAttribute(a, mask(v));
        }
    }, priv);

  /** Throws (nothing saved) if the viewport still shows a private string, avatar or secret. */
  const guard = async (where) => {
    await scrub();
    const found = await page.evaluate(
      ({ names, email, avatars, secrets }) => {
        if (!document.getElementById("cap-privacy")) return ["privacy stylesheet missing"];
        const res = secrets.map((s) => new RegExp(s.source, s.flags));
        const hits = [];
        const shown = (el) => {
          const r = el.getBoundingClientRect();
          if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth)) return false;
          const cs = getComputedStyle(el);
          return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0" && cs.fontSize !== "0px";
        };
        const test = (text, kind) => {
          if (!text) return;
          const t = text.toLowerCase();
          if (names.some((n) => t.includes(n.toLowerCase()))) hits.push(`${kind}: account / device name`);
          if (email && t.includes(email.toLowerCase())) hits.push(`${kind}: email`);
          if (/@[\w-]+\.[a-z]{2,}/i.test(text)) hits.push(`${kind}: email-like string`);
          for (const re of res) if (re.test(text)) hits.push(`${kind}: secret-like string`);
        };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n; (n = walker.nextNode()); ) if (n.parentElement && shown(n.parentElement)) test(n.nodeValue, "text");
        for (const el of document.querySelectorAll("input, textarea")) if (shown(el)) test(el.value, "field");
        for (const el of document.querySelectorAll("[title], [aria-label], [alt], [placeholder]"))
          if (shown(el)) for (const a of ["title", "aria-label", "alt", "placeholder"]) test(el.getAttribute(a), `@${a}`);
        for (const img of document.querySelectorAll("img")) if (shown(img) && avatars.includes(img.currentSrc || img.src)) hits.push("avatar image");
        const bar = document.querySelector('[style*="grid-area: device"]');
        if (bar && getComputedStyle(bar).fontSize !== "0px") hits.push("device bar not hidden");
        return [...new Set(hits)];
      },
      { ...priv, secrets: SECRETS.map((r) => ({ source: r.source, flags: r.flags })) }
    );
    if (found.length) throw new Error(`Privacy guard tripped at ${where}: ${found.join("; ")}. Nothing saved for this frame.`);
  };
  return { scrub, guard };
}

const injectPrivacy = (page) =>
  page.evaluate((css) => {
    for (const i of document.querySelectorAll("input")) i.spellcheck = false; // no red squiggles in the clip
    if (document.getElementById("cap-privacy")) return;
    const s = document.createElement("style");
    s.id = "cap-privacy";
    s.textContent = css;
    document.head.append(s);
  }, PRIVACY_CSS);

const loggedIn = (page) => page.locator('[aria-label="Account menu"]').first().isVisible().catch(() => false);

/** Waits until the app shows its logged-in shell (you log in yourself in the window). */
async function waitForLogin(page) {
  if (await loggedIn(page)) return;
  console.log("\n>>> LOGIN NEEDED: log in with Spotify in the opened Chrome window. Waiting (up to 20 min)…\n");
  const end = Date.now() + LOGIN_TIMEOUT;
  while (Date.now() < end) {
    if (page.isClosed()) throw new Error("window closed before login finished");
    if (await loggedIn(page)) {
      console.log("✓ logged in");
      return;
    }
    await page.waitForTimeout(2000);
  }
  throw new Error("timed out waiting for login");
}

const settle = async (page, ms = 1500) => {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => ((i.onload = i.onerror = r), setTimeout(r, 4000))))));
  await page.waitForTimeout(ms);
};

// ───────────────────────── desktop ─────────────────────────
mkdirSync(PROFILE, { recursive: true });
let context = await launch({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(accentInit, ACCENT);
let page = context.pages()[0] ?? (await context.newPage());
await page.goto(BASE, { waitUntil: "load" });
await page.waitForTimeout(2500);
await waitForLogin(page);
await page.goto(BASE, { waitUntil: "load" }); // fresh load with the accent applied
await settle(page, 2500);

const priv = await privateStrings(page);
console.log(`• privacy: masking ${priv.names.length} account/device string(s) (not printed)`);
await injectPrivacy(page);
let { scrub, guard } = makeTools(page, priv);

// The main panel's scrolling element (the app scrolls inside it, not the window).
const markScroller = () =>
  page.evaluate(() => {
    document.querySelector("[data-cap-scroll]")?.removeAttribute("data-cap-scroll");
    const main = document.querySelector('[style*="grid-area: main"]');
    const el = [...(main?.querySelectorAll("*") ?? [])].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    el?.setAttribute("data-cap-scroll", "");
    return !!el;
  });

const still = async (name) => {
  await guard(`still ${name}`);
  await page.screenshot({ path: join(STILLS, `mustify-${name}.png`) });
  console.log(`  ✓ still ${name}`);
};

// SPA navigation (keeps the player alive): click an in-app link.
const nav = async (selector) => {
  await page.locator(selector).first().click();
  await settle(page, 1200);
  await injectPrivacy(page);
};

// Pick a playlist the account can open, from the home page.
const playlistHref = await page.evaluate(() => document.querySelector('[style*="grid-area: main"] a[href^="/playlist/"]')?.getAttribute("href") ?? document.querySelector('a[href^="/playlist/"]')?.getAttribute("href") ?? null);
if (!playlistHref) throw new Error("no playlist link found on the home page");
const playlistSel = `a[href="${playlistHref}"]`;

// ── Stills ──
await still("home");
await nav(playlistSel);
await still("playlist");
await page.goto(BASE, { waitUntil: "load" });
await settle(page, 2000);
await injectPrivacy(page);

// ── Video, one screenshot per frame ──
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
let n = 0;
const shot = async () => {
  await guard(`frame ${n}`);
  await page.screenshot({ path: join(FRAMES, `${String(n++).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
};
const hold = async (k, wait = 0) => {
  for (let i = 0; i < k; i++) {
    if (wait) await page.waitForTimeout(wait);
    await shot();
  }
};
const scroll = async (to, frames) => {
  if (!(await markScroller())) return hold(frames);
  const from = await page.evaluate(() => document.querySelector("[data-cap-scroll]").scrollTop);
  for (let k = 1; k <= frames; k++) {
    const v = Math.round(from + (to - from) * easeInOutCubic(k / frames));
    await page.evaluate((v) => {
      const el = document.querySelector("[data-cap-scroll]");
      el.style.scrollBehavior = "auto";
      el.scrollTop = v;
    }, v);
    await page.waitForTimeout(30);
    await shot();
  }
};

// 1. Home grid (poster frame), then down to the shelves.
await hold(36);
await scroll(420, 30);
await hold(14);
await scroll(0, 18);

// 2. Open a playlist and start it, so the now-playing bar is live.
await nav(playlistSel);
await hold(24);
if (PLAY) {
  const play = page.locator('[style*="grid-area: main"] button[aria-label^="Play "]').first();
  if (await play.isVisible().catch(() => false)) {
    await play.click({ force: true });
    await page.waitForTimeout(2500);
  } else console.log("  (no play button found; showing the current player state)");
}
await hold(30, 60);
await scroll(380, 24);
await hold(16, 60);

// 3. Search: type a query into the top bar.
const box = page.getByLabel("Search", { exact: true }).first();
await box.click();
await hold(4);
for (const ch of "lofi beats") {
  await box.pressSequentially(ch);
  await page.waitForTimeout(40);
  await shot();
}
await page.waitForTimeout(1500);
await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(2000);
await hold(36);
await still("search");
await box.blur();

// 4. Offline section: Downloaded, then Discover (Jamendo) and Audius.
await nav('a[href="/offline"]');
await hold(26);
for (const tab of ["Discover", "Audius"]) {
  const chip = page.getByRole("button", { name: tab, exact: true }).first();
  if (!(await chip.isVisible().catch(() => false))) continue;
  await chip.click();
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await hold(30);
  if (tab === "Audius") await still("offline");
}

console.log(`✓ ${n} frames (${(n / 30).toFixed(1)}s) → ${FRAMES}; privacy guard passed on every frame`);
await context.close();

// ───────────────────────── mobile (iPhone 13) ─────────────────────────
const { defaultBrowserType, ...iphone } = devices["iPhone 13"];
context = await launch({ ...iphone, deviceScaleFactor: 2 });
await context.addInitScript(accentInit, ACCENT);
page = context.pages()[0] ?? (await context.newPage());
await page.goto(BASE, { waitUntil: "load" });
await settle(page, 3000);
if (!(await loggedIn(page))) throw new Error("mobile: not logged in (the session should carry over from the desktop run)");
await injectPrivacy(page);
({ scrub, guard } = makeTools(page, priv));
await guard("mobile home");
const buf = await page.screenshot();
await sharp(buf).jpeg({ quality: 86, mozjpeg: true }).toFile(join(STILLS, "mustify-mobile.jpg"));
console.log("  ✓ still mobile");
await context.close();

// ───────────────────────── encode ─────────────────────────
const r = await encodeClip({
  frames: FRAMES,
  mp4: "public/videos/mustify.mp4",
  webm: "public/videos/mustify.webm",
  mobile: "public/videos/mustify-m.mp4",
  poster: "public/images/posters/mustify.jpg",
});
console.log(`✓ encoded: mp4 crf ${r.mp4Crf}, webm crf ${r.webmCrf}, mobile crf ${r.mobileCrf}`);
