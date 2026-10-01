"use client";

// One shared IntersectionObserver for every "reveal once when scrolled into view" element.
// It fires once per element and costs nothing per scroll event (unlike one ScrollTrigger each).

let io: IntersectionObserver | null = null;
const plays = new WeakMap<Element, () => void>();

/** Calls `play` once, when `el` is 12% into the viewport from the bottom. Returns a cleanup. */
export function revealOnce(el: Element, play: () => void) {
  io ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io!.unobserve(e.target);
        plays.get(e.target)?.();
        plays.delete(e.target);
      }),
    { rootMargin: "0px 0px -12% 0px" }
  );
  plays.set(el, play);
  io.observe(el);
  return () => {
    io?.unobserve(el);
    plays.delete(el);
  };
}
