"use client";

import { useRef, type ReactNode } from "react";
import ExportedImage from "next-image-export-optimizer";
import { gsap, useGSAP, useDeferredGSAP, MQ } from "@/lib/gsap";
import { revealOnce } from "@/lib/reveal";
import { cn, onSiteReady } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  trigger?: "scroll" | "ready";
  delay?: number;
  /** Rendered inside the frame, behind the image (e.g. a glow behind a cutout). */
  underlay?: ReactNode;
  /** false = no mask reveal (for above-the-fold images that must paint immediately). */
  reveal?: boolean;
};

/**
 * Mask reveal done with transforms only: a surface-colored cover scales away
 * while the image settles from a slight zoom.
 */
export default function RevealImage({
  src,
  alt,
  sizes,
  className,
  imgClassName,
  priority,
  trigger = "scroll",
  delay = 0,
  underlay,
  reveal = true,
}: Props) {
  const root = useRef<HTMLDivElement>(null);

  const build = () =>
    gsap
      .timeline({ paused: true, delay })
      .fromTo(root.current!.querySelector(".ri-cover"), { scaleY: 1 }, { scaleY: 0, duration: 1.2, ease: "expo.inOut" })
      .from(root.current!.querySelector(".ri-img"), { scale: 1.3, duration: 1.6, ease: "expo.out" }, 0.15);

  // Above the fold (hero): hidden state must exist before the preloader lifts.
  useGSAP(
    () => {
      if (trigger !== "ready" || !reveal) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tl = build();
        return onSiteReady(() => tl.play());
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  // Scroll reveal + parallax are set up after the preloader, off the hydration path.
  useDeferredGSAP(() => {
    const mm = gsap.matchMedia();
    if (trigger === "scroll" && reveal) {
      mm.add(MQ.motion, () => {
        const tl = build();
        return revealOnce(root.current!, () => tl.play());
      });
    }
  }, root);

  return (
    <div ref={root} className={cn("relative overflow-hidden", className)}>
      {underlay}
      <div className="absolute inset-0">
        <div className="ri-img relative h-full w-full">
          <ExportedImage
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn("object-cover", imgClassName)}
          />
        </div>
      </div>
      {reveal && <div aria-hidden className="ri-cover pointer-events-none absolute inset-0 origin-top scale-y-0 bg-surface" />}
    </div>
  );
}
