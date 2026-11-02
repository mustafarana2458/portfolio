export type VideoSource = { src: string; type: string; media?: string };

/**
 * Gives a <video> its sources and loads them, moving on if the chosen one can't be decoded.
 *
 * Browsers only try the next <source> when one can't be loaded. A file that loads and then fails
 * to decode (e.g. a GPU driver that can't handle VP9) kills the element instead, so here the failed
 * source is removed and the next one tried. `onRetry` runs before each retry (call play() again
 * there); `onGiveUp` runs when nothing is left.
 *
 * Returns a cleanup function.
 */
export function attachSources(video: HTMLVideoElement, sources: VideoSource[], onRetry: () => void, onGiveUp: () => void) {
  video.replaceChildren(
    ...sources.map(({ src, type, media }) => {
      const s = document.createElement("source");
      s.src = src;
      s.type = type;
      if (media) s.media = media;
      return s;
    })
  );

  const onError = () => {
    // currentSrc is absolute, and so is the .src property of each <source>.
    [...video.querySelectorAll("source")].find((s) => s.src === video.currentSrc)?.remove();
    const remaining = [...video.querySelectorAll("source")].some((s) => !s.media || window.matchMedia(s.media).matches);
    if (!remaining) return onGiveUp();
    video.load();
    onRetry();
  };
  video.addEventListener("error", onError);
  video.load();

  return () => video.removeEventListener("error", onError);
}
