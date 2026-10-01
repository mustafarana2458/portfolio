"use client";

import { useCallback, useEffect, useState } from "react";
import HeroCanvas from "./HeroCanvas";
import HeroNetworkSvg from "./HeroNetworkSvg";

/**
 * Hero background: the static SVG network paints with the HTML; for motion-OK users the
 * live canvas mounts and cross-fades over it. Reduced motion keeps the SVG only.
 */
export default function HeroNetwork() {
  const [motionOk, setMotionOk] = useState(false);
  const [canvasOn, setCanvasOn] = useState(false);
  const onActive = useCallback((a: boolean) => setCanvasOn(a), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const update = () => setMotionOk(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    // The network spans the full hero width and dissolves into the next section at the bottom.
    // A radial vignette on top keeps the headline readable.
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          maskImage: "linear-gradient(to top, transparent 0%, #000 22%)",
          WebkitMaskImage: "linear-gradient(to top, transparent 0%, #000 22%)",
        }}
      >
        <HeroNetworkSvg
          className="absolute inset-0 h-full w-full transition-opacity duration-700"
          style={{ opacity: canvasOn ? 0 : 1 }}
        />
        {motionOk && <HeroCanvas onActive={onActive} />}
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 52% 58% at 30% 50%, rgb(var(--bg) / 0.86) 0%, rgb(var(--bg) / 0.55) 48%, transparent 78%), radial-gradient(ellipse 120% 90% at 50% 45%, transparent 60%, rgb(var(--bg) / 0.65) 100%)",
        }}
      />
    </div>
  );
}
