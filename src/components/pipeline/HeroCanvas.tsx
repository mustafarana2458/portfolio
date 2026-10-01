"use client";

import { useEffect, useRef, useState } from "react";
import { NODE_LABELS, buildNetwork, cubicAt, edgeControls } from "./network";
import { HERO_BURST_EVENT } from "@/lib/pipeline";

const W = 1440; // design space shared with <HeroNetworkSvg> (preserveAspectRatio "slice")
const H = 900;
const ACCENT = "255,107,53";

type Packet = { edge: number; t: number; speed: number; reverse: boolean };
type Ring = { x: number; y: number; t: number };

/**
 * Live Canvas 2D version of the hero network: drifting nodes pulled toward the cursor,
 * packets flowing along edges (and chaining into the next edge), click → packet burst.
 * Mounted only for motion-OK users, started in idle time after first paint, and fully
 * stopped (no rAF scheduled) whenever the hero is offscreen or the tab is hidden.
 * Phones: at most 15 nodes, 30fps, DPR ≤ 1.5. Touch devices get no cursor pull, so no
 * pointer handlers run during touch scrolling.
 */
const MOBILE_NODES = 15;
export default function HeroCanvas({ onActive }: { onActive?: (active: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest("section");
    if (!canvas || !section) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // no canvas support → the static SVG stays

    const { nodes, edges } = buildNetwork(48);
    const small = window.matchMedia("(max-width: 767px)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const maxPackets = small ? 8 : 26;
    const minFrameMs = small ? 1000 / 30 - 2 : 0; // 30fps cap on phones

    // Geometry (recomputed on resize)
    let cw = 0, ch = 0, s = 1, ox = 0, oy = 0, sectionTop = 0;
    const pos = nodes.map(() => ({ x: 0, y: 0, px: 0, py: 0 })); // current screen pos + cursor pull offset
    const visibleNode = nodes.map(() => true);
    let labels: { i: number; text: string }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      cw = canvas.clientWidth;
      ch = canvas.clientHeight;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s = Math.max(cw / W, ch / H);
      ox = (cw - W * s) / 2;
      oy = (ch - H * s) / 2;
      nodes.forEach((n, i) => {
        const x = n.x * W * s + ox;
        const y = n.y * H * s + oy;
        visibleNode[i] = x > -60 && x < cw + 60 && y > -60 && y < ch + 60;
      });
      if (small) {
        // Keep only the MOBILE_NODES visible nodes closest to the centre.
        const keep = new Set(
          nodes
            .map((n, i) => ({ i, d: Math.hypot(n.x * W * s + ox - cw / 2, n.y * H * s + oy - ch / 2) }))
            .filter((o) => visibleNode[o.i])
            .sort((a, b) => a.d - b.d)
            .slice(0, MOBILE_NODES)
            .map((o) => o.i)
        );
        nodes.forEach((_, i) => (visibleNode[i] = keep.has(i)));
      }
      sectionTop = section.getBoundingClientRect().top + window.scrollY; // for pointer maths without layout reads
      // Labels only go on nodes whose label box clears the hero's text, buttons and nodes.
      const cr = canvas.getBoundingClientRect();
      const busy = Array.from(section.querySelectorAll("h1, p, a, button, [data-node]")).map((el) => {
        const r = el.getBoundingClientRect();
        return { l: r.left - cr.left - 24, r: r.right - cr.left + 24, t: r.top - cr.top - 20, b: r.bottom - cr.top + 20 };
      });
      const free = nodes
        .map((n, i) => ({ i, x: n.x * W * s + ox, y: n.y * H * s + oy, big: n.big }))
        .filter((p) => visibleNode[p.i] && p.x > 20 && p.x < cw - 110 && p.y > 90 && p.y < ch * 0.8)
        .filter((p) => !busy.some((b) => p.x + 110 > b.l && p.x - 12 < b.r && p.y + 12 > b.t && p.y - 12 < b.b))
        .sort((a, b) => a.x - b.x);
      labels = NODE_LABELS.slice(0, free.length).map((text, k) => ({
        i: free[Math.round(((k + 0.5) / Math.min(NODE_LABELS.length, free.length)) * (free.length - 1))].i,
        text,
      }));
    };

    // Pre-rendered glow sprite for packets (much cheaper than shadowBlur).
    const glowSprite = (stops: [number, number][]) => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d")!;
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      stops.forEach(([o, a]) => g.addColorStop(o, `rgba(${ACCENT},${a})`));
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return c;
    };
    const sprite = glowSprite([[0, 1], [0.18, 0.7], [0.45, 0.22], [1, 0]]); // packets
    const nodeGlow = glowSprite([[0, 0.32], [1, 0]]); // soft halo under nodes
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
    const monoFont = `500 12px ${mono ? mono + ", " : ""}ui-monospace, monospace`;

    const packets: Packet[] = [];
    const rings: Ring[] = [];
    // Only edges between drawn nodes carry packets (recomputed after resize, see start()).
    let liveEdges: number[] = [];
    let liveSet = new Set<number>();
    const updateLiveEdges = () => {
      liveEdges = edges.map((_, i) => i).filter((i) => visibleNode[edges[i][0]] && visibleNode[edges[i][1]]);
      liveSet = new Set(liveEdges);
    };
    const outgoing = nodes.map((_, i) => edges.map((e, j) => (e[0] === i ? j : -1)).filter((j) => j >= 0));

    const spawn = () => {
      if (packets.length >= maxPackets || !liveEdges.length) return;
      const edge = liveEdges[Math.floor(Math.random() * liveEdges.length)];
      packets.push({ edge, t: 0, speed: 0.35 + Math.random() * 0.35, reverse: false });
    };

    const nearestNode = (x: number, y: number) => {
      let best = -1, bd = Infinity;
      pos.forEach((p, i) => {
        if (!visibleNode[i]) return;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) (bd = d), (best = i);
      });
      return best;
    };

    const burst = (x: number, y: number) => {
      const n = nearestNode(x, y);
      if (n < 0) return;
      rings.push({ x: pos[n].x, y: pos[n].y, t: 0 });
      const touching = edges.map((e, j) => ({ e, j })).filter(({ e }) => e[0] === n || e[1] === n);
      for (let i = 0; i < 12; i++) {
        const pick = touching[i % Math.max(1, touching.length)];
        if (!pick) break;
        packets.push({ edge: pick.j, t: 0, speed: 0.6 + Math.random() * 0.6, reverse: pick.e[1] === n });
      }
    };

    // Cursor pull (fine pointers only). The canvas fills the hero, so its top is the section's
    // document offset minus scrollY: no getBoundingClientRect (forced layout) per pointer move.
    let mx = -9999, my = -9999;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY - (sectionTop - window.scrollY);
    };
    const onLeave = () => ((mx = -9999), (my = -9999));
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("a, button, input, textarea, select, [data-node]")) return;
      burst(e.clientX, e.clientY - (sectionTop - window.scrollY));
    };
    const onBurstEvent = () => burst(cw * 0.72, ch * 0.5);

    // Loop control
    let raf = 0, last = 0, spawnAcc = 0, inView = true, pageVisible = !document.hidden;
    const w = window as unknown as { __heroFrames?: number };
    w.__heroFrames = 0;

    // Adaptive quality: if frames run over budget (slow devices), draw every other frame.
    let skip = false, flip = false, cost = 0, samples = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!inView || !pageVisible) return; // paused; resumes via observers
      if ((skip && (flip = !flip)) || (minFrameMs && last && now - last < minFrameMs)) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const t0 = performance.now();
      const dt = Math.min(0.066, (now - (last || now)) / 1000);
      last = now;
      w.__heroFrames!++;
      const t = now / 1000;
      const R = 190 * Math.max(0.8, s);

      // Update node positions: gentle drift + eased pull toward the cursor.
      nodes.forEach((n, i) => {
        if (!visibleNode[i]) return;
        const bx = n.x * W * s + ox + Math.sin(t * 0.35 + n.phase) * 7;
        const by = n.y * H * s + oy + Math.cos(t * 0.28 + n.phase * 1.3) * 6;
        const d = Math.hypot(mx - bx, my - by);
        let tx = 0, ty = 0;
        if (d < R) {
          const f = (1 - d / R) ** 2 * 26;
          tx = ((mx - bx) / (d || 1)) * f;
          ty = ((my - by) / (d || 1)) * f;
        }
        const p = pos[i];
        p.px += (tx - p.px) * 0.08;
        p.py += (ty - p.py) * 0.08;
        p.x = bx + p.px;
        p.y = by + p.py;
      });

      ctx.clearRect(0, 0, cw, ch);

      // Edges (base)
      const active = new Set(packets.map((p) => p.edge));
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      edges.forEach(([a, b], i) => {
        if (active.has(i) || (small ? !(visibleNode[a] && visibleNode[b]) : !visibleNode[a] && !visibleNode[b])) return;
        const A = pos[a], B = pos[b];
        const [c1x, c1y, c2x, c2y] = edgeControls(A.x, A.y, B.x, B.y);
        ctx.moveTo(A.x, A.y);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, B.x, B.y);
      });
      ctx.stroke();
      // Edges carrying data light up
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(${ACCENT},0.65)`;
      ctx.beginPath();
      active.forEach((i) => {
        const [a, b] = edges[i];
        const A = pos[a], B = pos[b];
        const [c1x, c1y, c2x, c2y] = edgeControls(A.x, A.y, B.x, B.y);
        ctx.moveTo(A.x, A.y);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, B.x, B.y);
      });
      ctx.stroke();

      // Nodes: soft accent halo, then the node
      ctx.lineWidth = 1.2;
      nodes.forEach((n, i) => {
        if (!visibleNode[i]) return;
        const { x, y } = pos[i];
        const gr = n.big ? 18 : 11;
        ctx.drawImage(nodeGlow, x - gr, y - gr, gr * 2, gr * 2);
        ctx.fillStyle = "rgb(22,22,26)";
        ctx.strokeStyle = n.big ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.45)";
        ctx.beginPath();
        if (n.big) ctx.roundRect(x - 9, y - 7, 18, 14, 4);
        else ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.font = monoFont;
      ctx.fillStyle = "rgba(242,237,230,0.72)";
      labels.forEach(({ i, text }) => ctx.fillText(text, pos[i].x + 16, pos[i].y + 4));

      // Packets (advance, chain into the next edge sometimes)
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.t += p.speed * dt;
        if (p.t >= 1) {
          const end = p.reverse ? edges[p.edge][0] : edges[p.edge][1];
          const next = outgoing[end].filter((j) => liveSet.has(j));
          if (!p.reverse && next.length && Math.random() < 0.55 && packets.length <= maxPackets + 12) {
            p.edge = next[Math.floor(Math.random() * next.length)];
            p.t = 0;
          } else {
            packets.splice(i, 1);
            continue;
          }
        }
        const [a, b] = edges[p.edge];
        const A = pos[a], B = pos[b];
        const [c1x, c1y, c2x, c2y] = edgeControls(A.x, A.y, B.x, B.y);
        const tt = p.reverse ? 1 - p.t : p.t;
        const x = cubicAt(tt, A.x, c1x, c2x, B.x);
        const y = cubicAt(tt, A.y, c1y, c2y, B.y);
        ctx.drawImage(sprite, x - 18, y - 18, 36, 36);
      }

      // Burst rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.t += dt * 1.6;
        if (r.t >= 1) {
          rings.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(${ACCENT},${(1 - r.t) * 0.6})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 6 + r.t * 46, 0, Math.PI * 2);
        ctx.stroke();
      }

      spawnAcc += dt;
      if (spawnAcc > (small ? 0.7 : 0.32)) {
        spawnAcc = 0;
        spawn();
      }
      if (samples < 60) {
        cost += performance.now() - t0;
        if (++samples === 60 && cost / 60 > 9) skip = true;
      }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && inView && pageVisible) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const ro = new ResizeObserver(() => {
      resize();
      updateLiveEdges();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      kick();
    });
    io.observe(section);
    const onVis = () => {
      pageVisible = !document.hidden;
      kick();
    };
    document.addEventListener("visibilitychange", onVis);
    if (finePointer) {
      section.addEventListener("pointermove", onMove, { passive: true });
      section.addEventListener("pointerleave", onLeave);
    }
    section.addEventListener("pointerdown", onDown);
    window.addEventListener(HERO_BURST_EVENT, onBurstEvent);

    // Start after the page has loaded, in idle time: the static SVG already shows the same
    // picture, so nothing is lost while hydration and first paint get the main thread.
    const start = () => {
      resize();
      updateLiveEdges();
      for (let i = 0; i < maxPackets / 2; i++) spawn();
      setVisible(true);
      onActive?.(true);
      kick();
    };
    const hasIdle = typeof window.requestIdleCallback === "function";
    let idleId: number | ReturnType<typeof setTimeout> = 0;
    const schedule = () => {
      idleId = hasIdle ? window.requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      window.removeEventListener("load", schedule);
      if (hasIdle) window.cancelIdleCallback(idleId as number);
      else clearTimeout(idleId as ReturnType<typeof setTimeout>);
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      section.removeEventListener("pointerdown", onDown);
      window.removeEventListener(HERO_BURST_EVENT, onBurstEvent);
      onActive?.(false);
    };
  }, [onActive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
