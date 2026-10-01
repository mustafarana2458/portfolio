"use client";

import { useEffect, useRef } from "react";
import { isLite } from "@/lib/utils";

const SAMPLES = 64;
const DUR = 2.4; // seconds per edge
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Packets for <AgentGraphCover>: HTML dots over the SVG, moved with transforms only (no
 * SVG/SMIL animation, so nothing is repainted). Each edge is sampled once into a lookup
 * table; the loop runs only while the cover is on screen and the tab is visible. Weaker phones
 * (html.lite) get the dots parked mid-edge with no loop; reduced motion gets no dots.
 */
export default function CoverPackets({ paths, width, height }: { paths: string[]; width: number; height: number }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dots = Array.from(el.children) as HTMLElement[];

    // Lookup tables in viewBox units.
    // measured inside an attached (hidden) SVG: detached geometry isn't reliable everywhere
    const ns = "http://www.w3.org/2000/svg";
    const host = document.createElementNS(ns, "svg");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    const probe = document.createElementNS(ns, "path");
    host.appendChild(probe);
    el.appendChild(host);
    const luts = paths.map((d) => {
      probe.setAttribute("d", d);
      const len = probe.getTotalLength();
      const pts = new Float32Array(SAMPLES * 2 + 2);
      for (let k = 0; k <= SAMPLES; k++) {
        const p = probe.getPointAtLength((len * k) / SAMPLES);
        pts[k * 2] = p.x;
        pts[k * 2 + 1] = p.y;
      }
      return pts;
    });
    host.remove();

    // viewBox → element pixels (preserveAspectRatio "xMidYMid meet")
    let s = 1, ox = 0, oy = 0;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      s = Math.min(w / width, h / height);
      ox = (w - width * s) / 2;
      oy = (h - height * s) / 2;
      dots.forEach((d) => (d.style.setProperty("--s", String(s))));
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      if (still) draw(0);
    });
    ro.observe(el);

    const still = isLite();
    let raf = 0, inView = false;
    const draw = (t: number) =>
      luts.forEach((pts, i) => {
        const phase = still ? 0.5 : ((t + i * 0.6) % DUR) / DUR;
        const f = ease(phase) * SAMPLES;
        const k = Math.min(SAMPLES - 1, Math.floor(f));
        const u = f - k;
        const x = pts[k * 2] + (pts[k * 2 + 2] - pts[k * 2]) * u;
        const y = pts[k * 2 + 1] + (pts[k * 2 + 3] - pts[k * 2 + 1]) * u;
        dots[i].style.transform = `translate3d(${ox + x * s}px,${oy + y * s}px,0)`;
      });
    const frame = (now: number) => {
      raf = 0;
      if (!inView || document.hidden) return;
      raf = requestAnimationFrame(frame);
      draw(now / 1000);
    };
    const kick = () => {
      if (still) return draw(0);
      if (!raf && inView && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      el.style.opacity = inView ? "1" : "0";
      kick();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", kick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", kick);
    };
  }, [paths, width, height]);

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 opacity-0 motion-reduce:hidden">
      {paths.map((_, i) => (
        <span
          key={i}
          className="absolute left-0 top-0"
          style={{ willChange: "transform", width: 0, height: 0 }}
        >
          <span
            className="absolute rounded-full"
            style={{
              width: "calc(44px * var(--s, 1))",
              height: "calc(44px * var(--s, 1))",
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle, rgb(255 107 53 / 0.6), rgb(255 107 53 / 0) 70%)",
            }}
          />
          <span
            className="absolute rounded-full bg-accent"
            style={{ width: "calc(14px * var(--s, 1))", height: "calc(14px * var(--s, 1))", transform: "translate(-50%, -50%)" }}
          />
        </span>
      ))}
    </div>
  );
}
