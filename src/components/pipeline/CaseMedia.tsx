"use client";

import { useEffect, useRef, useState } from "react";
import { attachSources } from "@/lib/videoSources";

type Props = { mp4: string; webm: string; poster: string; label: string };

/**
 * Case-study top video, laid exactly over the 16:10 still (same first frame).
 * Nothing downloads until it scrolls into view; it then loads (preload="auto"), fades in as soon
 * as playback starts, and pauses when out of view. A file that can't be decoded falls through to
 * the next format (see attachSources). Reduced motion: still only.
 */
export default function CaseMedia({ mp4, webm, poster, label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let detach: (() => void) | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!detach) {
            v.poster = poster;
            v.preload = "auto";
            detach = attachSources(
              v,
              [
                { src: mp4, type: "video/mp4" },
                { src: webm, type: "video/webm" },
              ],
              () => {
                setVisible(false);
                v.play().catch(() => {});
              },
              () => setVisible(false)
            );
          }
          v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.25 }
    );
    const onPlaying = () => setVisible(true);
    v.addEventListener("playing", onPlaying);
    io.observe(v);
    return () => {
      io.disconnect();
      v.removeEventListener("playing", onPlaying);
      detach?.();
    };
  }, [mp4, webm, poster]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      disablePictureInPicture
      className={`absolute inset-0 h-full w-full object-cover object-[50%_0%] transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}
