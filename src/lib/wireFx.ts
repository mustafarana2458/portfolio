// Interactive layer for the background wire fields: one set of listeners and one rAF loop
// shared by every field on the page (fields register from <WireFX>).
//
// - Cursor (hover + fine pointer): edges within R px of the cursor brighten and bend toward it,
//   nearby nodes light up and lean in. Each lit edge is a copy split in two halves; each half
//   gets a rotate+scale about its outer endpoint so the shared midpoint moves by δ: a real bend
//   with fixed endpoints, done with `transform` only. Overlays are built lazily per strip, the
//   first time something near it needs them, and are layers only while they're lit.
// - Click on empty background: packets ripple out along the nearest edges (≤1 burst / 500ms).
// - Only fields that are on screen are looked at. The static SVG base is never touched.
import type { WireCurve, WireNode } from "@/lib/wires";

type Pt = { x: number; y: number };
export type FxStrip = { el: HTMLElement; edges: { c: WireCurve; mobile: boolean }[]; nodes: WireNode[] };
type Field = { el: HTMLElement; color: string; strips: FxStrip[] };

type Geom = { v: number; x: number; y: number; w: number; h: number; samples: Float32Array[]; nodes: Float32Array };
type EdgeFx = { kind: "edge"; a: SVGSVGElement; b: SVGSVGElement; m: Pt; p0: Pt; p3: Pt };
type NodeFx = { kind: "node"; el: HTMLSpanElement };
type Live = (EdgeFx | NodeFx) & { k: number; t: number; flash: number; dx: number; dy: number; tdx: number; tdy: number };
type StripFx = { box: HTMLDivElement; w: number; h: number; edges: (Live | undefined)[]; nodes: (Live | undefined)[] };

const R = 180; // cursor reach (px)
const BEND = 7; // max midpoint offset (px)
const SAMPLES = 12;
const BURST_GAP = 500;
const NS = "http://www.w3.org/2000/svg";

const fields = new Set<Field>();
const onScreen = new Set<Field>();
const geoms = new WeakMap<FxStrip, Geom>();
const fxs = new WeakMap<FxStrip, StripFx>();
const colors = new WeakMap<FxStrip, string>();
const live = new Set<Live>();
let io: IntersectionObserver | null = null;
let version = 0;
let raf = 0;
let fine = false;
let phone = false;
let pointer: Pt | null = null; // client coords
let lastBurst = -Infinity;
let layer: HTMLDivElement | null = null;
let pool: HTMLSpanElement[] = [];
let ring: HTMLSpanElement | null = null;
let poolIdx = 0;
let teardown: (() => void) | null = null;

const at = (c: WireCurve, t: number): Pt => {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return { x: w0 * c[0] + w1 * c[2] + w2 * c[4] + w3 * c[6], y: w0 * c[1] + w1 * c[3] + w2 * c[5] + w3 * c[7] };
};
const allowed = (mobile: boolean) => !phone || mobile;

/** Strip position (document px) + sampled geometry; recomputed after any resize. Reads layout. */
function geom(s: FxStrip): Geom {
  const g = geoms.get(s);
  if (g && g.v === version) return g;
  const r = s.el.getBoundingClientRect();
  const w = r.width, h = r.height;
  const samples = s.edges.map((e) => {
    const a = new Float32Array(SAMPLES * 2);
    for (let k = 0; k < SAMPLES; k++) {
      const p = at(e.c, k / (SAMPLES - 1));
      a[k * 2] = p.x * w;
      a[k * 2 + 1] = p.y * h;
    }
    return a;
  });
  const nodes = new Float32Array(s.nodes.length * 2);
  s.nodes.forEach((n, i) => ((nodes[i * 2] = n.x * w), (nodes[i * 2 + 1] = n.y * h)));
  const next = { v: version, x: r.left + window.scrollX, y: r.top + window.scrollY, w, h, samples, nodes };
  geoms.set(s, next);
  const fx = fxs.get(s);
  if (fx && (Math.abs(fx.w - w) > 1 || Math.abs(fx.h - h) > 1)) {
    // stale overlays: drop them (rebuilt on next use)
    fx.edges.forEach((l) => l && live.delete(l));
    fx.nodes.forEach((l) => l && live.delete(l));
    fx.box.remove();
    fxs.delete(s);
  }
  return next;
}

function stripFx(s: FxStrip, g: Geom): StripFx {
  let fx = fxs.get(s);
  if (!fx) {
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;inset:0;pointer-events:none";
    s.el.appendChild(box);
    fx = { box, w: g.w, h: g.h, edges: [], nodes: [] };
    fxs.set(s, fx);
  }
  return fx;
}

const fresh = <T extends EdgeFx | NodeFx>(v: T): Live => ({ ...v, k: 0, t: 0, flash: 0, dx: 0, dy: 0, tdx: 0, tdy: 0 });

/** Bright copy of edge i, as two half-curve SVGs (each sized to its own bounding box). */
function edgeFx(s: FxStrip, i: number, g: Geom): Live {
  const fx = stripFx(s, g);
  const have = fx.edges[i];
  if (have) return have;
  const c = s.edges[i].c;
  const P = [0, 1, 2, 3].map((k) => ({ x: c[k * 2] * g.w, y: c[k * 2 + 1] * g.h }));
  // de Casteljau split at t = 0.5
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const p01 = mid(P[0], P[1]), p12 = mid(P[1], P[2]), p23 = mid(P[2], P[3]);
  const p012 = mid(p01, p12), p123 = mid(p12, p23), m = mid(p012, p123);
  const color = colors.get(s)!;
  const half = (pts: Pt[], pivot: Pt) => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs) - 4, y0 = Math.min(...ys) - 4;
    const w = Math.max(...xs) + 4 - x0, h = Math.max(...ys) + 4 - y0;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);
    svg.style.cssText = `position:absolute;left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;overflow:visible;opacity:0;transform-origin:${pivot.x - x0}px ${pivot.y - y0}px`;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M${pts[0].x} ${pts[0].y}C${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y} ${pts[3].x} ${pts[3].y}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-opacity", "0.8");
    path.setAttribute("stroke-width", "1.25");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    fx.box.appendChild(svg);
    return svg;
  };
  const l = fresh({ kind: "edge", a: half([P[0], p01, p012, m], P[0]), b: half([m, p123, p23, P[3]], P[3]), m, p0: P[0], p3: P[3] });
  fx.edges[i] = l;
  return l;
}

function nodeFx(s: FxStrip, i: number, g: Geom): Live {
  const fx = stripFx(s, g);
  const have = fx.nodes[i];
  if (have) return have;
  const color = colors.get(s)!;
  const el = document.createElement("span");
  const size = s.nodes[i].big ? 9 : 6;
  el.style.cssText = `position:absolute;left:${g.nodes[i * 2]}px;top:${g.nodes[i * 2 + 1]}px;width:${size}px;height:${size}px;margin:${-size / 2}px;border-radius:9999px;background:${color};box-shadow:0 0 8px 2px ${color}66;opacity:0`;
  fx.box.appendChild(el);
  const l = fresh({ kind: "node", el });
  fx.nodes[i] = l;
  return l;
}

/** Similarity (rotate + scale) about `pivot` that moves `m` by (dx, dy): CSS matrix. */
function bend(m: Pt, pivot: Pt, dx: number, dy: number) {
  const rx = m.x - pivot.x, ry = m.y - pivot.y, r2 = rx * rx + ry * ry;
  if (r2 < 16) return "none";
  const qx = rx + dx, qy = ry + dy;
  const a = (qx * rx + qy * ry) / r2, b = (rx * qy - ry * qx) / r2;
  return `matrix(${a.toFixed(4)},${b.toFixed(4)},${(-b).toFixed(4)},${a.toFixed(4)},0,0)`;
}

function frame() {
  raf = 0;
  const near: [FxStrip, number, Geom, boolean, number, number, number][] = []; // strip, index, geom, isNode, k, dx, dy
  // Read phase: geometry (layout reads happen before any style writes this frame).
  if (fine && pointer) {
    const px = pointer.x + window.scrollX, py = pointer.y + window.scrollY;
    for (const f of onScreen) {
      for (const s of f.strips) {
        const g = geom(s);
        if (!g.w || !g.h) continue;
        if (px < g.x - R || px > g.x + g.w + R || py < g.y - R || py > g.y + g.h + R) continue;
        const lx = px - g.x, ly = py - g.y;
        s.edges.forEach((e, i) => {
          if (!allowed(e.mobile)) return;
          const a = g.samples[i];
          let best = Infinity, bx = 0, by = 0;
          for (let k = 0; k < SAMPLES; k++) {
            const d = (a[k * 2] - lx) ** 2 + (a[k * 2 + 1] - ly) ** 2;
            if (d < best) ((best = d), (bx = a[k * 2]), (by = a[k * 2 + 1]));
          }
          const d = Math.sqrt(best);
          if (d >= R) return;
          const k = (1 - d / R) ** 2;
          const mag = d > 0.5 ? (Math.min(d * 0.5, BEND) * k) / d : 0;
          near.push([s, i, g, false, k, (lx - bx) * mag, (ly - by) * mag]);
        });
        s.nodes.forEach((n, i) => {
          if (!allowed(n.mobile)) return;
          const nx = g.nodes[i * 2], ny = g.nodes[i * 2 + 1];
          const d = Math.hypot(lx - nx, ly - ny);
          if (d >= R) return;
          const k = (1 - d / R) ** 2;
          const mag = d > 0.5 ? (Math.min(d * 0.4, 5) * k) / d : 0;
          near.push([s, i, g, true, k, (lx - nx) * mag, (ly - ny) * mag]);
        });
      }
    }
  }
  // Write phase (overlays are created here, after all layout reads).
  const want = new Map<Live, [number, number, number]>();
  for (const [s, i, g, isNode, k, dx, dy] of near) want.set(isNode ? nodeFx(s, i, g) : edgeFx(s, i, g), [k, dx, dy]);
  for (const [l, [k, dx, dy]] of want) {
    l.t = k;
    l.tdx = dx;
    l.tdy = dy;
    if (!live.has(l)) start(l);
  }
  for (const l of live) {
    if (!want.has(l)) l.t = l.tdx = l.tdy = 0;
    l.flash = l.flash > 0.02 ? l.flash * 0.9 : 0;
    const target = Math.max(l.t, l.flash);
    l.k += (target - l.k) * 0.22;
    l.dx += (l.tdx - l.dx) * 0.22;
    l.dy += (l.tdy - l.dy) * 0.22;
    if (target === 0 && l.k < 0.01 && Math.abs(l.dx) + Math.abs(l.dy) < 0.05) {
      stop(l);
      continue;
    }
    if (l.kind === "edge") {
      const o = Math.min(1, l.k).toFixed(3);
      l.a.style.opacity = l.b.style.opacity = o;
      l.a.style.transform = bend(l.m, l.p0, l.dx, l.dy);
      l.b.style.transform = bend(l.m, l.p3, l.dx, l.dy);
    } else {
      l.el.style.opacity = Math.min(1, l.k).toFixed(3);
      l.el.style.transform = `translate3d(${l.dx.toFixed(2)}px,${l.dy.toFixed(2)}px,0) scale(${(1 + 0.4 * l.k).toFixed(3)})`;
    }
  }
  if (live.size) schedule();
}

function start(l: Live) {
  live.add(l);
  const els = l.kind === "edge" ? [l.a, l.b] : [l.el];
  els.forEach((e) => (e.style.willChange = "transform, opacity"));
}
function stop(l: Live) {
  live.delete(l);
  l.k = l.dx = l.dy = 0;
  const els = l.kind === "edge" ? [l.a, l.b] : [l.el];
  els.forEach((e) => {
    e.style.opacity = "0";
    e.style.transform = "";
    e.style.willChange = "";
  });
}

const schedule = () => {
  if (!raf) raf = requestAnimationFrame(frame);
};

// ── click burst ──────────────────────────────────────────────────────────────

const NOT_EMPTY = ".node, a, button, input, textarea, select, label, summary, [role], [contenteditable], header, nav, dialog, [data-no-burst]";

function burstLayer(main: HTMLElement) {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:-1;pointer-events:none";
  pool = Array.from({ length: 8 }, () => {
    const d = document.createElement("span");
    d.style.cssText = "position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:9999px;opacity:0";
    layer!.appendChild(d);
    return d;
  });
  ring = document.createElement("span");
  ring.style.cssText = "position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:9999px;border:1px solid rgb(var(--accent));opacity:0";
  layer.appendChild(ring);
  main.appendChild(layer);
  return layer;
}

function onClick(e: MouseEvent) {
  if (e.button !== 0 || !onScreen.size) return;
  const target = e.target as Element | null;
  if (!target || target.closest(NOT_EMPTY)) return;
  if (window.getSelection()?.toString()) return;
  const now = performance.now();
  if (now - lastBurst < BURST_GAP) return;
  const main = document.getElementById("main");
  if (!main) return;

  const px = e.clientX + window.scrollX, py = e.clientY + window.scrollY;
  const hits: { s: FxStrip; i: number; d: number; j: number; g: Geom; color: string }[] = [];
  for (const f of onScreen)
    for (const s of f.strips) {
      const g = geom(s);
      if (!g.w || !g.h) continue;
      s.edges.forEach((ed, i) => {
        if (!allowed(ed.mobile)) return;
        const a = g.samples[i];
        let best = Infinity, j = 0;
        for (let k = 0; k < SAMPLES; k++) {
          const d = (a[k * 2] + g.x - px) ** 2 + (a[k * 2 + 1] + g.y - py) ** 2;
          if (d < best) ((best = d), (j = k));
        }
        const d = Math.sqrt(best);
        if (d < 320) hits.push({ s, i, d, j, g, color: f.color });
      });
    }
  if (!hits.length) return;
  lastBurst = now;
  hits.sort((p, q) => p.d - q.d);

  const mr = main.getBoundingClientRect();
  const ox = mr.left + window.scrollX, oy = mr.top + window.scrollY;
  burstLayer(main);
  ring!.animate(
    [
      { transform: `translate3d(${px - ox}px,${py - oy}px,0) scale(0.3)`, opacity: 0.6 },
      { transform: `translate3d(${px - ox}px,${py - oy}px,0) scale(2.4)`, opacity: 0 },
    ],
    { duration: 600, easing: "cubic-bezier(0.2,0.6,0.3,1)" }
  );
  for (const h of hits.slice(0, 6)) {
    const l = edgeFx(h.s, h.i, h.g);
    l.flash = 1;
    if (!live.has(l)) start(l);
    // packet from the point nearest the click to the far end of the edge
    const a = h.g.samples[h.i];
    const step = h.j < SAMPLES / 2 ? 1 : -1;
    const frames: Keyframe[] = [];
    let len = 0;
    for (let k = h.j, n = 0; k >= 0 && k < SAMPLES; k += step, n++) {
      if (n) len += Math.hypot(a[k * 2] - a[(k - step) * 2], a[k * 2 + 1] - a[(k - step) * 2 + 1]);
      frames.push({ transform: `translate3d(${a[k * 2] + h.g.x - ox}px,${a[k * 2 + 1] + h.g.y - oy}px,0)` });
    }
    if (frames.length < 2) continue;
    frames.forEach((f, n) => {
      const t = n / (frames.length - 1);
      f.offset = t;
      f.opacity = t === 0 || t === 1 ? 0 : 1;
    });
    const dot = pool[poolIdx++ % pool.length];
    dot.getAnimations().forEach((x) => x.cancel());
    dot.style.background = h.color;
    dot.style.boxShadow = `0 0 8px 2px ${h.color}66`;
    dot.animate(frames, { duration: Math.min(900, 380 + len * 0.6), delay: h.d * 0.8, easing: "cubic-bezier(0.2,0.6,0.3,1)" });
  }
  schedule();
}

// ── lifecycle ────────────────────────────────────────────────────────────────

function init() {
  fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const phoneMq = window.matchMedia("(max-width: 767px)");
  phone = phoneMq.matches;
  io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const f = [...fields].find((x) => x.el === e.target);
        if (!f) return;
        if (e.isIntersecting) onScreen.add(f);
        else onScreen.delete(f);
      }),
    { rootMargin: "60px 0px" }
  );
  const bump = () => {
    version++;
    phone = phoneMq.matches;
    schedule();
  };
  const main = document.getElementById("main");
  const ro = main ? new ResizeObserver(bump) : null;
  if (main) ro!.observe(main);
  window.addEventListener("resize", bump);
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY };
    schedule();
  };
  const leave = (e: PointerEvent) => {
    if (!e.relatedTarget) {
      pointer = null;
      schedule();
    }
  };
  const scroll = () => pointer && schedule();
  if (fine) {
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("scroll", scroll, { passive: true });
  }
  document.addEventListener("click", onClick);
  teardown = () => {
    io?.disconnect();
    ro?.disconnect();
    window.removeEventListener("resize", bump);
    window.removeEventListener("pointermove", move);
    document.removeEventListener("pointerout", leave);
    window.removeEventListener("scroll", scroll);
    document.removeEventListener("click", onClick);
    cancelAnimationFrame(raf);
    raf = 0;
    live.clear();
    layer?.remove();
    layer = null;
    io = null;
  };
}

/** Called by <WireFX> (only when motion is allowed and the device isn't html.lite). */
export function registerField(el: HTMLElement, color: string, strips: FxStrip[]) {
  if (!io) init();
  const f: Field = { el, color, strips };
  strips.forEach((s) => colors.set(s, color));
  fields.add(f);
  io!.observe(el);
  return () => {
    io?.unobserve(el);
    fields.delete(f);
    onScreen.delete(f);
    strips.forEach((s) => {
      const fx = fxs.get(s);
      fx?.edges.forEach((l) => l && live.delete(l));
      fx?.nodes.forEach((l) => l && live.delete(l));
      fx?.box.remove();
      fxs.delete(s);
    });
    if (!fields.size) {
      teardown?.();
      teardown = null;
    }
  };
}
