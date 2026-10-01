export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Split "I build *AI-powered* products" into words, flagging *accented* ones. */
export function parseAccent(text: string) {
  const words: { word: string; accent: boolean }[] = [];
  let accent = false;
  for (const raw of text.split(" ")) {
    let w = raw;
    const opens = w.startsWith("*");
    if (opens) {
      accent = true;
      w = w.slice(1);
    }
    const closeIdx = w.indexOf("*");
    const closes = closeIdx !== -1;
    if (closes) w = w.slice(0, closeIdx) + w.slice(closeIdx + 1);
    if (w) words.push({ word: w, accent });
    if (closes) accent = false;
  }
  return words;
}

type LenisLike = { scrollTo: (target: HTMLElement | number, opts?: { offset?: number }) => void };

/** Smooth-scroll to a section id (uses Lenis when active). */
export function scrollToId(id: string) {
  const el = id === "top" ? document.body : document.getElementById(id);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  if (lenis) lenis.scrollTo(id === "top" ? 0 : el, { offset: 0 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", id === "top" ? "#" : `#${id}`);
}

/** Scroll to "top", a section id, or any CSS selector (e.g. a pipeline anchor). */
export function scrollToTarget(target: string) {
  if (target === "top" || /^[\w-]+$/.test(target)) return scrollToId(target);
  const el = document.querySelector<HTMLElement>(target);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o?: { offset?: number }) => void } }).__lenis;
  if (lenis) lenis.scrollTo(el, { offset: -96 });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
}

/** Runs `cb` once the site is hydrated (immediately if it already is). */
export function onSiteReady(cb: () => void) {
  const w = window as unknown as { __siteReady?: boolean };
  if (w.__siteReady) {
    cb();
    return () => {};
  }
  window.addEventListener("site:ready", cb, { once: true });
  return () => window.removeEventListener("site:ready", cb);
}

export function markSiteReady() {
  (window as unknown as { __siteReady?: boolean }).__siteReady = true;
  window.dispatchEvent(new Event("site:ready"));
}

/** Weaker phone (html.lite, set in layout <head>): looping/decorative motion stays static. */
export function isLite() {
  return document.documentElement.classList.contains("lite");
}
