// Capture Celaris (live app) from the owner's TEST workspace, showing only fictional records.
//
//   public/images/projects/celaris-{dashboard,contacts,deals,project,tasks,invoices}.png   1280×800 stills
//   captures/celaris/frames/*.jpg   ~9s: dashboard → deals pipeline → project tasks → invoices
//
// Then `npm run prepare-videos` encodes the frames (→ /videos/celaris.*, first frame = poster).
//
// Credentials: read from CELARIS_EMAIL / CELARIS_PASSWORD only. Never print or store them.
//
// Privacy guard: before EVERY still and EVERY frame, the text, form values and attributes inside
// the viewport are checked against BLOCK (records in that workspace that may be real people or
// clients), the login email, and secret-looking strings. Any hit aborts the run and the frame is
// not saved. The AI Assistant is not captured (its saved history can't be hidden without deleting it).
//
// Usage: CELARIS_EMAIL=… CELARIS_PASSWORD=… node scripts/capture-celaris.mjs
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const { CELARIS_EMAIL, CELARIS_PASSWORD } = process.env;
if (!CELARIS_EMAIL || !CELARIS_PASSWORD) throw new Error("Set CELARIS_EMAIL and CELARIS_PASSWORD");
const BASE = "https://celaris.cloud";
const DIR = "captures/celaris";
const FRAMES = join(DIR, "frames");
const STILLS = "public/images/projects";

// Records that must never appear (treated as real by the owner).
const BLOCK = ["Faryad Hussain", "ahmad_lgu", "Abdul Rehman", "Abdullah Hussain", "Asher Azmat", "Mary's Creations", "Mary’s Creations", "Bildroid", "Celaris Marketing", "Meta SEO"];
const SECRETS = [/eyJ[\w-]{10,}\.[\w-]{10,}/, /\bsk-[A-Za-z0-9_-]{16,}/, /\b(?:api[_-]?key|secret|access[_-]?token|bearer)\b\s*[:=]?\s*[\w.-]{12,}/i, /@gmail\.com/i];

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();

/** Throws (without saving anything) if the viewport shows a blocked record, the login email or a secret. */
async function guard(where) {
  const found = await page.evaluate(
    ({ block, secrets, email }) => {
      const res = secrets.map((s) => new RegExp(s.source, s.flags));
      const hits = [];
      const inView = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      };
      const test = (text, kind) => {
        if (!text) return;
        for (const b of block) if (text.toLowerCase().includes(b.toLowerCase())) hits.push(`${kind}: blocked record "${b}"`);
        if (text.toLowerCase().includes(email)) hits.push(`${kind}: login email`);
        for (const re of res) if (re.test(text)) hits.push(`${kind}: secret-like string (${re.source.slice(0, 20)}…)`);
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode()); ) if (n.parentElement && inView(n.parentElement)) test(n.textContent, "text");
      for (const el of document.querySelectorAll("input, textarea, select")) if (inView(el)) test(el.value, "field");
      for (const el of document.querySelectorAll("[title], [aria-label], [alt], [placeholder], a[href]"))
        if (inView(el)) for (const a of ["title", "aria-label", "alt", "placeholder", "href"]) test(el.getAttribute(a), `@${a}`);
      return [...new Set(hits)];
    },
    { block: BLOCK, secrets: SECRETS.map((r) => ({ source: r.source, flags: r.flags })), email: CELARIS_EMAIL.toLowerCase() }
  );
  if (found.length) throw new Error(`Privacy guard tripped at ${where}: ${found.join("; ")}. Nothing saved for this frame.`);
}

const settle = async () => {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {}); // some pages keep a live connection open
  await page.evaluate(() => document.fonts?.ready);
  // Backstop: blur the dashboard's "Recent contacts" widget (it lists records treated as real).
  await page.evaluate(() => {
    for (const h of document.querySelectorAll("h2, h3, p, div, span"))
      if (h.children.length === 0 && h.textContent.trim() === "Recent contacts") {
        let card = h;
        for (let i = 0; i < 6 && card.parentElement; i++) {
          card = card.parentElement;
          if (/rounded/.test(card.className) && card.getBoundingClientRect().height > 200) break;
        }
        card.style.filter = "blur(10px)";
      }
  });
  await page.waitForTimeout(1500); // chart intros
};

const go = async (path) => {
  await page.goto(BASE + path, { waitUntil: "load" });
  await settle();
};
// Type into a list's search box and wait until every row in view matches (retyping if the page
// was still hydrating and dropped the input).
const search = async (placeholderRe, text) => {
  const box = page.getByPlaceholder(placeholderRe).first();
  for (let attempt = 0; attempt < 4; attempt++) {
    await box.fill("");
    await box.pressSequentially(text, { delay: 30 });
    const ok = await page
      .waitForFunction(
        ({ t, block }) => {
          const body = document.querySelector("main")?.innerText.toLowerCase() ?? "";
          return !block.some((b) => body.includes(b.toLowerCase())) && document.querySelector("main input")?.value === t;
        },
        { t: text, block: BLOCK },
        { timeout: 6000 }
      )
      .then(() => true)
      .catch(() => false);
    if (ok) return page.waitForTimeout(800);
  }
  throw new Error(`search "${text}" never filtered out the blocked records`);
};
const still = async (name) => {
  await guard(`still ${name}`);
  await page.screenshot({ path: join(STILLS, `celaris-${name}.png`) });
};

// ── Log in ──
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.fill('input[name="email"]', CELARIS_EMAIL);
await page.fill('input[name="password"]', CELARIS_PASSWORD);
await Promise.all([page.waitForURL(/\/dashboard/), page.press('input[name="password"]', "Enter")]);
await settle();

// ── Find the demo project's page ──
await go("/dashboard/projects");
await search(/search by name/i, "Demo Website Rebuild");
const projectHref = await page.getByText("Demo Website Rebuild", { exact: true }).first().evaluate((el) => el.closest("a")?.getAttribute("href") ?? null);
let projectPath = projectHref;
if (!projectPath) {
  await page.getByText("Demo Website Rebuild", { exact: true }).first().click();
  await page.waitForURL((u) => u.pathname !== "/dashboard/projects");
  projectPath = new URL(page.url()).pathname;
}
console.log("demo project page:", projectPath);

// ── Stills ──
await go("/dashboard");
await still("dashboard");
await go("/dashboard/contacts");
await search(/search by name/i, "example.com"); // fictional contacts only
await still("contacts");
await go("/dashboard/deals");
await still("deals");
await go(projectPath);
await still("project");
await go("/dashboard/tasks");
await still("tasks");
await go("/dashboard/invoices");
await still("invoices");

// ── Video, one screenshot per frame ──
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
let n = 0;
const shot = async () => {
  await guard(`frame ${n}`);
  await page.screenshot({ path: join(FRAMES, `${String(n++).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
};
const hold = async (k) => {
  for (let i = 0; i < k; i++) await shot();
};
// Scroll the window (or a horizontally scrolling board) over `frames` frames, eased.
const scroll = async (to, frames, selector) => {
  const from = await page.evaluate((s) => (s ? document.querySelector(s)?.scrollLeft ?? 0 : scrollY), selector);
  for (let k = 1; k <= frames; k++) {
    const v = Math.round(from + (to - from) * easeInOutCubic(k / frames));
    await page.evaluate(([s, v]) => (s ? (document.querySelector(s).scrollLeft = v) : window.scrollTo(0, v)), [selector, v]);
    await page.waitForTimeout(30);
    await shot();
  }
};

await go("/dashboard");
await hold(36); // poster frame: dashboard top
await scroll(360, 24); // into the pipeline + revenue charts (stops well above "Recent contacts")
await hold(12);
await go("/dashboard/deals");
await hold(30);
const board = await page.evaluate(() => {
  const el = [...document.querySelectorAll("main *")].find((e) => e.scrollWidth > e.clientWidth + 40 && getComputedStyle(e).overflowX !== "visible");
  if (!el) return null;
  el.setAttribute("data-capture-board", "");
  return el.scrollWidth - el.clientWidth;
});
if (board) {
  await scroll(board, 30, "[data-capture-board]"); // across the remaining stages
  await hold(10);
}
await go(projectPath);
await hold(30);
await scroll(320, 20); // down to the task list
await hold(24);
await go("/dashboard/invoices");
await hold(42);

console.log(`✓ stills → ${STILLS}/celaris-*.png, ${n} frames (${(n / 30).toFixed(1)}s) → ${FRAMES}; privacy guard passed on every frame`);
await browser.close();
