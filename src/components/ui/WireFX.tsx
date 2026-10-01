"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildWireField, type WireCurve, type WireStrip } from "@/lib/wires";
import { registerField, type FxStrip } from "@/lib/wireFx";
import { cn, isLite } from "@/lib/utils";

type Kind = "project" | "section" | "card";
const NONE: never[] = [];

const STEPS = 16;
const at = (c: WireCurve, t: number) => {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return [w0 * c[0] + w1 * c[2] + w2 * c[4] + w3 * c[6], w0 * c[1] + w1 * c[3] + w2 * c[5] + w3 * c[7]];
};
/** Plug wires (see <Plug>, 100x100 box), drawn toward the port: two into "in", one out of "out". */
const PLUG_RUNS: { side: "in" | "out"; c: WireCurve }[] = [
  { side: "in", c: [0, 12, 40, 12, 60, 50, 100, 50] },
  { side: "in", c: [0, 88, 40, 88, 60, 50, 100, 50] },
  { side: "out", c: [0, 50, 40, 50, 60, 12, 100, 12] },
];

/** Keyframes for a packet along normalised curve `c`, mapped into the box (x, y, w, h). */
function runFrames(c: WireCurve, x: number, y: number, w: number, h: number, fade = 0.1): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const [px, py] = at(c, t);
    frames.push({ transform: `translate3d(${x + px * w}px,${y + py * h}px,0)`, opacity: t < fade || t > 1 - fade ? 0 : 1, offset: t });
  }
  return frames;
}

/**
 * The live part of a wire field (the static SVG stays as rendered):
 * - 2-3 idle packets on the top/bottom strips (Web Animations on transform/opacity, so they
 *   run on the compositor). Phones run 2.
 * - Project / client cards "execute" while hovered (desktop) or while the card is ≥60% on
 *   screen (touch): the field lights up in the card's colour (a cloned copy of the strips with
 *   edges at 40%, faded in with opacity), packets run 2x, and 3 extra packets run into the
 *   card's ports (client cards: along the card's strip).
 * - Registers the field with lib/wireFx (cursor bend + click bursts).
 * Everything runs only while the field is on screen. Reduced motion or html.lite: nothing.
 */
export default function WireFX({ seed, labels, across, color, kind }: { seed: string; labels: string[]; across?: number; color: string; kind: Kind }) {
  const root = useRef<HTMLDivElement>(null);
  const f = useMemo(() => buildWireField(seed, labels, across ? { across } : undefined), [seed, labels, across]);
  const base = kind === "card" ? NONE : f.packets;
  const extra = kind === "section" ? 0 : 3;

  useEffect(() => {
    const el = root.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || isLite()) return;
    const field = el.parentElement!;
    const strips: Record<string, WireStrip> = kind === "card" ? { card: f.bottom } : { top: f.top, bottom: f.bottom, left: f.left, right: f.right };
    const fxStrips: FxStrip[] = Object.entries(strips).flatMap(([name, s]) => {
      const sEl = field.querySelector<HTMLElement>(`:scope > [data-strip="${name}"]`);
      return sEl ? [{ el: sEl, edges: s.edges, nodes: s.nodes }] : [];
    });
    const unregister = registerField(field, color, fxStrips);

    const phone = window.matchMedia("(max-width: 767px)").matches;
    const liveBase = phone ? base.slice(0, 2) : base;
    const dots = Array.from(el.children) as HTMLElement[];
    const baseDots = dots.slice(0, base.length);
    const extraDots = dots.slice(base.length);
    let anims: Animation[] = [];
    let extras: Animation[] = [];
    let inView = false;
    let lit = false;

    const syncPlay = () => {
      anims.forEach((a) => {
        a.updatePlaybackRate(lit ? 2 : 1);
        if (inView) a.play();
        else a.pause();
      });
      extras.forEach((a) => (lit && inView ? a.play() : a.cancel()));
    };

    const build = () => {
      anims.forEach((a) => a.cancel());
      extras.forEach((a) => a.cancel());
      const fr = field.getBoundingClientRect();
      anims = liveBase.map((p, i) => {
        const strip = field.querySelector<HTMLElement>(`:scope > [data-strip="${p.strip}"]`)!;
        const w = strip.clientWidth, h = strip.clientHeight, top = p.strip === "top" ? 0 : fr.height - h;
        const a = baseDots[i].animate(runFrames(p.c, 0, top, w, h), { duration: 3400 + i * 700, delay: i * 900, iterations: Infinity, easing: "ease-in-out" });
        a.pause();
        return a;
      });
      if (kind === "project") {
        const plugs = Object.fromEntries(
          Array.from(field.querySelectorAll<SVGSVGElement>(":scope > [data-plug]")).map((p) => [p.dataset.plug!, p.getBoundingClientRect()])
        );
        extras = PLUG_RUNS.flatMap((run, i) => {
          const r = plugs[run.side];
          if (!r || !r.width) return [];
          const a = extraDots[i].animate(runFrames(run.c, r.left - fr.left, r.top - fr.top, r.width, r.height, 0.15), {
            duration: 1100,
            delay: i * 360,
            iterations: Infinity,
            easing: "cubic-bezier(0.45,0,0.55,1)",
          });
          a.cancel();
          return [a];
        });
      } else if (kind === "card") {
        const strip = fxStrips[0]?.el;
        const longest = [...f.bottom.edges].filter((e) => !phone || e.mobile).sort((p, q) => q.c[6] - q.c[0] - (p.c[6] - p.c[0]));
        extras = strip
          ? longest.slice(0, extra).map((e, i) => {
              const a = extraDots[i].animate(runFrames(e.c, 0, 0, strip.clientWidth, strip.clientHeight), {
                duration: 1300 + i * 250,
                delay: i * 300,
                iterations: Infinity,
                easing: "ease-in-out",
              });
              a.cancel();
              return a;
            })
          : [];
      }
      syncPlay();
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(field);
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      syncPlay();
    });
    io.observe(field);

    // Lit copy of every strip, built on first use.
    let built = false;
    const buildLit = () => {
      built = true;
      for (const s of fxStrips) {
        const wrap = document.createElement("div");
        wrap.className = "wire-lit";
        for (const child of Array.from(s.el.children)) {
          if (child.tagName.toLowerCase() === "svg") {
            const svg = child.cloneNode(true) as SVGSVGElement;
            svg.querySelectorAll("path").forEach((p) => p.setAttribute("stroke-opacity", "0.4"));
            wrap.appendChild(svg);
          } else if (child.tagName === "SPAN") {
            const n = child.cloneNode() as HTMLSpanElement;
            n.style.borderColor = color;
            wrap.appendChild(n);
          }
        }
        s.el.appendChild(wrap);
      }
    };
    const setLit = (on: boolean) => {
      if (on === lit) return;
      lit = on;
      if (on && !built) buildLit();
      field.toggleAttribute("data-wire-lit", on);
      syncPlay();
    };

    // Hover (desktop) or ≥60% on screen (touch).
    const hoverRoot =
      kind === "project"
        ? field.parentElement?.querySelector<HTMLElement>(":scope > [data-hover-root]")
        : kind === "card"
          ? field.closest<HTMLElement>("[data-hover-root]")
          : null;
    const off: (() => void)[] = [];
    if (hoverRoot) {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const on = () => setLit(true);
        const leave = () => setLit(false);
        const focusOut = (e: FocusEvent) => !hoverRoot.contains(e.relatedTarget as Node) && setLit(false);
        hoverRoot.addEventListener("pointerenter", on);
        hoverRoot.addEventListener("pointerleave", leave);
        hoverRoot.addEventListener("focusin", on);
        hoverRoot.addEventListener("focusout", focusOut);
        off.push(() => {
          hoverRoot.removeEventListener("pointerenter", on);
          hoverRoot.removeEventListener("pointerleave", leave);
          hoverRoot.removeEventListener("focusin", on);
          hoverRoot.removeEventListener("focusout", focusOut);
        });
      } else {
        // A card can be taller than the screen: 60% of whichever is smaller.
        const seen = new IntersectionObserver(
          ([e]) => {
            const h = Math.min(e.boundingClientRect.height, e.rootBounds?.height ?? window.innerHeight);
            setLit(h > 0 && e.intersectionRect.height >= h * 0.6);
          },
          { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
        );
        seen.observe(hoverRoot);
        off.push(() => seen.disconnect());
      }
    }

    return () => {
      off.forEach((o) => o());
      ro.disconnect();
      io.disconnect();
      anims.forEach((a) => a.cancel());
      extras.forEach((a) => a.cancel());
      unregister();
    };
  }, [f, kind, color, base, extra]);

  return (
    <div ref={root} className="absolute inset-0 motion-reduce:hidden">
      {base.map((_, i) => (
        <span
          key={i}
          className={cn("absolute left-[-3px] top-[-3px] h-[6px] w-[6px] rounded-full", i >= 2 && "max-md:hidden")}
          style={{ background: color, boxShadow: `0 0 8px 2px ${color}55`, opacity: 0 }}
        />
      ))}
      {Array.from({ length: extra }, (_, i) => (
        <span
          key={`x${i}`}
          className="absolute left-[-3px] top-[-3px] h-[6px] w-[6px] rounded-full"
          style={{ background: color, boxShadow: `0 0 8px 2px ${color}77`, opacity: 0 }}
        />
      ))}
    </div>
  );
}
