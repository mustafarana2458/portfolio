"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildWireField, type WireCurve, type WireStrip } from "@/lib/wires";
import { boostField, pulseField, registerField, type FxStrip } from "@/lib/wireFx";
import { isLite } from "@/lib/utils";

type Kind = "project" | "section" | "card";

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
/** Client cards fade their strip out under the text (see CardWires): no packets there. */
const CARD_MIN_X = 0.45;

/**
 * Touch devices: "power on" the first time a field scrolls into view. Its wires draw in
 * (stroke-dashoffset, ~600ms) and a packet burst runs from the port plugs into the card.
 * Only fields still below the fold at mount take part. Their wires are hidden ("armed") once
 * the field is within a screen of the viewport, so only a few fields hold dashed paths at a
 * time. Returns a cleanup.
 */
function powerOn(field: HTMLElement, root: HTMLElement, color: string): () => void {
  if (field.getBoundingClientRect().top < window.innerHeight) return () => {};
  // Visible strip + plug paths. With vector-effect non-scaling-stroke, WebKit and Chromium both
  // measure dashes in screen px, so each path's dash is its on-screen length.
  let paths: SVGPathElement[] = [];
  let lens: number[] = [];
  const anims: Animation[] = [];
  const reset = () => paths.forEach((p) => ((p.style.strokeDasharray = ""), (p.style.strokeDashoffset = "")));

  const arm = () => {
    paths = Array.from(field.querySelectorAll<SVGPathElement>(":scope > [data-strip] > svg > path, :scope > [data-plug] > path")).filter(
      (p) => p.getClientRects().length > 0
    );
    lens = paths.map((p) => {
      const svg = p.ownerSVGElement!;
      const vb = svg.viewBox.baseVal;
      const sx = svg.clientWidth / (vb.width || 1), sy = svg.clientHeight / (vb.height || 1);
      const total = p.getTotalLength();
      let len = 0, prev: DOMPoint | null = null;
      for (let k = 0; k <= 16; k++) {
        const q = p.getPointAtLength((total * k) / 16);
        if (prev) len += Math.hypot((q.x - prev.x) * sx, (q.y - prev.y) * sy);
        prev = q;
      }
      return Math.ceil(len) + 2;
    });
    paths.forEach((p, i) => {
      p.style.strokeDasharray = `${lens[i]} ${lens[i]}`;
      p.style.strokeDashoffset = `${lens[i]}`;
    });
  };

  const run = () => {
    paths.forEach((p, i) => {
      const a = p.animate([{ strokeDashoffset: lens[i] }, { strokeDashoffset: 0 }], {
        duration: 600,
        delay: Math.min(i * 18, 220),
        easing: "cubic-bezier(0.3,0.6,0.3,1)",
        fill: "forwards",
      });
      anims.push(a);
    });
    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        reset();
        anims.forEach((a) => a.cancel());
      })
      .catch(() => {});
    // Packet burst: from the plugs' outer ends into the card's ports.
    const fr = field.getBoundingClientRect();
    field.querySelectorAll<SVGSVGElement>(":scope > [data-plug]").forEach((plug) => {
      const r = plug.getBoundingClientRect();
      if (!r.width) return;
      PLUG_RUNS.filter((run) => run.side === plug.dataset.plug).forEach((run, k) => {
        const dot = document.createElement("span");
        dot.className = "absolute left-[-3px] top-[-3px] h-[6px] w-[6px] rounded-full";
        dot.style.cssText += `background:${color};box-shadow:0 0 10px 3px ${color}80;opacity:0`;
        root.appendChild(dot);
        const a = dot.animate(runFrames(run.c, r.left - fr.left, r.top - fr.top, r.width, r.height), {
          duration: 700,
          delay: 300 + k * 140,
          easing: "cubic-bezier(0.45,0,0.55,1)",
        });
        anims.push(a);
        a.finished.then(() => dot.remove()).catch(() => dot.remove());
      });
    });
  };

  let armed = false;
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting || armed) return;
      armed = true;
      near.disconnect();
      arm();
      io.observe(field);
    },
    { rootMargin: "0px 0px 100% 0px" }
  );
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      run();
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  near.observe(field);
  return () => {
    near.disconnect();
    io.disconnect();
    anims.forEach((a) => a.cancel());
    reset();
  };
}

/** Keyframes for a packet along normalised curve `c`, mapped into the box (x, y, w, h). */
function runFrames(c: WireCurve, x: number, y: number, w: number, h: number): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const [px, py] = at(c, t);
    frames.push({ transform: `translate3d(${x + px * w}px,${y + py * h}px,0)`, opacity: t < 0.15 || t > 0.85 ? 0 : 1, offset: t });
  }
  return frames;
}

/**
 * The live part of a wire field (the static SVG stays as rendered):
 * - Registers the field's strips with lib/wireFx, which runs the idle packets (a capped,
 *   rotating page-wide pool: every visible edge gets packets), the cursor bend and click bursts.
 * - Touch: wires draw in once on first scroll into view, with a packet burst from the ports
 *   (powerOn). Packets pause while the tab is hidden.
 * - Project / client cards "execute" while hovered (desktop) or briefly after a tap (touch,
 *   which also pulses the wires nearest the tap): the field lights up in the card's colour (a cloned copy of the strips with
 *   edges at 40%, faded in with opacity), its packets run 2x, and 3 extra packets run into the
 *   card's ports (client cards: along the card's strip).
 * Reduced motion: the static SVG wires still show, nothing animates. html.lite: no field.
 */
export default function WireFX({ seed, labels, across, color, kind }: { seed: string; labels: string[]; across?: number; color: string; kind: Kind }) {
  const root = useRef<HTMLDivElement>(null);
  const f = useMemo(() => buildWireField(seed, labels, across ? { across } : undefined), [seed, labels, across]);
  const extra = kind === "section" ? 0 : 3;

  useEffect(() => {
    const el = root.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || isLite()) return;
    const field = el.parentElement!;
    const strips: Record<string, WireStrip> = kind === "card" ? { card: f.bottom } : { top: f.top, bottom: f.bottom, left: f.left, right: f.right };
    const fxStrips: FxStrip[] = Object.entries(strips).flatMap(([name, s]) => {
      const sEl = field.querySelector<HTMLElement>(`:scope > [data-strip="${name}"]`);
      return sEl ? [{ el: sEl, edges: s.edges, nodes: s.nodes, minX: kind === "card" ? CARD_MIN_X : undefined }] : [];
    });
    const touch = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const unpower = touch ? powerOn(field, el, color) : () => {};
    const unregisterField = registerField(field, color, fxStrips);
    const unregister = () => {
      unpower();
      unregisterField();
    };
    if (!extra) return unregister;

    const phone = window.matchMedia("(max-width: 767px)").matches;
    const dots = Array.from(el.children) as HTMLElement[];
    let extras: Animation[] = [];
    let inView = false;
    let lit = false;

    const syncPlay = () => extras.forEach((a) => (lit && inView && !document.hidden ? a.play() : a.cancel()));
    document.addEventListener("visibilitychange", syncPlay);

    const build = () => {
      extras.forEach((a) => a.cancel());
      if (kind === "project") {
        const fr = field.getBoundingClientRect();
        const plugs = Object.fromEntries(
          Array.from(field.querySelectorAll<SVGSVGElement>(":scope > [data-plug]")).map((p) => [p.dataset.plug!, p.getBoundingClientRect()])
        );
        extras = PLUG_RUNS.flatMap((run, i) => {
          const r = plugs[run.side];
          if (!r || !r.width) return [];
          const a = dots[i].animate(runFrames(run.c, r.left - fr.left, r.top - fr.top, r.width, r.height), {
            duration: 1100,
            delay: i * 360,
            iterations: Infinity,
            easing: "cubic-bezier(0.45,0,0.55,1)",
          });
          a.cancel();
          return [a];
        });
      } else {
        const strip = fxStrips[0]?.el;
        const longest = f.bottom.edges
          .filter((e) => (!phone || e.mobile) && Math.max(e.c[0], e.c[6]) >= CARD_MIN_X)
          .sort((p, q) => q.c[6] - q.c[0] - (p.c[6] - p.c[0]));
        extras = strip
          ? longest.slice(0, extra).map((e, i) => {
              const a = dots[i].animate(runFrames(e.c, 0, 0, strip.clientWidth, strip.clientHeight), {
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
          } else if (child.tagName === "SPAN" && !child.hasAttribute("aria-hidden")) {
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
      boostField(field, on);
      syncPlay();
    };

    // Hover (desktop) or tap (touch).
    const hoverRoot =
      kind === "project"
        ? field.parentElement?.querySelector<HTMLElement>(":scope > [data-hover-root]")
        : field.closest<HTMLElement>("[data-hover-root]");
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
        // Touch: a tap lights the card for a moment and pulses the wires nearest the tap.
        let t = 0;
        const tap = (e: MouseEvent) => {
          pulseField(field, e.clientX, e.clientY);
          setLit(true);
          window.clearTimeout(t);
          t = window.setTimeout(() => setLit(false), 1400);
        };
        hoverRoot.addEventListener("click", tap);
        off.push(() => {
          hoverRoot.removeEventListener("click", tap);
          window.clearTimeout(t);
        });
      }
    }

    return () => {
      off.forEach((o) => o());
      document.removeEventListener("visibilitychange", syncPlay);
      ro.disconnect();
      io.disconnect();
      extras.forEach((a) => a.cancel());
      unregister();
    };
  }, [f, kind, color, extra]);

  return (
    <div ref={root} className="absolute inset-0 motion-reduce:hidden">
      {Array.from({ length: extra }, (_, i) => (
        <span
          key={i}
          className="absolute left-[-3px] top-[-3px] h-[6px] w-[6px] rounded-full"
          style={{ background: color, boxShadow: `0 0 8px 2px ${color}77`, opacity: 0 }}
        />
      ))}
    </div>
  );
}
