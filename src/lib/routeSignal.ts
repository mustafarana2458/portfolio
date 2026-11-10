"use client";

// Tiny shared signal between a running route transition (lib/transition.ts) and the app
// template, kept apart so the template chunk doesn't carry the transition code.
const MAX_WAIT = 2500; // never wait (or keep the old page frozen) longer than this

let mounted: (() => void) | null = null;

/** Resolves when the next route has mounted (or after MAX_WAIT). */
export function waitForRoute() {
  return new Promise<void>((resolve) => {
    const t = window.setTimeout(done, MAX_WAIT);
    function done() {
      window.clearTimeout(t);
      if (mounted === done) mounted = null;
      resolve();
    }
    mounted = done;
  });
}

/** Called by the app template whenever a route mounts. */
export function routeMounted() {
  mounted?.();
}
