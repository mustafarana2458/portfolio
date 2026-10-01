"use client";

import { Fragment, useRef, type ElementType } from "react";
import { gsap, useGSAP, useDeferredGSAP, MQ, layerWhileAnimating } from "@/lib/gsap";
import { cn, onSiteReady, parseAccent } from "@/lib/utils";
import { revealOnce } from "@/lib/reveal";

type Props = {
  text: string;
  as?: ElementType;
  className?: string;
  /** "scroll" reveals when scrolled into view; "ready" plays once the preloader is done. */
  trigger?: "scroll" | "ready";
  delay?: number;
  stagger?: number;
};

/**
 * Words are split on the server, so there's no layout shift and no SplitText cost.
 * `*word*` in the text gets the accent gradient.
 */
export default function SplitReveal({
  text,
  as: Tag = "h2",
  className,
  trigger = "scroll",
  delay = 0,
  stagger = 0.06,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const words = parseAccent(text);

  const build = () => {
    // Phones: the heading rises as one block (one tween, one temporary layer) instead of a
    // per-word stagger, which keeps scroll-time style and layer work low.
    if (window.matchMedia("(max-width: 767px)").matches) {
      const el = ref.current!;
      return gsap.from(el, { ...layerWhileAnimating(el), y: 28, autoAlpha: 0, duration: 0.8, delay, paused: true, ease: "expo.out" });
    }
    const words = Array.from(ref.current!.querySelectorAll(".split-word"));
    return gsap.from(words, {
      ...layerWhileAnimating(words),
      yPercent: 115,
      rotate: 4,
      duration: 1.2,
      stagger,
      delay,
      paused: true,
      ease: "expo.out",
    });
  };

  // Above the fold: set up during hydration, play when the preloader finishes.
  useGSAP(
    () => {
      if (trigger !== "ready") return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tween = build();
        return onSiteReady(() => tween.play());
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  // Below the fold: deferred until after the preloader.
  useDeferredGSAP(() => {
    if (trigger !== "scroll") return;
    gsap.matchMedia().add(MQ.motion, () => {
      const tween = build();
      return revealOnce(ref.current!, () => tween.play());
    });
  }, ref);

  // Full text for assistive tech; the split spans are presentational.
  const plain = words.map((w) => w.word).join(" ");

  return (
    <Tag ref={ref} className={cn(className)} aria-label={plain}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span aria-hidden className="split-mask">
            <span className={cn("split-word", w.accent && "accent-serif")}>{w.word}</span>
          </span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </Tag>
  );
}
