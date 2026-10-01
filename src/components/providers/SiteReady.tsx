"use client";

import { useEffect } from "react";
import { markSiteReady } from "@/lib/utils";

/**
 * No preloader: the site is "ready" (deferred animations may start) once hydrated.
 * Also pauses every CSS animation inside sections that are off screen (the looping
 * "running" packets, pulses and carets), so they never tick while nobody can see them.
 */
export default function SiteReady() {
  useEffect(() => {
    markSiteReady();
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.toggleAttribute("data-offscreen", !e.isIntersecting)),
      { rootMargin: "200px 0px" }
    );
    document.querySelectorAll("main > section, main article, footer").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
