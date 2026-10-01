"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchNode } from "@/data/content";
import NodeIcon, { type IconName } from "./NodeIcon";
import { cn } from "@/lib/utils";

const ICON: Record<ArchNode["kind"], IconName> = { trigger: "bolt", app: "code", ai: "ai", data: "data", infra: "infra", output: "globe" };
const NODE_W = 210;
const COL_GAP = 72;
const ROW_GAP = 26;
const MAX_COLS = 5; // wider chains wrap to a new row
const WRAP_GAP = 64; // vertical space between wrapped rows (edges run through it)
const isTodo = (s?: string) => !!s && s.trim().toUpperCase().startsWith("TODO");

function wrap(text: string, max = 28) {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max) {
      if (line) lines.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Layered layout: column = longest path from a source (so every edge flows left → right). */
function layout(nodes: ArchNode[], edges: [string, string][]) {
  const depth = new Map(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < nodes.length; i++)
    for (const [a, b] of edges) depth.set(b, Math.max(depth.get(b)!, depth.get(a)! + 1));
  const cols: ArchNode[][] = [];
  nodes.forEach((n) => (cols[depth.get(n.id)!] ??= []).push(n));
  const h = (n: ArchNode) => 52 + (n.note ? wrap(n.note).length * 16 : 0);
  const colH = cols.map((c) => c.reduce((s, n) => s + h(n), 0) + ROW_GAP * (c.length - 1));
  // Long chains wrap into rows of MAX_COLS so the diagram never shrinks to unreadable.
  const rowOf = (ci: number) => Math.floor(ci / MAX_COLS);
  const rows = rowOf(cols.length - 1) + 1;
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(...colH.filter((_, ci) => rowOf(ci) === r)));
  const rowTop = rowH.map((_, r) => 28 + rowH.slice(0, r).reduce((s, v) => s + v + WRAP_GAP, 0));
  const pos = new Map<string, { x: number; y: number; w: number; h: number; row: number }>();
  cols.forEach((c, ci) => {
    const r = rowOf(ci);
    let y = rowTop[r] + (rowH[r] - colH[ci]) / 2;
    c.forEach((n) => {
      pos.set(n.id, { x: 28 + (ci % MAX_COLS) * (NODE_W + COL_GAP), y, w: NODE_W, h: h(n), row: r });
      y += h(n) + ROW_GAP;
    });
  });
  const shownCols = Math.min(cols.length, MAX_COLS);
  const W = 56 + shownCols * NODE_W + (shownCols - 1) * COL_GAP;
  const paths = edges.map(([a, b]) => {
    const A = pos.get(a)!, B = pos.get(b)!;
    const x1 = A.x + A.w, y1 = A.y + 20, x2 = B.x, y2 = B.y + 20;
    if (B.row > A.row) {
      // Next row: out of A, down into the gap below A's row, back across, into B.
      const gy = rowTop[A.row] + rowH[A.row] + WRAP_GAP / 2;
      return `M${x1} ${y1} C${x1 + 24} ${y1} ${x1 + 24} ${gy} ${x1} ${gy} L${x2} ${gy} C${x2 - 24} ${gy} ${x2 - 24} ${y2} ${x2} ${y2}`;
    }
    const dx = Math.max(30, (x2 - x1) * 0.5);
    return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
  });
  return { pos, W, H: rowTop[rows - 1] + rowH[rows - 1] + 28, paths };
}

export default function ArchitectureDiagram({ nodes, edges, title }: { nodes: ArchNode[]; edges: [string, string][]; title: string }) {
  const { pos, W, H, paths } = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const root = useRef<HTMLDivElement>(null);
  const edgeRefs = useRef<(SVGPathElement | null)[]>([]);
  const packetRefs = useRef<(SVGGElement | null)[]>([]);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDrawn(true);
      return;
    }
    let raf = 0, inView = false, started = 0;
    const lens = () => edgeRefs.current.map((p) => p?.getTotalLength() ?? 0);
    let L: number[] = [];
    const tick = (now: number) => {
      raf = 0;
      if (!inView || document.hidden) return;
      const t = (now - started) / 1000;
      packetRefs.current.forEach((g, i) => {
        const p = edgeRefs.current[i];
        if (!g || !p || !L[i]) return;
        const phase = ((t * 0.45 + i * 0.37) % 1 + 1) % 1;
        const pt = p.getPointAtLength(phase * L[i]);
        g.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
        g.style.opacity = phase < 0.08 || phase > 0.92 ? "0" : "1";
      });
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView && !started) {
        setDrawn(true);
        L = lens();
        started = performance.now() + edges.length * 250 + 600; // packets start after the edges draw
      }
      if (inView && !raf) raf = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    io.observe(el);
    const onVis = () => !document.hidden && inView && !raf && (raf = requestAnimationFrame(tick));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [edges.length]);

  const summary = edges.map(([a, b]) => `${byId.get(a)?.label} → ${byId.get(b)?.label}`);

  return (
    <div ref={root}>
      {/* Desktop: animated node graph */}
      <div className="hidden overflow-x-auto lg:block" data-lenis-prevent>
        <svg role="img" aria-label={`${title} architecture: ${summary.join("; ")}`} viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full" style={{ maxWidth: W }}>
          <g fill="none">
            {paths.map((d, i) => (
              <path key={`base-${i}`} d={d} stroke="rgba(255,255,255,0.1)" strokeWidth="1.25" />
            ))}
            {paths.map((d, i) => (
              <path
                key={`edge-${i}`}
                ref={(r) => void (edgeRefs.current[i] = r)}
                d={d}
                stroke="rgb(255,107,53)"
                strokeWidth="1.5"
                pathLength={1}
                strokeDasharray="1 1"
                style={{
                  strokeDashoffset: drawn ? 0 : 1,
                  transition: `stroke-dashoffset 0.7s cubic-bezier(.65,0,.35,1) ${i * 0.25}s`,
                }}
              />
            ))}
          </g>
          {paths.map((_, i) => (
            <g key={`pk-${i}`} ref={(r) => void (packetRefs.current[i] = r)} style={{ opacity: 0 }}>
              <circle r="9" fill="rgb(255,107,53)" opacity="0.25" />
              <circle r="3.5" fill="rgb(255,107,53)" />
            </g>
          ))}
          {nodes.map((n) => {
            const p = pos.get(n.id)!;
            const todo = isTodo(n.label) || isTodo(n.note);
            return (
              <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
                <rect width={p.w} height={p.h} rx="12" fill="rgb(22,22,26)" stroke={todo ? "rgba(242,237,230,0.35)" : "rgba(255,255,255,0.12)"} strokeDasharray={todo ? "4 4" : undefined} />
                <line x1="0" x2={p.w} y1="40" y2="40" stroke="rgba(255,255,255,0.07)" />
                <circle cx="0" cy="20" r="4.5" fill="rgb(12,12,14)" stroke="rgba(255,255,255,0.25)" />
                <circle cx={p.w} cy="20" r="4.5" fill="rgb(12,12,14)" stroke="rgba(255,255,255,0.25)" />
                <g transform="translate(14 13)" color="rgba(242,237,230,0.75)">
                  <NodeIcon name={ICON[n.kind]} />
                </g>
                <text x="36" y="25" fill="rgb(242,237,230)" fontSize="13" fontFamily="var(--font-mono), monospace">
                  {n.label.length > 24 ? n.label.slice(0, 23) + "…" : n.label}
                </text>
                {n.note &&
                  wrap(n.note).map((line, li) => (
                    <text key={li} x="14" y={60 + li * 16} fill={isTodo(n.note) ? "rgba(242,237,230,0.6)" : "rgb(143,138,131)"} fontSize="11" fontFamily="var(--font-mono), monospace" fontStyle={isTodo(n.note) ? "italic" : undefined}>
                      {line}
                    </text>
                  ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mobile / tablet: the same graph as an ordered list */}
      <ol className="space-y-3 lg:hidden">
        {nodes.map((n) => {
          const out = edges.filter(([a]) => a === n.id).map(([, b]) => byId.get(b)?.label);
          const todo = isTodo(n.label) || isTodo(n.note);
          return (
            <li key={n.id} className={cn("rounded-xl border bg-bg/60 p-4", todo ? "border-dashed border-fg/30" : "border-line")}>
              <p className="flex items-center gap-2 font-mono text-[13px] text-fg">
                <NodeIcon name={ICON[n.kind]} className="text-fg/70" />
                {n.label}
              </p>
              {n.note && <p className={cn("mt-1.5 font-mono text-[12px]", isTodo(n.note) ? "italic text-fg/60" : "text-muted")}>{n.note}</p>}
              {out.length > 0 && <p className="mt-2 font-mono text-[12px] text-muted">→ {out.join(", ")}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
