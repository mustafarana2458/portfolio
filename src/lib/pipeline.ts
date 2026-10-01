"use client";

/**
 * Run a node: idle → running → success. Works on the DOM attribute directly so any
 * server-rendered <Node> can be executed without React state. The success label gets
 * the real time since page load appended, e.g. "success · 3.42s".
 */
export function executeNode(el: Element, { delay = 0, runFor = 420 }: { delay?: number; runFor?: number } = {}) {
  if (el.getAttribute("data-state") !== "idle" || el.hasAttribute("data-queued")) return;
  el.setAttribute("data-queued", "");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finish = () => {
    el.setAttribute("data-state", "success");
    const label = el.querySelector(":scope > .node-header [data-meta-success]");
    if (label && !label.hasAttribute("data-timed")) {
      label.setAttribute("data-timed", "");
      label.textContent = `${label.textContent} · ${(performance.now() / 1000).toFixed(2)}s`;
    }
    el.dispatchEvent(new CustomEvent("node:success", { bubbles: false }));
  };
  if (reduced) return finish();
  window.setTimeout(() => {
    el.setAttribute("data-state", "running");
    el.setAttribute("data-flash", "");
    window.setTimeout(() => el.removeAttribute("data-flash"), 450);
    window.setTimeout(finish, runFor);
  }, delay);
}

export const HERO_BURST_EVENT = "pipeline:burst";
