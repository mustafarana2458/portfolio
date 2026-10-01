// TEMPORARY scroll profiler (delete after use). Same settings as the smoothness work:
//   mobile: 390x844 @3x, touch, 4x CPU throttle, raw touch swipes with fling
//   desktop: 1440x900, 1x CPU, compositor wheel gesture (Lenis on)
// Usage: node scripts/.perf.mjs <mobile|desktop> <label>
import { chromium } from "playwright";

const [MODE = "mobile", LABEL = MODE] = process.argv.slice(2);
const DESKTOP = MODE === "desktop";
const b = await chromium.launch({ channel: "chrome", args: ["--enable-gpu-rasterization"] });
const ctx = await b.newContext(
  DESKTOP
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
    : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: DESKTOP ? 1 : 4 });
await page.goto(process.env.PERF_URL ?? "http://localhost:4322/", { waitUntil: "load" });
if (process.env.PERF_CSS) await page.addStyleTag({ content: process.env.PERF_CSS });
await page.waitForTimeout(4000);
await page.evaluate(() => {
  const w = window;
  w.__frames = [];
  let last = performance.now();
  const loop = (t) => {
    w.__frames.push(t - last); // timestamps only (no layout reads)
    last = t;
    if (!w.__stop) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const t0 = Date.now();
const swipe = async () => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 700 }] });
  for (let k = 1; k <= 12; k++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: 700 - 40 * k }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 450));
};
let y = 0;
while (y < H - 5 && Date.now() - t0 < 150000) {
  if (DESKTOP)
    await cdp.send("Input.synthesizeScrollGesture", { x: 700, y: 450, yDistance: -1600, speed: 1500, gestureSourceType: "mouse", preventFling: true });
  else await swipe();
  y = await page.evaluate(() => scrollY);
}
await page.evaluate(() => (window.__stop = true));
const ft = (await page.evaluate(() => window.__frames)).slice(5);
const fps = (1000 * ft.length) / ft.reduce((s, v) => s + v, 0);
const sorted = [...ft].sort((a, c) => a - c);
console.log(
  `${LABEL.padEnd(16)} reached ${Math.round(y)}/${Math.round(H)}  fps ${fps.toFixed(1)}  on-time ${((100 * ft.filter((v) => v <= 20).length) / ft.length).toFixed(1)}%  p95 ${sorted[Math.floor(0.95 * (sorted.length - 1))].toFixed(1)}ms`
);
await b.close();
