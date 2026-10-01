// Card media: one 16:10 frame for the still and the hover video, so nothing crops or jumps.
//
// If a project has a hover video, its still is the video's first frame (the poster written by
// scripts/prepare-videos.mjs), unless `keepImage` is set (e.g. Celaris keeps the hand-made
// dashboard screenshot, shown with `imageFit: "contain"` because its aspect isn't 16:10).

type MediaSource = {
  title: string;
  image?: string;
  imageAlt?: string;
  imageFit?: "cover" | "contain";
  keepImage?: boolean;
  video?: string;
};

export type CardMedia = {
  still?: string;
  alt: string;
  fit: "cover" | "contain";
  video?: { mp4: string; webm: string; mobile: string; poster: string };
};

export function cardMedia(p: MediaSource): CardMedia {
  const video = p.video
    ? {
        mp4: p.video,
        webm: p.video.replace(/\.mp4$/, ".webm"),
        mobile: p.video.replace(/\.mp4$/, "-m.mp4"), // 640px H.264 for phones (prepare-videos)
        poster: p.video.replace(/^\/videos\//, "/images/posters/").replace(/\.mp4$/, ".jpg"),
      }
    : undefined;
  const usePoster = !!video && !p.keepImage;
  return {
    still: usePoster ? video!.poster : p.image,
    alt: p.imageAlt ?? `${p.title} homepage`,
    fit: usePoster ? "cover" : p.imageFit ?? "cover",
    video,
  };
}
