"use client";

import { useEffect, useRef, useState } from "react";

type Props = { mp4: string; webm: string; poster: string; label: string };

/**
 * Case-study top video, laid exactly over the 16:10 still (same first frame).
 * Nothing downloads until it scrolls into view; it then loads fully (preload="auto"),
 * fades in once it can play through, and pauses when out of view. Reduced motion: still only.
 */
export default function CaseMedia({ mp4, webm, poster, label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let armed = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!armed) {
            armed = true;
            v.poster = poster;
            v.preload = "auto";
            for (const [src, type] of [[webm, "video/webm"], [mp4, "video/mp4"]] as const) {
              const s = document.createElement("source");
              s.src = src;
              s.type = type;
              v.appendChild(s);
            }
            v.load();
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
