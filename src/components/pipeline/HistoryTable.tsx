"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type Row = {
  role: string;
  org: string;
  href?: string;
  period?: string;
  status: "running" | "completed";
  points: string[];
};

/** Execution-history log: one expandable row per role (disclosure buttons, not a data grid). */
export default function HistoryTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg/60 font-mono text-[13px]">
      <div aria-hidden className="hidden grid-cols-[150px_120px_1fr_24px] gap-4 border-b border-line px-5 py-3 text-[12px] uppercase tracking-[0.14em] text-muted md:grid">
        <span>timestamp</span>
        <span>status</span>
        <span>execution</span>
        <span />
      </div>
      <ul>
        {rows.map((r, i) => {
          const expanded = open === i;
          return (
            <li key={r.org} className="border-b border-line last:border-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`${id}-${i}`}
                onClick={() => setOpen(expanded ? null : i)}
                className="grid w-full grid-cols-[1fr_24px] items-center gap-x-4 gap-y-1.5 px-5 py-4 text-left transition-colors hover:bg-fg/[0.03] md:grid-cols-[150px_120px_1fr_24px]"
              >
                <span className="order-3 col-span-2 text-muted md:order-none md:col-span-1">{r.period ?? "—"}</span>
                <span className="order-2 col-span-2 flex items-center gap-2 md:order-none md:col-span-1">
                  <span
                    aria-hidden
                    className={cn("relative h-1.5 w-1.5 rounded-full", r.status === "running" ? "bg-accent" : "bg-ok")}
                  >
                    {r.status === "running" && (
                      <span className="loop-anim absolute inset-0 rounded-full bg-accent [animation:pulse-ring_1.6s_cubic-bezier(0,0,.2,1)_infinite]" />
                    )}
                  </span>
                  <span className={r.status === "running" ? "text-accent" : "text-ok"}>{r.status}</span>
                </span>
                <span className="order-1 min-w-0 font-sans md:order-none">
                  <span className="block text-base font-medium text-fg md:text-lg">{r.role}</span>
                  <span className="block text-sm text-muted">{r.org}</span>
                </span>
                <span
                  aria-hidden
                  className={cn("order-1 justify-self-end text-muted transition-transform duration-300 md:order-none", expanded && "rotate-90")}
                >
                  ▸
                </span>
              </button>
              <div id={`${id}-${i}`} hidden={!expanded} className="px-5 pb-5 md:pl-[calc(150px+120px+2rem+1.25rem)]">
                <ul className="space-y-2 font-sans text-[15px] leading-relaxed text-muted">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <span aria-hidden className="mt-[0.65em] h-px w-3 shrink-0 bg-muted/60" />
                      {p}
                    </li>
                  ))}
                </ul>
                {r.href && (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block font-mono text-[12px] text-fg underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {new URL(r.href).hostname} ↗
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
