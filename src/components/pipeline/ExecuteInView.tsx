"use client";

import { useEffect, useRef } from "react";
import { executeNode } from "@/lib/pipeline";

/** Drop inside a <Node> that sits outside the global pipeline: runs it when it scrolls into view. */
export default function ExecuteInView({ threshold = 0.35 }: { threshold?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current?.closest("[data-node]");
    if (!node) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      executeNode(node, { delay: 150, runFor: 500 });
    }, { threshold });
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return <span ref={ref} hidden />;
}
