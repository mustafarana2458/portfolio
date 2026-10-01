// Shared, deterministic layout for the hero network so the server-rendered SVG
// fallback and the live canvas start from the same picture (no visual jump).

export type NetNode = { x: number; y: number; r: number; phase: number; big: boolean };
export type NetEdge = [number, number];

/** Mono labels the live canvas puts on a few nodes that sit clear of the hero text. */
export const NODE_LABELS = ["webhook", "LLM", "CRM", "invoice", "deploy"];

/** Small seeded PRNG (mulberry32): same seed → same layout on server and client. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nodes in normalised 0..1 space, spread with jittered-grid sampling; edges to k nearest. */
export function buildNetwork(count: number, seed = 7, k = 2) {
  const rand = rng(seed);
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);
  const nodes: NetNode[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    nodes.push({
      x: (c + 0.15 + rand() * 0.7) / cols,
      y: (r + 0.15 + rand() * 0.7) / rows,
      r: 2 + rand() * 2,
      phase: rand() * Math.PI * 2,
      big: rand() < 0.18,
    });
  }
  const seen = new Set<string>();
  const edges: NetEdge[] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 * 1.6 + (a.y - b.y) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, k)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          // Edges always flow left → right, like a workflow.
          edges.push(a.x <= nodes[j].x ? [i, j] : [j, i]);
        }
      });
  });
  return { nodes, edges };
}

/** Horizontal-tangent cubic (n8n edge shape) between two points. */
export function edgeControls(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.max(40, Math.abs(bx - ax) * 0.5);
  return [ax + dx, ay, bx - dx, by] as const;
}

export function cubicAt(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
