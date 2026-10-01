"use client";

// Route transition: a curtain wipes in (with a packet on its leading edge), the route changes,
// and the new page's template wipes it out. Transform-only; skipped for reduced motion.
const ID = "route-curtain";

export function navigateWithTransition(push: () => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.getElementById(ID)) {
    push();
    return;
  }
  const curtain = document.createElement("div");
  curtain.id = ID;
  curtain.setAttribute("aria-hidden", "true");
  Object.assign(curtain.style, {
    position: "fixed",
    inset: "0",
    zIndex: "95",
    background: "rgb(12 12 14)",
    backgroundImage: "radial-gradient(rgb(255 255 255 / 0.075) 1px, transparent 1.2px)",
    backgroundSize: "24px 24px",
    transformOrigin: "bottom",
    transform: "scaleY(0)",
    pointerEvents: "none",
  });
  const edge = document.createElement("div");
  Object.assign(edge.style, {
    position: "absolute",
    left: "0",
    right: "0",
    top: "0",
    height: "2px",
    background: "linear-gradient(90deg, transparent, rgb(255 107 53), transparent)",
  });
  curtain.appendChild(edge);
  document.body.appendChild(curtain);
  const anim = curtain.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
    duration: 420,
    easing: "cubic-bezier(0.65, 0, 0.35, 1)",
    fill: "forwards",
  });
  anim.onfinish = () => push();
  // Safety: never leave a curtain up if navigation stalls.
  window.setTimeout(() => revealAfterNavigation(), 4000);
}

/** Called by the new route's template on mount. */
export function revealAfterNavigation() {
  const curtain = document.getElementById(ID);
  if (!curtain) return;
  curtain.style.transformOrigin = "top";
  const anim = curtain.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], {
    duration: 520,
    delay: 60,
    easing: "cubic-bezier(0.65, 0, 0.35, 1)",
    fill: "forwards",
  });
  anim.onfinish = () => curtain.remove();
}
