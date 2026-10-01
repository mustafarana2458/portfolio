"use client";

import { useEffect, useRef } from "react";
import type { WireCurve } from "@/lib/wires";

const STEPS = 16;
const at = (c: WireCurve, t: number) => {
  const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return [w0 * c[0] + w1 * c[2] + w2 * c[4] + w3 * c[6], w0 * c[1] + w1 * c[3] + w2 * c[5] + w3 * c[7]];
};

/**
 * 2-3 small packets on a wire field. Web Animations on `transform` only, so they run on the
 * compositor (no per-frame JS, no paint). Keyframes are rebuilt from the strip sizes on resize.
 * Played only while the field is on screen; never on phones or for reduced motion.
 */
export default function WirePackets({ packets, color }: { packets: { strip: "top" | "bottom"; c: WireCurve }[]; color: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    if (!window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)").matches) return;
    const field = el.parentElement!;
    const dots = Array.from(el.children) as HTMLElement[];
    let anims: Animation[] = [];
    let inView = false;

    const build = () => {
      anims.forEach((a) => a.cancel());
      const fieldH = field.clientHeight;
      anims = packets.map((p, i) => {
        const strip = field.querySelector<HTMLElement>(`[data-strip="${p.strip}"]`)!;
        const w = strip.clientWidth, h = strip.clientHeight, top = p.strip === "top" ? 0 : fieldH - h;
        const frames: Keyframe[] = [];
        for (let k = 0; k <= STEPS; k++) {
          const t = k / STEPS;
          const [x, y] = at(p.c, t);
          frames.push({ transform: `translate3d(${x * w}px,${top + y * h}px,0)`, opacity: t < 0.1 || t > 0.9 ? 0 : 1, offset: t });
        }
        const a = dots[i].animate(frames, { duration: 3400 + i * 700, delay: i * 900, iterations: Infinity, easing: "ease-in-out" });
        if (!inView) a.pause();
        return a;
      });
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(field);
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      anims.forEach((a) => (inView ? a.play() : a.pause()));
    });
    io.observe(field);
    return () => {
      ro.disconnect();
      io.disconnect();
      anims.forEach((a) => a.cancel());
    };
  }, [packets]);

  return (
    <div ref={root} className="absolute inset-0 max-md:hidden motion-reduce:hidden">
      {packets.map((_, i) => (
        <span
          key={i}
          className="absolute left-[-3px] top-[-3px] h-[6px] w-[6px] rounded-full"
          style={{ background: color, boxShadow: `0 0 8px 2px ${color}55`, opacity: 0 }}
        />
      ))}
    </div>
  );
}
