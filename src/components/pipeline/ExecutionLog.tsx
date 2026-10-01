"use client";

import { useEffect, useRef, useState } from "react";

type Line = { ts: string; text: string };

const fmt = (ms: number) => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
};

/**
 * Mono "execution log" that types real events one at a time and loops.
 * Timestamps are the real time since page load. Purely visual (aria-hidden);
 * screen readers get the full list once, as a plain list.
 *
 * Perf: characters are typed straight into a text node (no React render per keystroke),
 * the panel has a fixed height with `contain: strict` so typing never relayouts the page,
 * and it only starts after the page has loaded.
 */
export default function ExecutionLog({ events, rows = 4 }: { events: string[]; rows?: number }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [staticMode, setStaticMode] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const typingRow = useRef<HTMLParagraphElement>(null);
  const tsRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStaticMode(true);
      return;
    }
    let idx = 0, char = 0, timer = 0, inView = true, pageVisible = !document.hidden, running = false, started = false;
    let ts = "";

    const step = () => {
      timer = 0;
      if (!inView || !pageVisible) {
        running = false;
        return;
      }
      running = true;
      const text = events[idx % events.length];
      if (char === 0) {
        ts = fmt(performance.now());
        tsRef.current!.textContent = `[${ts}]`;
        typingRow.current!.style.visibility = "visible";
      }
      if (char < text.length) {
        char = Math.min(text.length, char + 2 + Math.floor(Math.random() * 2));
        textRef.current!.textContent = text.slice(0, char);
        timer = window.setTimeout(step, 45 + Math.random() * 35);
      } else {
        typingRow.current!.style.visibility = "hidden";
        textRef.current!.textContent = "";
        setLines((l) => [...l, { ts, text }].slice(-(rows - 1)));
        char = 0;
        idx++;
        timer = window.setTimeout(step, 1100 + Math.random() * 700);
      }
    };
    const resume = () => {
      if (started && !running && !timer && inView && pageVisible) timer = window.setTimeout(step, 250);
    };

    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      resume();
    });
    if (root.current) io.observe(root.current);
    const onVis = () => {
      pageVisible = !document.hidden;
      resume();
    };
    document.addEventListener("visibilitychange", onVis);
    const begin = () => {
      started = true;
      timer = window.setTimeout(step, 900);
    };
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
      window.removeEventListener("load", begin);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [events, rows]);

  const shown: Line[] = staticMode ? events.slice(0, rows).map((text) => ({ ts: "--:--.--", text })) : lines;

  return (
    <div ref={root} className="font-mono text-[12px] leading-[1.9]">
      <ul className="sr-only">
        {events.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <div aria-hidden style={{ height: `calc(1.9em * ${rows})`, contain: "strict" }}>
        {shown.map((l, i) => (
          <p key={`${l.ts}-${i}`} className="truncate text-muted">
            <span className="text-fg/55">[{l.ts}]</span> <span className="text-ok">✓</span> <span className="text-fg/80">{l.text}</span>
          </p>
        ))}
        {!staticMode && (
          <p ref={typingRow} className="truncate text-muted" style={{ visibility: "hidden" }}>
            <span ref={tsRef} className="text-fg/55" /> <span className="text-accent">▸</span> <span ref={textRef} className="text-fg/80" />
            <span className="loop-anim ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[2px] bg-accent/80 [animation:caret_1s_steps(1)_infinite]" />
          </p>
        )}
      </div>
    </div>
  );
}
