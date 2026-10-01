import { caseStudies, type ArchNode } from "@/data/content";
import { cn } from "@/lib/utils";
import CoverPackets from "./CoverPackets";

// Cover for projects without screenshots whose story is an agent graph (AI Reel Pipeline).
// Built from the project's real architecture in content.ts: every node except the output is
// drawn as a graph node; the output is the 9:16 phone frame on the right. Packets flow along
// the edges as HTML dots moved by transforms (<CoverPackets>), only while on screen. The phone is a labelled placeholder:
// no rendered output is shown or implied.

const W = 1600;
const H = 1000;
const NODE_W = 252;
const NODE_H = 128;
const GAP = 38;
const PHONE = { x: 1272, y: 170, w: 300, h: 534 }; // 9:16
const isTodo = (s?: string) => !!s && s.trim().toUpperCase().startsWith("TODO");

function lines(label: string, max: number, maxLines = 2) {
  const out: string[] = [];
  let cur = "";
  for (const w of label.split(" ")) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, maxLines);
}

/** Column = longest path from a source, so every edge flows left → right. */
function layout(nodes: ArchNode[], edges: [string, string][]) {
  const graph = nodes.filter((n) => n.kind !== "output");
  const depth = new Map(graph.map((n) => [n.id, 0]));
  for (let i = 0; i < graph.length; i++)
    for (const [a, b] of edges) if (depth.has(a) && depth.has(b)) depth.set(b, Math.max(depth.get(b)!, depth.get(a)! + 1));
  const cols: ArchNode[][] = [];
  graph.forEach((n) => (cols[depth.get(n.id)!] ??= []).push(n));
  // Longer graphs scale down to fit the space left of the phone.
  const avail = PHONE.x - 70 - 40;
  const k = Math.min(1, avail / (cols.length * NODE_W + (cols.length - 1) * GAP));
  const nw = NODE_W * k, nh = NODE_H * k, gap = GAP * k;
  const span = cols.length * nw + (cols.length - 1) * gap;
  const x0 = 40 + Math.max(0, (avail - span) / 2);
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) => {
    const zig = (ci % 2 === 0 ? -95 : 95) * k; // gentle zig-zag reads as a graph, not a list
    c.forEach((n, ri) => {
      const y = 470 - nh / 2 + zig + (ri - (c.length - 1) / 2) * (nh + 40 * k);
      pos.set(n.id, { x: x0 + ci * (nw + gap), y });
    });
  });
  const portOut = (id: string) => {
    const p = pos.get(id);
    return p ? { x: p.x + nw, y: p.y + nh / 2 } : null;
  };
  const portIn = (id: string) => {
    const p = pos.get(id);
    return p ? { x: p.x, y: p.y + nh / 2 } : { x: PHONE.x, y: PHONE.y + PHONE.h / 2 };
  };
  const paths = edges
    .map(([a, b]) => {
      const A = portOut(a);
      if (!A) return null;
      const B = portIn(b);
      const dx = Math.max(36, (B.x - A.x) * 0.5);
      return `M${A.x} ${A.y} C${A.x + dx} ${A.y} ${B.x - dx} ${B.y} ${B.x} ${B.y}`;
    })
    .filter(Boolean) as string[];
  return { graph, pos, paths, k, nw, nh };
}

export default function AgentGraphCover({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const cs = caseStudies.find((c) => c.slug === slug);
  if (!cs) return null;
  const { nodes, edges } = cs.architecture;
  const { graph, pos, paths, k, nw, nh } = layout(nodes, edges);
  const output = nodes.find((n) => n.kind === "output");
  const chain = nodes.map((n) => n.label).join(" → ");

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-surface", className)}>
      <svg
        role="img"
        aria-label={`${title}: animated diagram of the agent pipeline, ${chain}. The phone frame is a placeholder, not real output.`}
        viewBox={`0 0 ${W} ${H}`}
        className="agent-cover absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="ag-dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="1.4" fill="rgb(255 255 255 / 0.08)" />
          </pattern>
          <pattern id="ag-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="14" stroke="rgb(255 255 255 / 0.05)" strokeWidth="6" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#ag-dots)" />

        {/* Edges */}
        <g fill="none">
          {paths.map((d, i) => (
            <path key={i} id={`ag-e${i}`} d={d} stroke="rgb(255 255 255 / 0.22)" strokeWidth="2.5" />
          ))}
        </g>

        {/* Graph nodes */}
        {graph.map((n) => {
          const p = pos.get(n.id)!;
          const sub = n.note && !isTodo(n.note) ? n.note : n.kind;
          // Label size: as large as the node allows, but the longest word must fit inside it.
          const textX = 44 * k;
          const room = nw - textX - 12 * k;
          const longest = Math.max(...n.label.split(" ").map((w) => w.length));
          const fs = Math.min(31 * Math.min(1, k * 1.3), room / (longest * 0.58));
          const showSub = k >= 0.8; // the small note line is unreadable on small nodes
          const ls = lines(n.label, Math.max(longest, Math.floor(room / (fs * 0.58))), showSub ? 2 : 3);
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
              <rect width={nw} height={nh} rx={16 * k} className="fill-bg" stroke="rgb(255 255 255 / 0.2)" strokeWidth="2" />
              <circle cx="0" cy={nh / 2} r={7 * Math.max(k, 0.7)} className="fill-bg" stroke="rgb(255 255 255 / 0.35)" strokeWidth="2" />
              <circle cx={nw} cy={nh / 2} r={7 * Math.max(k, 0.7)} className="fill-bg" stroke="rgb(255 255 255 / 0.35)" strokeWidth="2" />
              <circle cx={26 * k} cy={showSub ? 32 * k : nh / 2 - ((ls.length - 1) * fs * 1.1) / 2} r={7 * Math.max(k, 0.7)} className={n.kind === "ai" ? "fill-accent" : "fill-ok"} />
              {ls.map((l, li) => (
                <text
                  key={li}
                  x={textX}
                  y={showSub ? (36 + li * 34) * k : nh / 2 + (li - (ls.length - 1) / 2) * fs * 1.1}
                  className="fill-fg font-display"
                  fontSize={fs}
                  fontWeight="600"
                  dominantBaseline="middle"
                >
                  {l}
                </text>
              ))}
              {showSub && (
                <text x={26 * k} y={nh - 18 * k} className="fill-muted font-mono" fontSize={20 * k}>
                  {sub.length > 19 ? sub.slice(0, 18) + "…" : sub}
                </text>
              )}
            </g>
          );
        })}

        {/* Output: 9:16 phone frame, clearly a placeholder */}
        <g transform={`translate(${PHONE.x} ${PHONE.y})`}>
          <text x={PHONE.w / 2} y="-26" textAnchor="middle" className="fill-muted font-mono" fontSize="21">
            output · {(output?.label ?? "rendered reel").toLowerCase()}
          </text>
          <rect width={PHONE.w} height={PHONE.h} rx="40" className="fill-bg" stroke="rgb(255 255 255 / 0.28)" strokeWidth="3" />
          <rect x="14" y="14" width={PHONE.w - 28} height={PHONE.h - 28} rx="28" fill="url(#ag-hatch)" stroke="rgb(255 255 255 / 0.08)" strokeWidth="1.5" />
          <rect x={PHONE.w / 2 - 34} y="26" width="68" height="10" rx="5" fill="rgb(255 255 255 / 0.14)" />
          <circle cx={PHONE.w / 2} cy={PHONE.h / 2 - 30} r="38" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="2.5" />
          <path d={`M${PHONE.w / 2 - 11} ${PHONE.h / 2 - 50} l30 20 -30 20z`} fill="rgb(255 255 255 / 0.45)" />
          <text x={PHONE.w / 2} y={PHONE.h / 2 + 46} textAnchor="middle" className="fill-fg font-display" fontSize="24" fontWeight="600">
            rendered reel
          </text>
          <text x={PHONE.w / 2} y={PHONE.h / 2 + 78} textAnchor="middle" className="fill-muted font-mono" fontSize="17">
            placeholder · 9:16
          </text>
        </g>

      </svg>
      <CoverPackets paths={paths} width={W} height={H} />
    </div>
  );
}
