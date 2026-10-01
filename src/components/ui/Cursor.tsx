"use client";

import { useRef } from "react";
import { gsap, useDeferredGSAP, MQ } from "@/lib/gsap";

const INTERACTIVE = "a[href], button, input, select, textarea, [role='option']";
const REACH = 120; // px: how close the cursor must be for an edge to reach out

/**
 * Cursor as a node port. Near a link/button, an orange edge reaches from the port to the
 * element's closest point (data flowing to what you're about to click); inside it, the port
 * grows. Fine pointers only, motion-OK only; the ring moves with transforms.
 */
export default function Cursor() {
  const port = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const edge = useRef<SVGPathElement>(null);
  const target = useRef<SVGCircleElement>(null);

  useDeferredGSAP(() => {
    gsap.matchMedia().add(MQ.finePointer, () => {
      document.documentElement.classList.add("has-cursor");
      gsap.set(port.current, { xPercent: -50, yPercent: -50, opacity: 0 });
      const px = gsap.quickTo(port.current, "x", { duration: 0.16, ease: "power3" });
      const py = gsap.quickTo(port.current, "y", { duration: 0.16, ease: "power3" });

      let mx = 0, my = 0, raf = 0, lastDraw = 0, inside: Element | null = null;
      const draw = (now: number) => {
        raf = 0;
        if (now - lastDraw < 32) {
          raf = requestAnimationFrame(draw); // throttle the rect scan to ~30Hz
          return;
        }
        lastDraw = now;
        let best: DOMRect | null = null, bd = REACH, bx = 0, by = 0;
        if (!inside) {
          for (const el of document.querySelectorAll(INTERACTIVE)) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
            const cx = Math.max(r.left, Math.min(mx, r.right));
            const cy = Math.max(r.top, Math.min(my, r.bottom));
            const d = Math.hypot(mx - cx, my - cy);
            if (d > 6 && d < bd) (bd = d), (best = r), (bx = cx), (by = cy);
          }
        }
        if (best) {
          const dx = Math.max(24, Math.abs(bx - mx) * 0.5);
          const dir = bx >= mx ? 1 : -1;
          edge.current!.setAttribute("d", `M${mx} ${my} C${mx + dx * dir} ${my} ${bx - dx * dir} ${by} ${bx} ${by}`);
          target.current!.setAttribute("cx", String(bx));
          target.current!.setAttribute("cy", String(by));
          svg.current!.style.opacity = String(Math.min(1, (1 - bd / REACH) * 1.6));
        } else {
          svg.current!.style.opacity = "0";
        }
      };
      const move = (e: PointerEvent) => {
        mx = e.clientX;
        my = e.clientY;
        px(mx);
        py(my);
        if (!raf) raf = requestAnimationFrame(draw);
      };
      const over = (e: PointerEvent) => {
        inside = (e.target as Element).closest?.(INTERACTIVE) ?? null;
        gsap.to(port.current, { scale: inside ? 2 : 1, duration: 0.3, ease: "power3" });
        port.current!.classList.toggle("border-accent", !!inside);
      };
      const show = () => gsap.to(port.current, { opacity: 1, duration: 0.3 });
      const hide = () => {
        gsap.to(port.current, { opacity: 0, duration: 0.3 });
        svg.current!.style.opacity = "0";
      };

      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerover", over, { passive: true });
      window.addEventListener("scroll", hide, { passive: true });
      document.addEventListener("pointerleave", hide);
      window.addEventListener("pointermove", show, { passive: true });
      return () => {
        cancelAnimationFrame(raf);
        document.documentElement.classList.remove("has-cursor");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerover", over);
        window.removeEventListener("scroll", hide);
        document.removeEventListener("pointerleave", hide);
        window.removeEventListener("pointermove", show);
      };
    });
  });

  return (
    <>
      <svg
        ref={svg}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[99] hidden h-full w-full transition-opacity duration-200 pointer-fine:block"
        style={{ opacity: 0 }}
      >
        <path ref={edge} fill="none" stroke="rgb(255,107,53)" strokeWidth="1.2" strokeDasharray="3 4" />
        <circle ref={target} r="3" fill="rgb(255,107,53)" />
      </svg>
      <div
        ref={port}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] hidden h-3 w-3 rounded-full border border-fg/70 bg-bg/40 opacity-0 transition-colors pointer-fine:block"
      />
    </>
  );
}
