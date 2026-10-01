"use client";

import { useState } from "react";
import { scrollToId } from "@/lib/utils";

/**
 * "Back to top": a packet leaves the button's rail upward, then the page scrolls home. The
 * global pipeline packet follows the scroll, so it visibly travels back up the whole workflow.
 */
export default function BackToTop() {
  const [launch, setLaunch] = useState(false);

  return (
    <a
      href="#top"
      onClick={(e) => {
        e.preventDefault();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return scrollToId("top");
        setLaunch(true);
        window.setTimeout(() => scrollToId("top"), 320);
        window.setTimeout(() => setLaunch(false), 1400);
      }}
      className="group inline-flex h-12 items-center gap-3 rounded-full border border-fg/20 pl-3 pr-5 text-[15px] text-fg transition-colors hover:border-accent"
    >
      <span aria-hidden className="relative h-7 w-3 overflow-hidden">
        <span className="absolute inset-x-[5px] inset-y-0 bg-fg/20" />
        <span
          className={`absolute left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_2px_rgb(var(--accent)/0.6)] transition-[top,opacity] ease-in ${
            launch ? "top-[-12px] opacity-0 duration-300" : "top-[calc(100%-9px)] opacity-100 duration-0 group-hover:top-[9px] group-hover:duration-500"
          }`}
        />
      </span>
      Back to top
    </a>
  );
}
