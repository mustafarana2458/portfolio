"use client";

import { isLite } from "@/lib/utils";
import { waitForRoute } from "@/lib/routeSignal";

// Route transition: ≈540ms of motion plus however long the new route takes to render.
// 1. Exit (260ms, starts on click): a wire draws across the top of the screen and a packet runs
//    along it to the far end; the old page fades / slides up and out.
// 2. Swap: the route changes. With the View Transitions API the browser holds the last frame
//    while the new page renders: by then that frame is the "delivered" state (blank canvas,
//    wire, packet parked at the end), so the hold never freezes motion mid-way.
// 3. Boot (280ms): the new page fades up, its first node lights up (the node border flash)
//    and the wire fades away. Without View Transitions the same motion runs as Web Animations.
// Transform / opacity / stroke-dashoffset only. Reduced motion or html.lite: a quick fade, no
// wire. Back / forward never go through here: the browser and Next restore the scroll position.

const WIRE_ID = "route-wire";

type VT = { finished: Promise<void>; ready: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => Promise<void>) => VT };

let busy = false;

const quick = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || isLite();

const EXIT = 260;

/** The wire + packet overlay (the packet reaches the far end after EXIT ms). Returns its remover. */
function runWire(): (fade: boolean) => void {
  document.getElementById(WIRE_ID)?.remove();
  const NS = "http://www.w3.org/2000/svg";
  const wrap = document.createElement("div");
  wrap.id = WIRE_ID;
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = "position:fixed;left:0;right:0;top:calc(var(--nav-h) - 1px);height:24px;margin-top:-12px;z-index:96;pointer-events:none;view-transition-name:route-wire";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 1000 24");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;overflow:visible";
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", "M0 12 H1000");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "rgb(255 107 53)");
  path.setAttribute("stroke-opacity", "0.7");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.appendChild(path);
  wrap.appendChild(svg);
  const packet = document.createElement("span");
  packet.style.cssText =
    "position:absolute;left:-6px;top:6px;width:12px;height:12px;border-radius:9999px;background:rgb(255 107 53);box-shadow:0 0 0 4px rgb(255 107 53 / 0.18),0 0 18px 4px rgb(255 107 53 / 0.55)";
  wrap.appendChild(packet);
  document.body.appendChild(wrap);

  // With non-scaling-stroke, dashes are in screen px: the dash is the viewport width.
  const w = window.innerWidth;
  path.style.strokeDasharray = `${w + 2} ${w + 2}`;
  path.animate([{ strokeDashoffset: w + 2 }, { strokeDashoffset: 0 }], { duration: 200, easing: "cubic-bezier(0.3,0.6,0.3,1)", fill: "forwards" });
  packet.animate(
    [
      { transform: "translate3d(0,0,0) scale(0.6)", opacity: 0 },
      { transform: `translate3d(${w * 0.1}px,0,0) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate3d(${w - 14}px,0,0) scale(1)`, opacity: 1 },
    ],
    { duration: EXIT, easing: "cubic-bezier(0.45,0,0.3,1)", fill: "forwards" }
  );
  let gone = false;
  return (fade) => {
    if (gone) return;
    gone = true;
    if (!fade) return wrap.remove();
    wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" }).onfinish = () => wrap.remove();
  };
}

/** The new page's first node lights up (border flash, composited). */
function bootNode() {
  const node = document.querySelector<HTMLElement>("#main .node");
  if (!node) return;
  node.removeAttribute("data-flash");
  void node.offsetWidth; // restart the flash if it was already set
  node.setAttribute("data-flash", "");
  window.setTimeout(() => node.removeAttribute("data-flash"), 480);
}

export function navigateWithTransition(push: () => void) {
  const main = document.getElementById("main");
  if (busy || !main) return push();
  busy = true;
  const fast = quick();
  const root = document.documentElement;
  const doc = document as DocVT;

  // 1. Exit
  const removeWire = fast ? null : runWire();
  const out = main.animate(
    fast ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "translate3d(0,0,0)" }, { opacity: 0, transform: "translate3d(0,-16px,0)" }],
    { duration: fast ? 120 : 220, easing: "cubic-bezier(0.4,0,1,1)", fill: "forwards" }
  );
  const finish = () => {
    root.removeAttribute("data-vt-quick");
    busy = false;
  };
  // Before the route changes, <main> drops the exit's translate (keeping it invisible): Next
  // measures the layout to scroll to a #hash target, and a leftover transform would offset it.
  let hold: Animation | null = null;
  const blank = () => {
    hold = main.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" });
    out.cancel();
  };

  window.setTimeout(() => {
    // 2 + 3 with View Transitions: the new root fades up (globals.css), the wire's last frame
    // fades out on its own layer.
    if (doc.startViewTransition) {
      root.toggleAttribute("data-vt-quick", fast);
      try {
        doc
          .startViewTransition(async () => {
            const wait = waitForRoute();
            blank();
            push();
            await wait;
            hold?.cancel();
            removeWire?.(false);
            if (!fast) bootNode();
          })
          .finished.catch(() => {})
          .then(finish);
        return;
      } catch {
        // fall through to the Web Animations version
      }
    }
    // 2 + 3 without: the same motion on <main>.
    const wait = waitForRoute();
    blank();
    push();
    wait.then(() => {
      hold?.cancel();
      const inn = main.animate(
        fast ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translate3d(0,18px,0)" }, { opacity: 1, transform: "translate3d(0,0,0)" }],
        { duration: fast ? 160 : 280, easing: "cubic-bezier(0.22,1,0.36,1)" }
      );
      removeWire?.(true);
      if (!fast) bootNode();
      inn.onfinish = inn.oncancel = finish;
    });
  }, fast ? 120 : EXIT);
}
