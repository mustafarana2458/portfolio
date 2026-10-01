"use client";

import { useEffect, useRef, useState } from "react";

/** "Workflow executed in X.Xs" once the visitor reaches the footer. X is the real time since page load. */
export default function FooterToast() {
  const ref = useRef<HTMLSpanElement>(null);
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const footer = ref.current?.closest("footer");
    if (!footer) return;
    let hideTimer = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setMsg(`Workflow executed in ${(performance.now() / 1000).toFixed(1)}s`);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), 5000);
    }, { threshold: 0.3 });
    io.observe(footer);
    return () => {
      io.disconnect();
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <span ref={ref}>
      <span
        role="status"
        aria-live="polite"
        className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-xl border border-line bg-surface/95 px-4 py-3 font-mono text-[12px] text-fg shadow-2xl transition-[opacity,transform] duration-500 ease-expo ${
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        {msg && (
          <>
            <span aria-hidden className="h-2 w-2 rounded-full bg-ok" />
            <span>
              <span className="text-ok">✓</span> {msg}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
