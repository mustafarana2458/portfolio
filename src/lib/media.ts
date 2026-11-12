// Card media: one 16:10 frame for the still and the hover video, so nothing crops or jumps.
//
// If a project has a hover video, its still is the video's first frame (the poster written by
// scripts/prepare-videos.mjs), unless `keepImage` is set (e.g. Celaris keeps the hand-made
// dashboard screenshot, shown with `imageFit: "contain"` because its aspect isn't 16:10).

import { versioned } from "./mediaVersion";

type MediaSource = {
  title: string;
  image?: string;
  imageAlt?: string;
  imageFit?: "cover" | "contain";
  keepImage?: boolean;
  video?: string;
  /** Explicit poster path (GitHub-synced projects keep theirs next to their screenshots). */
  poster?: string;
};

export type CardMedia = {
  still?: string;
  alt: string;
  fit: "cover" | "contain";
  video?: { mp4: string; webm: string; mobile: string; poster: string };
};

export function cardMedia(p: MediaSource): CardMedia {
  // Video URLs carry `?v=<content hash>` (cache busting, see lib/mediaVersion). The still stays a
  // plain path: MediaImage versions it together with its optimized sizes.
  const poster = p.video ? p.poster ?? p.video.replace(/^\/videos\//, "/images/posters/").replace(/\.mp4$/, ".jpg") : undefined;
  const video = p.video
    ? {
        mp4: versioned(p.video),
        webm: versioned(p.video.replace(/\.mp4$/, ".webm")),
        mobile: versioned(p.video.replace(/\.mp4$/, "-m.mp4")), // 640px H.264 for phones (prepare-videos)
        poster: versioned(poster!),
      }
    : undefined;
  const usePoster = !!video && !p.keepImage;
  return {
    still: usePoster ? poster : p.image,
    alt: p.imageAlt ?? `${p.title} homepage`,
    fit: usePoster ? "cover" : p.imageFit ?? "cover",
    video,
  };
}
