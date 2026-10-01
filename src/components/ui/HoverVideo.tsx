"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { mp4: string; webm: string; poster: string; className?: string };

// Only one preview plays at a time across the page.
let current: { stop: () => void } | null = null;

/**
 * Scroll-preview video layered over a card's still (same 16:10 frame, same first frame).
 * Plays while the closest `[data-hover-root]` ancestor is hovered or has keyboard focus.
 *
 * - Desktop (hover + fine pointer) and motion-OK only; renders nothing otherwise.
 * - Nothing is downloaded until the first hover. Then sources are attached with preload="auto",
 *   and it fades in only after `canplaythrough` (or a 1s fallback) so playback starts smoothly
 *   from frame 0.
 * - Starting one preview pauses any other.
 */
export default function HoverVideo({ mp4, webm, poster, className }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = ref.current;
    const root = video?.closest<HTMLElement>("[data-hover-root]");
    if (!enabled || !video || !root) return;

    let active = false;
    let armed = false;
    let ready = false;
    let waitTimer = 0;
    let resetTimer = 0;

    const arm = () => {
      armed = true;
      video.poster = poster;
      video.preload = "auto";
      for (const [src, type] of [[webm, "video/webm"], [mp4, "video/mp4"]] as const) {
        const s = document.createElement("source");
        s.src = src;
        s.type = type;
        video.appendChild(s);
      }
      video.load();
    };

    const playFromStart = () => {
      window.clearTimeout(waitTimer);
      if (!active) return;
      try {
        video.currentTime = 0;
      } catch {}
      video.play().catch(() => {});
    };

    const me = {
      stop: () => {
        active = false;
        window.clearTimeout(waitTimer);
        setVisible(false);
        video.pause();
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
      if (!armed) arm();
      if (ready) playFromStart();
      else waitTimer = window.setTimeout(playFromStart, 1000); // fallback if canplaythrough is slow
    };
    const stop = () => {
      if (current === me) current = null;
      me.stop();
    };

    const onReady = () => {
      if (ready) return;
      ready = true;
      playFromStart();
    };
    const onPlaying = () => active && setVisible(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node)) stop();
    };

    root.addEventListener("pointerenter", start);
    root.addEventListener("pointerleave", stop);
    root.addEventListener("focusin", start);
    root.addEventListener("focusout", onFocusOut);
    video.addEventListener("canplaythrough", onReady);
    video.addEventListener("playing", onPlaying);
    return () => {
      root.removeEventListener("pointerenter", start);
      root.removeEventListener("pointerleave", stop);
      root.removeEventListener("focusin", start);
      root.removeEventListener("focusout", onFocusOut);
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("playing", onPlaying);
      window.clearTimeout(waitTimer);
      window.clearTimeout(resetTimer);
      if (current === me) current = null;
      video.pause();
    };
  }, [enabled, mp4, webm, poster]);

  if (!enabled) return null;

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
