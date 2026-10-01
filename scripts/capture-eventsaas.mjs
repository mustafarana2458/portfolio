// Capture EventSaaS (a PHP app with no public deployment) from a LOCAL run with fictional demo data.
//
//   public/images/projects/eventsaas-{dashboard,calendar,bookings,booking,halls}.png   1280×800 stills
//   captures/eventsaas/frames/*.jpg   8s click-through: dashboard → calendar → booking popup → booking page
//
// Then `npm run prepare-videos` encodes the frames like every other capture (→ /videos/eventsaas.*).
//
// Prereqs (outside this repo; see the EventSaaS section in README.md):
//   C:\projects\event_saas served at http://localhost:8080 via its local, git-excluded .local/router.php,
//   with the event_saas_demo database seeded from .local/seed_demo.sql.
//
// Usage: node scripts/capture-eventsaas.mjs
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.EVENTSAAS_URL ?? "http://localhost:8080";
const EMAIL = "admin@demo-banquet.test"; // fictional local demo account
const PASSWORD = "DemoPass2026!";
const DIR = "captures/eventsaas";
const FRAMES = join(DIR, "frames");
const STILLS = "public/images/projects";

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const settle = async () => {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(1200); // counters / chart intros
};

// Log in through the real form.
await page.goto(`${BASE}/modules/auth/login.php`);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await Promise.all([page.waitForURL(/dashboard\.php/), page.click('#loginForm [type="submit"]')]);
await settle();

// ── Stills ──
const still = async (path, name) => {
  await page.goto(`${BASE}/modules/admin/${path}`);
  await settle();
  await page.screenshot({ path: join(STILLS, `eventsaas-${name}.png`) });
};
await still("dashboard.php", "dashboard");
await still("calendar.php", "calendar");
await still("events.php", "bookings");
await still("events.php?view=7", "booking");
await still("halls.php", "halls");

// ── Click-through video, one screenshot per frame ──
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
let n = 0;
const shot = () => page.screenshot({ path: join(FRAMES, `${String(n++).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
const hold = async (k) => {
  for (let i = 0; i < k; i++) await shot();
};
const scroll = async (to, frames) => {
  const from = await page.evaluate(() => scrollY);
  for (let k = 1; k <= frames; k++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(from + (to - from) * easeInOutCubic(k / frames)));
    await page.waitForTimeout(30);
    await shot();
  }
};
// Moves the real cursor in steps (frames) so the hover states show, then clicks.
const glideClick = async (selector, frames = 14) => {
  const box = await page.locator(selector).first().boundingBox();
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const from = await page.evaluate(() => window.__cursor ?? { x: 640, y: 400 });
  for (let k = 1; k <= frames; k++) {
    const t = easeInOutCubic(k / frames);
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await shot();
  }
  await page.evaluate((p) => (window.__cursor = p), to);
};

await page.goto(`${BASE}/modules/admin/dashboard.php`);
await settle();
await hold(36); // 1.2s on the dashboard (also the poster frame)
await scroll(420, 30); // stats → upcoming bookings
await hold(12);
await scroll(0, 16);
await glideClick('.sidebar a[href$="calendar.php"], a.nav-item[href$="calendar.php"]', 12);
await Promise.all([page.waitForURL(/calendar\.php/), page.mouse.down().then(() => page.mouse.up())]);
await settle();
await hold(24);
// Open booking #7 from its calendar chip (needs event_saas ≥ c12b542, where Bootstrap loads early).
await glideClick('.ev-chip:has-text("Usman Example Weddin")', 14);
await page.mouse.down();
await page.mouse.up();
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(40); // Bootstrap modal fade-in, captured as it happens
  await shot();
}
await page.locator("#evDetailModal").waitFor({ state: "visible" });
await page.waitForTimeout(300);
await hold(30);
await glideClick("#evDetailView", 10); // "View Full"
await Promise.all([page.waitForURL(/events\.php\?view=7/), page.mouse.down().then(() => page.mouse.up())]);
await settle();
await hold(48);

console.log(`✓ stills → ${STILLS}/eventsaas-*.png, ${n} frames (${(n / 30).toFixed(1)}s) → ${FRAMES}`);
await page.screenshot({ path: join(DIR, "hero.png") });
await browser.close();
