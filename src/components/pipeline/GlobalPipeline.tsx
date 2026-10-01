"use client";

import { useEffect, useRef } from "react";
import { executeNode } from "@/lib/pipeline";
import { onSiteReady } from "@/lib/utils";

/**
 * The page-long pipeline. Connects every `[data-pipeline-anchor]` node in DOM order.
 *
 * Desktop (≥1024px): workflow-style routing, out of each node's right port, down the gutter
 * beside it (gutters are measured per pair of nodes, so wider nodes are routed around), across the page inside the empty top band of the next section (or the gap between
 * nodes), down the left gutter, into the next node's left port. Nothing crosses text.
 * Mobile: one straight line down the left edge with short stubs into each node.
 *
 * Scroll maps to a "packet line" at 60% of the viewport: the packet sits on the path where
 * the path reaches that line, the active stroke is drawn up to it, and each node executes
 * as its in-port crosses it. Reduced motion: full path drawn, no packet, every node run.
 *
 * Look: dim 2px base; the drawn part is bright accent over a soft glow stroke; the packet
 * (11px) drags a trail of 4 fading dots.
 *
 * Performance: nothing is repainted while scrolling. Both SVGs are static (painted once per
 * build). The drawn part is revealed by a "curtain": an overflow-hidden box moved up by
 * translateY with its content moved back down, so everything above the packet line shows.
 * That equals "the path drawn so far" because the path only ever descends. The packet and
 * trail dots are HTML elements moved with transforms. Per scroll event there are no layout
 * reads (main's offset is cached at build) and the update runs in the scroll handler itself,
 * so it never lags a frame behind Lenis.
 */
const PACKET_LINE = 0.6;
const R = 18; // corner radius
/** Trail dots: distance behind the packet along the path (px), size, opacity. */
const TRAIL = [
  { back: 12, size: 7, alpha: 0.8 },
  { back: 26, size: 6, alpha: 0.55 },
  { back: 42, size: 5, alpha: 0.35 },
  { back: 60, size: 4, alpha: 0.18 },
];

type Pt = { x: number; y: number };

export default function GlobalPipeline() {
  const svgRef = useRef<SVGSVGElement>(null);
  const baseRef = useRef<SVGPathElement>(null);
  const stubsRef = useRef<SVGPathElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const curtainInnerRef = useRef<HTMLDivElement>(null);
  const litRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const activeRef = useRef<SVGPathElement>(null);
  const packetRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const svg = svgRef.current!;
    const main = svg.parentElement!;
    const base = baseRef.current!;
    const stubs = stubsRef.current!;
    const curtain = curtainRef.current!;
    const curtainInner = curtainInnerRef.current!;
    const lit = litRef.current!;
    const glow = glowRef.current!;
    const active = activeRef.current!;
    const packet = packetRef.current!;
    const trails = trailRefs.current.filter(Boolean) as HTMLDivElement[];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let xs = new Float32Array(0);
    let ys = new Float32Array(0); // cumulative max, so lookups by y are monotonic
    let lens = new Float32Array(0);
    let total = 0;
    let mainTop = 0; // main's document offset, cached so scroll updates never read layout
    let pageH = 0;
    let anchors: { el: Element; y: number }[] = [];
    let shown = "";

    const build = () => {
      const mainRect = main.getBoundingClientRect();
      const top = mainRect.top + window.scrollY;
      mainTop = top;
      const W = main.clientWidth;
      const H = main.scrollHeight;
      pageH = H;
      for (const el of [svg, lit]) {
        el.setAttribute("width", String(W));
        el.setAttribute("height", String(H));
        el.setAttribute("viewBox", `0 0 ${W} ${H}`);
      }
      curtain.style.width = curtainInner.style.width = `${W}px`;
      curtain.style.height = curtainInner.style.height = `${H}px`;

      const els = Array.from(main.querySelectorAll("[data-pipeline-anchor]"));
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--node-header-h")) || 44;
      const rel = (r: DOMRect) => ({ l: r.left - mainRect.left, r: r.right - mainRect.left, t: r.top + window.scrollY - top, b: r.bottom + window.scrollY - top });
      const nodes = els.map((el) => {
        const box = rel(el.getBoundingClientRect());
        const section = el.closest("section");
        return { el, box, portY: box.t + headerH / 2, sectionTop: section ? rel(section.getBoundingClientRect()).t : box.t, section };
      });
      if (nodes.length < 2) return;

      // The path is a list of segments we build ourselves (lines + cubics), so it can be
      // sampled analytically: much faster than thousands of getPointAtLength() calls.
      const segs: number[][] = []; // L: [x0,y0,x1,y1]  C: [x0,y0,c1x,c1y,c2x,c2y,x1,y1]
      let cx = 0, cy = 0;
      const M = (x: number, y: number) => ((cx = x), (cy = y));
      const L = (x: number, y: number) => (segs.push([cx, cy, x, y]), M(x, y));
      const C = (a: number, b: number, c: number, d: number, x: number, y: number) => (segs.push([cx, cy, a, b, c, d, x, y]), M(x, y));
      let stubD = "";

      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      if (desktop) {
        M(nodes[0].box.r, nodes[0].portY);
        for (let i = 0; i < nodes.length - 1; i++) {
          const A = nodes[i];
          const B = nodes[i + 1];
          const a: Pt = { x: A.box.r, y: A.portY };
          const b: Pt = { x: B.box.l, y: B.portY };
          // Run down the middle of the free space beside each node (never under it).
          const Rg = Math.min(W - 8, Math.max(A.box.r + 14, (A.box.r + W) / 2 + 6));
          const Lg = Math.max(8, Math.min(B.box.l - 14, B.box.l / 2 - 6));
          // Where to cross the page: the gap between the nodes if they share a section,
          // else the empty top band of B's section (above its heading/content).
          const cross =
            A.section === B.section
              ? A.box.b + Math.max(16, (B.box.t - A.box.b) / 2 - 26)
              : Math.max(A.box.b + 24, B.sectionTop + 28);
          const drop = Math.min(52, Math.max(24, (b.y - cross) * 0.35));
          C(a.x + 40, a.y, Rg, a.y + 4, Rg, a.y + 40); // out to the right gutter
          L(Rg, cross - R);
          // across the page, descending slightly so scroll → position stays monotonic
          C(Rg, cross + drop * 0.5, Lg, cross + drop * 0.5, Lg, cross + drop);
          L(Lg, b.y - 40); // left gutter
          C(Lg, b.y - 4, b.x - 40, b.y, b.x, b.y); // into B's in-port
          L(B.box.r, b.y); // pass-through behind the node (hidden under the card)
        }
      } else {
        const X = 10;
        M(X, nodes[0].portY);
        L(X, nodes[nodes.length - 1].portY);
        nodes.forEach((n) => (stubD += `M${X} ${n.portY} L${n.box.l} ${n.portY} `));
      }

      // Sample every ~6px along each segment; per-frame lookups are then a binary search.
      const X: number[] = [], Y: number[] = [], Ls: number[] = [];
      let dist = 0, maxY = -Infinity, px = segs[0][0], py = segs[0][1];
      const push = (x: number, y: number) => {
        dist += Math.hypot(x - px, y - py);
        px = x;
        py = y;
        maxY = Math.max(maxY, y);
        X.push(x);
        Y.push(maxY);
        Ls.push(dist);
      };
      push(px, py);
      let d = `M${px.toFixed(1)} ${py.toFixed(1)}`;
      for (const g of segs) {
        if (g.length === 4) {
          const n = Math.max(1, Math.ceil(Math.hypot(g[2] - g[0], g[3] - g[1]) / 6));
          for (let k = 1; k <= n; k++) push(g[0] + ((g[2] - g[0]) * k) / n, g[1] + ((g[3] - g[1]) * k) / n);
          d += ` L${g[2].toFixed(1)} ${g[3].toFixed(1)}`;
        } else {
          const poly = Math.hypot(g[2] - g[0], g[3] - g[1]) + Math.hypot(g[4] - g[2], g[5] - g[3]) + Math.hypot(g[6] - g[4], g[7] - g[5]);
          const n = Math.max(2, Math.ceil(poly / 6));
          for (let k = 1; k <= n; k++) {
            const t = k / n, u = 1 - t;
            const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
            push(w0 * g[0] + w1 * g[2] + w2 * g[4] + w3 * g[6], w0 * g[1] + w1 * g[3] + w2 * g[5] + w3 * g[7]);
          }
          d += ` C${g.slice(2).map((v) => v.toFixed(1)).join(" ")}`;
        }
      }
      xs = Float32Array.from(X);
      ys = Float32Array.from(Y);
      lens = Float32Array.from(Ls);
      total = dist;

      for (const p of [base, glow, active]) p.setAttribute("d", d);
      stubs.setAttribute("d", stubD);
      anchors = nodes.map((nd) => ({ el: nd.el, y: nd.portY }));
      update();
    };

    // Curtain: show the lit path above y = `clip` using two compositor-only transforms.
    const reveal = (clip: number) => {
      const c = Math.max(0, Math.min(pageH, clip));
      curtain.style.transform = `translate3d(0,${c - pageH}px,0)`;
      curtainInner.style.transform = `translate3d(0,${pageH - c}px,0)`;
    };
    // First sample index whose (monotonic) y / length reaches v.
    const search = (arr: Float32Array, v: number) => {
      let lo = 0, hi = arr.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < v) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    const setShown = (v: string) => {
      if (v === shown) return;
      shown = v;
      packet.style.opacity = v;
      trails.forEach((t, k) => (t.style.opacity = v === "1" ? String(TRAIL[k].alpha) : "0"));
    };

    const update = () => {
      if (!total) return;
      if (reduced) {
        reveal(pageH);
        anchors.forEach((a) => executeNode(a.el));
        return;
      }
      const target = window.scrollY + window.innerHeight * PACKET_LINE - mainTop;
      const i = search(ys, target);
      const atStart = target <= ys[0];
      const y = Math.min(target, ys[ys.length - 1]);
      reveal(atStart ? 0 : y);
      packet.style.transform = `translate3d(${xs[i]}px,${y}px,0)`;
      const len = atStart ? 0 : lens[i];
      trails.forEach((t, k) => {
        const j = search(lens, Math.max(0, len - TRAIL[k].back));
        t.style.transform = `translate3d(${xs[j]}px,${Math.min(ys[j], y)}px,0)`;
      });
      setShown(atStart || i >= ys.length - 1 ? "0" : "1");
      anchors.forEach((a, k) => {
        if (k > 0 && target >= a.y) executeNode(a.el, { runFor: 380 });
      });
    };
    const onScroll = update;

    let rebuildTimer = 0;
    const scheduleBuild = () => {
      window.clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(build, 180);
    };
    let lastW = 0, lastH = 0;
    const ro = new ResizeObserver(() => {
      const w = main.clientWidth, h = main.scrollHeight;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      lastW = w;
      lastH = h;
      scheduleBuild();
    });

    const off = onSiteReady(() => {
      build();
      ro.observe(main);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", scheduleBuild);
      document.fonts?.ready.then(scheduleBuild);
    });

    return () => {
      off();
      ro.disconnect();
      window.clearTimeout(rebuildTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleBuild);
    };
  }, []);

  return (
    <>
      {/* undrawn: dim, static */}
      <svg ref={svgRef} aria-hidden data-global-pipeline="" className="pointer-events-none absolute left-0 top-0 z-[-1] overflow-visible" width="0" height="0">
        <path ref={baseRef} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <path ref={stubsRef} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      </svg>
      {/* drawn: bright line over a soft glow (a wide translucent stroke, no blur filter), revealed by the curtain */}
      <div
        ref={curtainRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-[-1] overflow-hidden"
        style={{ height: 0, transform: "translate3d(0,-100%,0)", willChange: "transform" }}
      >
        <div ref={curtainInnerRef} style={{ willChange: "transform" }}>
          <svg ref={litRef} className="block overflow-visible" width="0" height="0">
            <path ref={glowRef} fill="none" stroke="rgba(255,107,53,0.16)" strokeWidth="9" strokeLinecap="round" />
            <path ref={activeRef} fill="none" stroke="rgb(255,107,53)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      {/* packet trail (4 dots) + packet: transform/opacity only */}
      {TRAIL.map((t, k) => (
        <div
          key={k}
          ref={(el) => {
            trailRefs.current[k] = el;
          }}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-[-1] rounded-full bg-accent motion-reduce:hidden"
          style={{ width: t.size, height: t.size, margin: -t.size / 2, opacity: 0, willChange: "transform" }}
        />
      ))}
      <div
        ref={packetRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-[-1] motion-reduce:hidden"
        style={{ width: 56, height: 56, margin: -28, opacity: 0, willChange: "transform" }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgb(255 107 53 / 0.7) 0, rgb(255 107 53 / 0.25) 35%, transparent 70%)" }}
        />
        <span className="absolute left-1/2 top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
        <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(255,236,220)]" />
      </div>
    </>
  );
}
