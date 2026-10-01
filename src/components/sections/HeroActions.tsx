"use client";

import MagneticButton from "@/components/ui/MagneticButton";
import { HERO_BURST_EVENT } from "@/lib/pipeline";
import { scrollToId } from "@/lib/utils";

export default function HeroActions() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <MagneticButton
        href="#work"
        size="lg"
        onClick={(e) => {
          e.preventDefault();
          window.dispatchEvent(new Event(HERO_BURST_EVENT));
          window.setTimeout(() => scrollToId("work"), 350);
        }}
      >
        Run portfolio <span aria-hidden>▶</span>
      </MagneticButton>
      <MagneticButton
        href="#contact"
        size="lg"
        variant="outline"
        onClick={(e) => {
          e.preventDefault();
          scrollToId("contact");
        }}
      >
        Hire me
      </MagneticButton>
    </div>
  );
}
