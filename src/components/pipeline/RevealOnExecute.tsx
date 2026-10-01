"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, useGSAP, layerWhileAnimating } from "@/lib/gsap";

type Props = { children: ReactNode; as?: ElementType; className?: string; stagger?: number };

/**
 * Content that appears when its node executes (the pipeline packet reaches it).
 * Hidden state is only applied for motion-OK users, and only while the node is still idle,
 * so no-JS / reduced-motion / already-executed nodes always show their content.
 */
export default function RevealOnExecute({ children, as: Tag = "div", className, stagger = 0.08 }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current!;
      const node = el.closest("[data-node]");
      // Phones: content shows as-is (the node's flash marks the execution); sliding whole
      // blocks in costs a large repaint or layer raster per reveal on a 390px screen.
      if (!node || window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 767px)").matches) return;
      if (node.getAttribute("data-state") === "success") return;
      // Only hide what's still below the packet line; content already above it shows now.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.6) return;
      const targets = stagger ? Array.from(el.children) : [el];
      gsap.set(targets, { autoAlpha: 0, y: 24 });
      const play = () => gsap.to(targets, { autoAlpha: 1, y: 0, duration: 0.9, stagger, ease: "expo.out", delay: 0.15, ...layerWhileAnimating(targets) });
      node.addEventListener("node:success", play, { once: true });
      return () => node.removeEventListener("node:success", play);
    },
    { scope: ref }
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
