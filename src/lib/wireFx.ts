// Interactive layer for the background wire fields: one set of listeners and one rAF loop
// shared by every field on the page (fields register from <WireFX>).
//
// - Cursor (hover + fine pointer): edges within R px of the cursor brighten and bend toward it,
//   nearby nodes light up and lean in. Each lit edge is a copy split in two halves; each half
//   gets a rotate+scale about its outer endpoint so the shared midpoint moves by δ: a real bend
//   with fixed endpoints, done with `transform` only. Overlays are built lazily per strip, the
//   first time something near it needs them, and are layers only while they're lit.
// - Click on empty background: packets ripple out along the nearest edges (≤1 burst / 500ms).
// - Idle packets: every visible edge of the on-screen fields is a "slot" (long edges: two).
//   One page-wide pool of packets (≤16 on phones, ≤30 on desktop) serves them. Each packet
//   makes one trip (Web Animation, transform/opacity) and then takes the next slot: when there
//   are more slots than the cap, slots rotate through a queue so no edge stays dead; when there
//   are fewer, each slot keeps its own packet. Random start offsets and speeds keep them out
//   of sync. A field being hovered / "executing" runs its packets at 2x.
// - Only fields that are on screen are looked at. The static SVG base is never touched.
import type { WireCurve, WireNode } from "@/lib/wires";

type Pt = { x: number; y: number };
/** `minX`: edges entirely left of it are masked out (client cards) and get no packets. */
export type FxStrip = { el: HTMLElement; edges: { c: WireCurve; mobile: boolean }[]; nodes: WireNode[]; minX?: number };
type Field = { el: HTMLElement; color: string; strips: FxStrip[]; boost: boolean };
type Slot = { key: string; f: Field; s: FxStrip; i: number; n: number };
type Packet = { el: HTMLSpanElement; slot: Slot | null; anim: Animation | null; v: number };

/** x, y: document px; ox, oy: offset inside the field box. */
type Geom = { v: number; x: number; y: number; ox: number; oy: number; w: number; h: number; samples: Float32Array[]; nodes: Float32Array };
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
const packets: Packet[] = [];
let slots = new Map<string, Slot>();
let queue: Slot[] = [];
let planTimer = 0;
const fieldIds = new WeakMap<Field, number>();
let nextFieldId = 0;

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
  const next = { v: version, x: r.left + window.scrollX, y: r.top + window.scrollY, ox: s.el.offsetLeft, oy: s.el.offsetTop, w, h, samples, nodes };
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

// ── idle packets ─────────────────────────────────────────────────────────────

const LONG = 280; // px: edges longer than this carry two packets
const cap = () => (phone ? 16 : 30);
const edgeLen = (a: Float32Array) => {
  let len = 0;
  for (let k = 1; k < SAMPLES; k++) len += Math.hypot(a[k * 2] - a[k * 2 - 2], a[k * 2 + 1] - a[k * 2 - 1]);
  return len;
};
const schedulePlan = () => {
  window.clearTimeout(planTimer);
  planTimer = window.setTimeout(plan, 120);
};

/** Rebuild the slot list from the on-screen fields and hand slots to packets (reads layout). */
function plan() {
  const next = new Map<string, Slot>();
  for (const f of onScreen) {
    let id = fieldIds.get(f);
    if (id === undefined) fieldIds.set(f, (id = nextFieldId++));
    f.strips.forEach((s, si) => {
      const g = geom(s);
      if (!g.w || !g.h) return;
      s.edges.forEach((e, i) => {
        if (!allowed(e.mobile) || (s.minX && Math.max(e.c[0], e.c[6]) < s.minX)) return;
        const count = edgeLen(g.samples[i]) > LONG ? 2 : 1;
        for (let n = 0; n < count; n++) {
          const key = `${id}:${si}:${i}:${n}`;
          next.set(key, slots.get(key) ?? { key, f, s, i, n });
        }
      });
    });
  }
  slots = next;
  // Drop packets whose slot is gone or whose geometry is stale; keep the rest running.
  const held = new Set<string>();
  for (const p of packets) {
    if (p.slot && (!slots.has(p.slot.key) || p.v !== version)) release(p);
    if (p.slot) held.add(p.slot.key);
  }
  queue = shuffle([...slots.values()].filter((sl) => !held.has(sl.key)));
  const target = Math.min(cap(), slots.size);
  let busy = packets.filter((p) => p.slot).length;
  while (busy < target && queue.length) {
    const p = packets.find((x) => !x.slot) ?? newPacket();
    run(p, queue.shift()!, true);
    busy++;
  }
  // over the cap (e.g. after a resize to phone width): retire the extras
  const running = packets.filter((p) => p.slot);
  while (running.length > target) {
    const p = running.pop()!;
    queue.push(p.slot!);
    release(p);
  }
}

/** Next queued slot that still exists (skips ones whose field has left the screen). */
function takeQueued() {
  let q = queue.shift();
  while (q && !slots.has(q.key)) q = queue.shift();
  return q;
}

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newPacket(): Packet {
  const el = document.createElement("span");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:9999px;opacity:0;pointer-events:none";
  const p: Packet = { el, slot: null, anim: null, v: version };
  packets.push(p);
  return p;
}

function release(p: Packet) {
  if (p.anim) {
    p.anim.onfinish = null;
    p.anim.cancel();
  }
  p.anim = null;
  p.slot = null;
  p.el.remove();
}

/** One trip along the slot's edge, then on to the next slot. */
function run(p: Packet, slot: Slot, first: boolean) {
  const g = geom(slot.s);
  const c = slot.s.edges[slot.i].c;
  const len = edgeLen(g.samples[slot.i]);
  const frames: Keyframe[] = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const q = at(c, t);
    frames.push({ transform: `translate3d(${(g.ox + q.x * g.w).toFixed(1)}px,${(g.oy + q.y * g.h).toFixed(1)}px,0)`, opacity: t < 0.1 || t > 0.9 ? 0 : 1, offset: t });
  }
  const speed = (phone ? 55 : 85) + Math.random() * 50; // px/s, varied per trip
  const duration = Math.max(1400, Math.min(6000, (len / speed) * 1000));
  // In the field box, not the strip: a strip has a fade mask on desktop, and animating inside a
  // masked element costs a mask render surface per strip.
  if (p.el.parentElement !== slot.f.el) slot.f.el.appendChild(p.el);
  const color = slot.f.color;
  p.el.style.background = color;
  p.el.style.boxShadow = `0 0 8px 2px ${color}55`;
  p.slot = slot;
  p.v = version;
  // first trip: random offset (a long edge's second packet starts about half a trip behind)
  const delay = first ? Math.random() * duration * 0.5 + slot.n * duration * 0.5 : 150 + Math.random() * 700;
  const a = p.el.animate(frames, { duration, delay, easing: "ease-in-out" });
  if (slot.f.boost) a.updatePlaybackRate(2);
  a.onfinish = () => {
    if (p.anim !== a) return;
    let nextSlot: Slot | undefined = slot;
    if (!slots.has(slot.key)) nextSlot = takeQueued();
    else if (slots.size > cap()) {
      queue.push(slot); // rotate: this edge waits, the longest-waiting one goes next
      nextSlot = takeQueued();
    }
    if (nextSlot && slots.has(nextSlot.key)) run(p, nextSlot, false);
    else release(p);
  };
  p.anim = a;
}

/** Hovered / executing card: its packets run at 2x. */
export function boostField(el: HTMLElement, on: boolean) {
  const f = [...fields].find((x) => x.el === el);
  if (!f || f.boost === on) return;
  f.boost = on;
  for (const p of packets) if (p.slot?.f === f) p.anim?.updatePlaybackRate(on ? 2 : 1);
}

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
        schedulePlan();
      }),
    { rootMargin: "60px 0px" }
  );
  const bump = () => {
    version++;
    phone = phoneMq.matches;
    schedule();
    schedulePlan();
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
    window.clearTimeout(planTimer);
    packets.forEach(release);
    packets.length = 0;
    slots = new Map();
    queue = [];
    live.clear();
    layer?.remove();
    layer = null;
    io = null;
  };
}

/** Called by <WireFX> (only when motion is allowed and the device isn't html.lite). */
export function registerField(el: HTMLElement, color: string, strips: FxStrip[]) {
  if (!io) init();
  const f: Field = { el, color, strips, boost: false };
  strips.forEach((s) => colors.set(s, color));
  fields.add(f);
  io!.observe(el);
  return () => {
    io?.unobserve(el);
    fields.delete(f);
    onScreen.delete(f);
    schedulePlan();
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
