"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { onSiteReady } from "./utils";

// Register once, client-side only.
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
  gsap.defaults({ ease: "expo.out", duration: 1.1 });
}

/** gsap.matchMedia conditions shared by every animated component. */
export const MQ = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
  mobile: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
  finePointer: "(pointer: fine) and (prefers-reduced-motion: no-preference)",
} as const;

// ── Deferred setup ────────────────────────────────────────────
// Below-the-fold animations don't need to exist during hydration. Each component
// schedules its setup in its own idle task after the preloader, which keeps the
// hydration commit short (better TBT / LCP). Scroll-driven work doesn't use ScrollTrigger:
// reveals use one shared IntersectionObserver (lib/reveal.ts), the pipeline its own listener.

type Idle = (cb: () => void) => number;
const idle: Idle =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 600 })
    : (cb) => window.setTimeout(cb, 1);
const cancelIdle = (id: number) =>
  typeof window.cancelIdleCallback === "function" ? window.cancelIdleCallback(id) : clearTimeout(id);


/**
 * Like useGSAP, but the setup runs after the preloader, in an idle task.
 * Everything created inside is recorded in the gsap context and reverted on unmount.
 */
export function useDeferredGSAP(setup: () => void, scope?: RefObject<Element>) {
  useGSAP(
    (_ctx, contextSafe) => {
      let id: number | undefined;
      let done = false;
      const run = contextSafe!(() => {
        if (done) return;
        done = true;
        setup();
      });
      const off = onSiteReady(() => {
        id = idle(run);
      });
      return () => {
        off();
        if (id !== undefined) cancelIdle(id);
        done = true;
      };
    },
    { scope }
  );
}

/**
 * Tween callbacks that promote targets to their own compositor layer only while they animate,
 * so a reveal never repaints the page layer, and layers don't pile up afterwards.
 */
export function layerWhileAnimating(targets: Element[] | Element) {
  const els = Array.isArray(targets) ? targets : [targets];
  return {
    onStart: () => els.forEach((el) => ((el as HTMLElement).style.willChange = "transform, opacity")),
    onComplete: () => els.forEach((el) => ((el as HTMLElement).style.willChange = "")),
  };
}

export { gsap, useGSAP };
