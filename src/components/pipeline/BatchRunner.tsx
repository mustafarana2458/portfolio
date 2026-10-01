"use client";

import { useEffect, useRef } from "react";
import { executeNode } from "@/lib/pipeline";

/**
 * When the parent node executes, run its `[data-batch-item]` child nodes in sequence,
 * like an n8n "split in batches" run. Already-executed or reduced-motion → run all now.
 */
export default function BatchRunner({ gap = 320 }: { gap?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const parent = ref.current?.closest("[data-node]");
    if (!parent) return;
    const items = () => Array.from(parent.querySelectorAll("[data-batch-item]"));
    const run = () => items().forEach((el, i) => executeNode(el, { delay: 200 + i * gap, runFor: 520 }));
    if (parent.getAttribute("data-state") === "success") {
      run();
      return;
    }
    parent.addEventListener("node:success", run, { once: true });
    return () => parent.removeEventListener("node:success", run);
  }, [gap]);

  return <span ref={ref} hidden />;
}
