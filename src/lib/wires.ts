// Deterministic "wire field" layouts for the backgrounds behind sections and project cards.
//
// A field is four strips that are exactly the visible space around a card: top and bottom
// (half the gap between cards) and the two side gutters. Each strip is a small network in
// normalised 0..1 coordinates, so the static SVG stretches to the strip (strokes stay 1px via
// vector-effect) while circles and labels are HTML percentages and never distort. Same seed →
// same picture on every build.
import { rng } from "@/components/pipeline/network";

export type WireNode = { x: number; y: number; big: boolean; mobile: boolean };
/** Cubic edge [x0, y0, c1x, c1y, c2x, c2y, x1, y1], normalised to its strip. */
export type WireCurve = [number, number, number, number, number, number, number, number];
export type WireStrip = { nodes: WireNode[]; edges: { c: WireCurve; mobile: boolean }[] };
export type WireField = {
  top: WireStrip;
  bottom: WireStrip;
  left: WireStrip;
  right: WireStrip;
  /** Labels on top/bottom strip nodes (normalised to that strip). */
  labels: { strip: "top" | "bottom"; x: number; y: number; text: string }[];
  /** Up to 3 top/bottom edges for the moving packets. */
  packets: { strip: "top" | "bottom"; c: WireCurve }[];
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Horizontal strip: nodes spread along x, edges with horizontal tangents (n8n style). */
function hStrip(rand: () => number, count: number): WireStrip {
  const nodes: WireNode[] = Array.from({ length: count }, (_, i) => ({
    x: Math.min(0.97, (i + 0.2 + rand() * 0.6) / count),
    y: 0.22 + rand() * 0.56,
    big: rand() < 0.25,
    mobile: i % 2 === 0,
  }));
  const edges: WireStrip["edges"] = [];
  const link = (a: WireNode, b: WireNode) => {
    const dx = Math.max(0.02, (b.x - a.x) * 0.5);
    edges.push({ c: [a.x, a.y, a.x + dx, a.y, b.x - dx, b.y, b.x, b.y], mobile: a.mobile && b.mobile });
  };
  for (let i = 0; i < count - 1; i++) {
    link(nodes[i], nodes[i + 1]);
    if (i < count - 2 && rand() < 0.35) link(nodes[i], nodes[i + 2]); // a few skip-links
  }
  // phones keep every other node: give them a chain of their own
  const m = nodes.filter((n) => n.mobile);
  for (let i = 0; i < m.length - 1; i++) {
    const dx = Math.max(0.02, (m[i + 1].x - m[i].x) * 0.5);
    edges.push({ c: [m[i].x, m[i].y, m[i].x + dx, m[i].y, m[i + 1].x - dx, m[i + 1].y, m[i + 1].x, m[i + 1].y], mobile: true });
  }
  return { nodes, edges };
}

/** Vertical gutter strip: runs top → bottom with vertical tangents (desktop only). */
function vStrip(rand: () => number, count: number): WireStrip {
  const nodes: WireNode[] = Array.from({ length: count }, (_, i) => ({
    x: 0.3 + rand() * 0.4,
    y: Math.min(0.97, (i + 0.2 + rand() * 0.6) / count),
    big: rand() < 0.2,
    mobile: false,
  }));
  const edges: WireStrip["edges"] = [];
  for (let i = 0; i < count - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    const dy = Math.max(0.02, (b.y - a.y) * 0.5);
    edges.push({ c: [a.x, a.y, a.x, a.y + dy, b.x, b.y - dy, b.x, b.y], mobile: false });
  }
  return { nodes, edges };
}

export function buildWireField(seed: string, labels: string[], { across = 9, down = 4 } = {}): WireField {
  const rand = rng(hash(seed));
  const top = hStrip(rand, across);
  const bottom = hStrip(rand, across);
  const left = vStrip(rand, down);
  const right = vStrip(rand, down);
  // Labels: alternate strips, spread along x, on nodes phones also keep.
  const spots = [
    ...top.nodes.map((n) => ({ strip: "top" as const, n })),
    ...bottom.nodes.map((n) => ({ strip: "bottom" as const, n })),
  ].filter(({ n }) => n.mobile && n.x > 0.08 && n.x < 0.85);
  const used = new Set<number>();
  const picked = labels.slice(0, 3).map((text, k, arr) => {
    const want = (k + 0.5) / arr.length;
    let best = -1;
    spots.forEach((s, i) => {
      if (used.has(i) || (k % 2 === 0) !== (s.strip === "top")) return;
      if (best < 0 || Math.abs(s.n.x - want) < Math.abs(spots[best].n.x - want)) best = i;
    });
    if (best < 0) best = spots.findIndex((_, i) => !used.has(i));
    used.add(best);
    spots[best].n.big = true;
    return { strip: spots[best].strip, x: spots[best].n.x, y: spots[best].n.y, text };
  });
  // Packets: the longest edges of each horizontal strip.
  const longest = (s: WireStrip) => [...s.edges].sort((p, q) => q.c[6] - q.c[0] - (p.c[6] - p.c[0]));
  const packets = [
    ...longest(top).slice(0, 2).map((e) => ({ strip: "top" as const, c: e.c })),
    ...longest(bottom).slice(0, 1).map((e) => ({ strip: "bottom" as const, c: e.c })),
  ];
  return { top, bottom, left, right, labels: picked, packets };
}

/** Normalised cubic → SVG path in a 1000x1000 viewBox. */
export const curveD = (c: WireCurve) =>
  `M${(c[0] * 1000).toFixed(1)} ${(c[1] * 1000).toFixed(1)}C${c
    .slice(2)
    .map((v) => (v * 1000).toFixed(1))
    .join(" ")}`;
