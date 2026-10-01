"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "@/lib/gsap";

export default function SmoothScroll() {
  useEffect(() => {
    // Lenis only smooths wheel scrolling; touch devices keep native scroll (and skip the rAF loop).
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;

    const lenis = new Lenis({ lerp: 0.1, anchors: true });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    // One rAF loop: Lenis runs on GSAP's ticker (no separate requestAnimationFrame).
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return null;
}
