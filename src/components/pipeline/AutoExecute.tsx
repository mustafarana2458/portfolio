"use client";

import { useEffect, useRef } from "react";
import { executeNode } from "@/lib/pipeline";
import { onSiteReady } from "@/lib/utils";

/** Drop inside a <Node> to run it once the page is hydrated (for nodes that are in view on load). */
export default function AutoExecute({ delay = 400 }: { delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current?.closest("[data-node]");
    if (!node) return;
    return onSiteReady(() => executeNode(node, { delay }));
  }, [delay]);
  return <span ref={ref} hidden />;
}
