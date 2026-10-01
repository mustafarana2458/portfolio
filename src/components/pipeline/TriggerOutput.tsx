"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn, isLite } from "@/lib/utils";

type Value = string | string[];
type Seg = { t: string; c: string };

/** Pretty-print the profile as coloured JSON segments. */
function toSegments(data: Record<string, Value>): Seg[] {
  const segs: Seg[] = [{ t: "{\n", c: "text-fg/55" }];
  const keys = Object.keys(data);
  keys.forEach((k, i) => {
    const v = data[k];
    segs.push({ t: "  ", c: "" }, { t: `"${k}"`, c: "text-fg/60" }, { t: ": ", c: "text-fg/55" });
    if (Array.isArray(v)) {
      segs.push({ t: "[", c: "text-fg/55" });
      v.forEach((item, j) => {
        segs.push({ t: `"${item}"`, c: "text-[#D9B38C]" });
        if (j < v.length - 1) segs.push({ t: ", ", c: "text-fg/55" });
      });
      segs.push({ t: "]", c: "text-fg/55" });
    } else {
      segs.push({ t: `"${v}"`, c: "text-[#D9B38C]" });
    }
    segs.push({ t: i < keys.length - 1 ? ",\n" : "\n", c: "text-fg/55" });
  });
  segs.push({ t: "}", c: "text-fg/55" });
  return segs;
}

/**
 * n8n-style output panel for the Trigger node: Table / JSON tabs.
 * JSON types itself out once the node executes (instantly for reduced motion).
 */
export default function TriggerOutput({ data }: { data: Record<string, Value> }) {
  const [tab, setTab] = useState<"json" | "table">("json");
  const segs = useMemo(() => toSegments(data), [data]);
  const totalChars = useMemo(() => segs.reduce((n, s) => n + s.t.length, 0), [segs]);
  const [typed, setTyped] = useState(totalChars); // full on the server / without JS
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const node = root.current?.closest("[data-node]");
    // Weaker phones show the JSON complete: typing re-renders ~100 spans every 40ms.
    if (!node || isLite() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getAttribute("data-state") === "success") return;
    setTyped(0);
    let timer = 0;
    const type = () => {
      setTyped((n) => {
        const next = Math.min(totalChars, n + 14);
        if (next < totalChars) timer = window.setTimeout(type, 40);
        return next;
      });
    };
    const start = () => (timer = window.setTimeout(type, 250));
    node.addEventListener("node:success", start, { once: true });
    return () => {
      node.removeEventListener("node:success", start);
      window.clearTimeout(timer);
    };
  }, [totalChars]);

  // Render the first `typed` characters of the coloured segments.
  let left = typed;
  const shown = segs.map((s, i) => {
    if (left <= 0) return null;
    const t = s.t.slice(0, left);
    left -= s.t.length;
    return (
      <span key={i} className={s.c}>
        {t}
      </span>
    );
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = tab === "json" ? "table" : "json";
      setTab(next);
      document.getElementById(`${id}-${next}`)?.focus();
    }
  };

  const tabBtn = (key: "json" | "table", label: string) => (
    <button
      id={`${id}-${key}`}
      role="tab"
      type="button"
      aria-selected={tab === key}
      aria-controls={`${id}-panel`}
      tabIndex={tab === key ? 0 : -1}
      onClick={() => setTab(key)}
      onKeyDown={onKey}
      className={cn(
        "rounded-md px-2.5 py-1 font-mono text-[12px] transition-colors",
        tab === key ? "bg-fg/10 text-fg" : "text-muted hover:text-fg"
      )}
    >
      {label}
    </button>
  );

  return (
    <div ref={root} className="overflow-hidden rounded-xl border border-line bg-bg/70">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-mono text-[12px] text-muted">output · 1 item</span>
        <div role="tablist" aria-label="Output format" className="flex gap-1">
          {tabBtn("table", "Table")}
          {tabBtn("json", "JSON")}
        </div>
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="p-4">
        {tab === "json" ? (
          <>
            <pre aria-hidden className="min-h-[15.5rem] whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.75] [contain:content]">
              {shown}
              {typed < totalChars && <span className="inline-block h-[1em] w-[0.5em] translate-y-[2px] bg-accent/80" />}
            </pre>
            <pre className="sr-only">{JSON.stringify(data, null, 2)}</pre>
          </>
        ) : (
          <table className="w-full font-mono text-[13px]">
            <caption className="sr-only">Profile</caption>
            <tbody>
              {Object.entries(data).map(([k, v]) => (
                <tr key={k} className="border-b border-line last:border-0">
                  <th scope="row" className="w-28 py-2 pr-4 text-left align-top font-normal text-muted">
                    {k}
                  </th>
                  <td className="py-2 text-fg/85">{Array.isArray(v) ? v.join(", ") : v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
