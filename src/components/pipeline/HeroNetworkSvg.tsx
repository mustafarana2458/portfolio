import type { CSSProperties } from "react";
import { buildNetwork, edgeControls } from "./network";

/**
 * Static SVG version of the hero network. Server-rendered so the hero paints complete
 * on first frame; it stays as the final picture for reduced-motion users, and the
 * canvas cross-fades over it for everyone else.
 */
const W = 1440;
const H = 900;
const { nodes, edges } = buildNetwork(48);

export default function HeroNetworkSvg({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} style={style}>
      <defs>
        <radialGradient id="hero-node-glow">
          <stop offset="0" stopColor="rgb(255,107,53)" stopOpacity="0.32" />
          <stop offset="1" stopColor="rgb(255,107,53)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2">
        {edges.map(([a, b], i) => {
          const A = nodes[a];
          const B = nodes[b];
          const [c1x, c1y, c2x, c2y] = edgeControls(A.x * W, A.y * H, B.x * W, B.y * H);
          return (
            <path
              key={i}
              d={`M${(A.x * W).toFixed(1)} ${(A.y * H).toFixed(1)}C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${(B.x * W).toFixed(1)} ${(B.y * H).toFixed(1)}`}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x * W} cy={n.y * H} r={n.big ? 18 : 11} fill="url(#hero-node-glow)" />
        ))}
      </g>
      <g>
        {nodes.map((n, i) =>
          n.big ? (
            <rect
              key={i}
              x={n.x * W - 9}
              y={n.y * H - 7}
              width="18"
              height="14"
              rx="4"
              fill="rgb(22,22,26)"
              stroke="rgba(255,255,255,0.5)"
            />
          ) : (
            <circle key={i} cx={n.x * W} cy={n.y * H} r={n.r} fill="rgb(22,22,26)" stroke="rgba(255,255,255,0.45)" />
          )
        )}
      </g>
    </svg>
  );
}
