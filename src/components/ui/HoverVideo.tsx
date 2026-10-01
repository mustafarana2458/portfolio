"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { mp4: string; webm: string; mobile?: string; poster: string; className?: string };
type Mode = "hover" | "inview" | null;

// Only one preview plays at a time across the page (hover or in-view).
let current: { stop: () => void } | null = null;

/**
 * Preview video layered over a card's still (same 16:10 frame, same first frame).
 *
 * - Desktop (hover + fine pointer): plays while the closest `[data-hover-root]` is hovered or
 *   focused. Nothing downloads until the first hover.
 * - Phones (≤767px): plays muted/inline/looped while the card's media frame is ≥60% on screen
 *   (the whole card can be taller than the screen), pauses when it
 *   leaves. Sources are attached (preload="none" until then) only when the card is about one
 *   screen away, and a 640px H.264 file is served via <source media="(max-width: 767px)">.
 * - Reduced motion or Data Saver: renders nothing, so the poster/still is all that shows.
 * - Starting one preview pauses any other.
 */
export default function HoverVideo({ mp4, webm, mobile, poster, className }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const phone = window.matchMedia("(max-width: 767px)");
    const update = () =>
      setMode(saveData || reduced.matches ? null : hover.matches ? "hover" : phone.matches && mobile ? "inview" : null);
    update();
    for (const mq of [reduced, hover, phone]) mq.addEventListener("change", update);
    return () => {
      for (const mq of [reduced, hover, phone]) mq.removeEventListener("change", update);
    };
  }, [mobile]);

  useEffect(() => {
    const video = ref.current;
    const root = video?.closest<HTMLElement>("[data-hover-root]");
    if (!mode || !video || !root) return;

    let active = false;
    let armed = false;
    let ready = false;
    let waitTimer = 0;
    let resetTimer = 0;

    const arm = () => {
      if (armed) return;
      armed = true;
      video.poster = poster;
      video.preload = "auto";
      const sources: [string, string, string?][] = [
        ...(mobile ? [[mobile, "video/mp4", "(max-width: 767px)"] as [string, string, string]] : []),
        [webm, "video/webm"],
        [mp4, "video/mp4"],
      ];
      for (const [src, type, media] of sources) {
        const s = document.createElement("source");
        s.src = src;
        s.type = type;
        if (media) s.media = media;
        video.appendChild(s);
      }
      video.load();
    };

    const play = (fromStart: boolean) => {
      window.clearTimeout(waitTimer);
      if (!active) return;
      if (fromStart) {
        try {
          video.currentTime = 0;
        } catch {}
      }
      video.play().catch(() => {});
    };

    const me = {
      stop: () => {
        active = false;
        window.clearTimeout(waitTimer);
        setVisible(false);
        video.pause();
        if (mode !== "hover") return; // phones resume where they left off
        // Rewind after the fade-out so the next hover starts at frame 0.
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          if (!active) {
            try {
              video.currentTime = 0;
            } catch {}
          }
        }, 500);
      },
    };

    const start = () => {
      if (active) return;
      if (current && current !== me) current.stop();
      current = me;
      active = true;
      window.clearTimeout(resetTimer);
      arm();
      if (ready) play(mode === "hover");
      else waitTimer = window.setTimeout(() => play(mode === "hover"), 1000); // fallback if canplaythrough is slow
    };
    const stop = () => {
      if (current === me) current = null;
      me.stop();
    };

    const onReady = () => {
      if (ready) return;
      ready = true;
      play(mode === "hover");
    };
    const onPlaying = () => active && setVisible(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node)) stop();
    };
    video.addEventListener("canplaythrough", onReady);
    video.addEventListener("playing", onPlaying);

    const cleanups: (() => void)[] = [];
    if (mode === "hover") {
      root.addEventListener("pointerenter", start);
      root.addEventListener("pointerleave", stop);
      root.addEventListener("focusin", start);
      root.addEventListener("focusout", onFocusOut);
      cleanups.push(() => {
        root.removeEventListener("pointerenter", start);
        root.removeEventListener("pointerleave", stop);
        root.removeEventListener("focusin", start);
        root.removeEventListener("focusout", onFocusOut);
      });
    } else {
      const frame = video.parentElement!; // the 16:10 media frame
      // Attach sources when the card is about a screen away…
      const near = new IntersectionObserver(([e]) => e.isIntersecting && (arm(), near.disconnect()), { rootMargin: "100% 0px" });
      near.observe(frame);
      // …play while ≥60% of its media frame is visible.
      const seen = new IntersectionObserver(([e]) => (e.intersectionRatio >= 0.6 ? start() : stop()), { threshold: [0, 0.6] });
      seen.observe(frame);
      cleanups.push(() => {
        near.disconnect();
        seen.disconnect();
      });
    }

    return () => {
      cleanups.forEach((c) => c());
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("playing", onPlaying);
      window.clearTimeout(waitTimer);
      window.clearTimeout(resetTimer);
      if (current === me) current = null;
      video.pause();
    };
  }, [mode, mp4, webm, mobile, poster]);

  if (!mode) return null;

  return (
    <video
      ref={ref}
      aria-hidden
      tabIndex={-1}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_0%] transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}
