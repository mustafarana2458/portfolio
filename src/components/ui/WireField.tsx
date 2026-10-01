import type { CSSProperties } from "react";
import { buildWireField, curveD, type WireStrip } from "@/lib/wires";
import { cn } from "@/lib/utils";
import WireFX from "./WireFX";

// Background "wire field" around a card: the hero network's style, much quieter, tinted per
// project. Static inline SVG generated at build time (seeded, so it's stable); no canvas, no
// filters. It paints at z-index -1 inside <main>'s stacking context, i.e. beneath all page
// content, like the global pipeline (see globals.css #main). Small "plugs" at the card's ports
// join it to the pipeline where the pipeline enters and leaves the node.

type Variant = "project" | "section";

/** How far the field reaches past the card: half the gap between cards, and the side gutter. */
const VARS: Record<Variant, string> = {
  project: "[--wy:2rem] md:[--wy:3rem] [--wx:max(var(--gutter),calc((100vw_-_1440px)/2))]",
  section: "[--wy:5rem] md:[--wy:7rem] [--wx:max(var(--gutter),calc((100vw_-_1280px)/2))]",
};

const H_MASK = "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)";
const V_MASK = "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)";

function Strip({ strip, color, mask, className, style, name }: { strip: WireStrip; color: string; mask: string; className: string; style?: CSSProperties; name: string }) {
  return (
    // Fade the strip ends with a mask on larger screens; phones get the plain static SVG.
    <div
      data-strip={name}
      className={cn("absolute md:[-webkit-mask-image:var(--wire-mask)] md:[mask-image:var(--wire-mask)]", className)}
      style={{ ...style, ["--wire-mask" as string]: mask }}
    >
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {strip.edges.map((e, i) => (
          <path
            key={i}
            d={curveD(e.c)}
            fill="none"
            stroke={color}
            strokeOpacity="0.15"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            className={e.mobile ? undefined : "max-md:hidden"}
          />
        ))}
      </svg>
      {strip.nodes.map((n, i) => (
        <span
          key={i}
          className={cn("absolute rounded-full border bg-bg", n.big ? "h-[9px] w-[9px]" : "h-[6px] w-[6px]", !n.mobile && "max-md:hidden")}
          style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, transform: "translate(-50%,-50%)", borderColor: `${color}66` }}
        />
      ))}
    </div>
  );
}

/** Two short wires fanning out of a node port into the field. `side` = which port. */
function Plug({ side, color }: { side: "in" | "out"; color: string }) {
  const d =
    side === "in"
      ? ["M100 50 C60 50 40 12 0 12", "M100 50 C60 50 40 88 0 88"]
      : ["M0 50 C40 50 60 12 100 12", "M0 50 C40 50 60 88 100 88"];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-plug={side}
      className={cn("wire-plug absolute h-14", side === "in" ? "left-0" : "right-0")}
      style={{ width: "var(--wx)", top: "calc(var(--wy) + var(--node-header-h) / 2 - 1.75rem)" }}
    >
      {d.map((p) => (
        <path key={p} d={p} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function WireField({ seed, color, labels, variant = "project", ports = "both" }: { seed: string; color: string; labels: string[]; variant?: Variant; ports?: "both" | "in" | "out" | "none" }) {
  const f = buildWireField(seed, labels);
  return (
    <div
      aria-hidden
      data-wire-field=""
      data-wire-color={color}
      className={cn("pointer-events-none absolute z-[-1]", VARS[variant])}
      style={{ inset: "calc(-1 * var(--wy)) calc(-1 * var(--wx))" }}
    >
      <Strip name="top" strip={f.top} color={color} mask={H_MASK} className="inset-x-0 top-0" style={{ height: "var(--wy)" }} />
      <Strip name="bottom" strip={f.bottom} color={color} mask={H_MASK} className="inset-x-0 bottom-0" style={{ height: "var(--wy)" }} />
      <Strip name="left" strip={f.left} color={color} mask={V_MASK} className="left-0 max-md:hidden" style={{ top: "var(--wy)", bottom: "var(--wy)", width: "var(--wx)" }} />
      <Strip name="right" strip={f.right} color={color} mask={V_MASK} className="right-0 max-md:hidden" style={{ top: "var(--wy)", bottom: "var(--wy)", width: "var(--wx)" }} />
      {(ports === "both" || ports === "in") && <Plug side="in" color={color} />}
      {(ports === "both" || ports === "out") && <Plug side="out" color={color} />}
      {f.labels.map((l, k) => (
        <span
          key={l.text}
          // phones keep the first three
          className={cn("wire-label absolute whitespace-nowrap font-mono text-[12px] leading-none", k >= 3 && "max-md:hidden")}
          style={{
            left: `calc(${l.x * 100}% + 10px)`,
            ...(l.strip === "top"
              ? { top: `calc(var(--wy) * ${l.y} - 6px)` }
              : { bottom: `calc(var(--wy) * ${1 - l.y} - 6px)` }),
            color,
          }}
        >
          {l.text}
        </span>
      ))}
      <WireFX seed={seed} labels={labels} color={color} kind={variant} />
    </div>
  );
}

/** Client cards: one static strip along the card's bottom edge, faded out under the text. */
export function CardWires({ seed, color, labels }: { seed: string; color: string; labels: string[] }) {
  const f = buildWireField(seed, labels, { across: 7 });
  const mask = "linear-gradient(to right, transparent 35%, #000 70%, #000 94%, transparent)";
  return (
    <div aria-hidden data-wire-field="" className="pointer-events-none absolute inset-x-0 bottom-0 z-[-1] h-14 overflow-hidden rounded-b-2xl">
      <Strip name="card" strip={f.bottom} color={color} mask={mask} className="inset-0" />
      <WireFX seed={seed} labels={labels} across={7} color={color} kind="card" />
    </div>
  );
}
