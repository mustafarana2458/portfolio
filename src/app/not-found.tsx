import type { Metadata } from "next";
import Node from "@/components/pipeline/Node";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const CSS = `#nf-path::after { content: "this path"; } #nf-path[data-path]::after { content: attr(data-path); } .node-failed { border-color: rgb(var(--accent) / 0.35); } .node-failed > .node-header .node-dot { background: rgb(var(--accent)); } .node-failed > .node-port { border-color: rgb(var(--accent) / 0.55); } .bw-run { animation: bw-run 0.9s cubic-bezier(0.5, 0, 0.75, 0.4) 0.35s both; } .bw-packet { box-shadow: 0 0 0 3px rgb(var(--accent) / 0.18), 0 0 14px 3px rgb(var(--accent) / 0.5); animation: bw-stop 0.6s ease-out 1.25s both; } .bw-spark { opacity: 0; transform-origin: left center; animation: bw-spark 0.5s cubic-bezier(0.2, 0.6, 0.3, 1) 1.25s both; } .bw-x { animation: bw-x 0.4s ease-out 1.3s both; } @keyframes bw-run { from { transform: translateX(0); } to { transform: translateX(100%); } } @keyframes bw-stop { 0% { opacity: 1; } 30% { opacity: 0.35; } 55% { opacity: 0.9; } 100% { opacity: 0.45; } } @keyframes bw-spark { 0% { opacity: 0; transform: translateX(2px) scaleX(0.4); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateX(14px) scaleX(1); } } @media (prefers-reduced-motion: reduce) { .bw-run, .bw-packet, .bw-spark, .bw-x { animation-delay: 0s !important; } } @keyframes bw-x { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }`;

// Sets an attribute, not text: React owns the span's content, and changing it before hydration
// would be a hydration mismatch. CSS shows the attribute (#nf-path::after).
const PATH_JS = `try{document.getElementById("nf-path").setAttribute("data-path",decodeURI(location.pathname))}catch(e){}`;

const btn = "inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] transition-colors";

/**
 * 404 as a failed pipeline run: a request packet runs down a wire that's broken, sparks at the
 * break and stops; the target node reports "node not found" with an execution log.
 * The motion is CSS only and plays once (transform / opacity); reduced motion shows the end
 * state. Exported as out/404.html, which Vercel serves for unknown paths.
 *
 * Weight: Next embeds the root not-found tree in every page's payload, so this stays a server
 * component with no client modules (any would add a script to every page): plain links, styles
 * inline here instead of globals.css, and the requested path filled in by a tiny inline script (as an attribute shown via CSS)
 * (the exported page can't know it at build time).
 */
export default function NotFound() {
  return (
    <section className="section pt-[calc(var(--nav-h)+3rem)] md:pt-[calc(var(--nav-h)+5rem)]">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="container max-w-3xl">
        <p className="eyebrow mb-4">error · 404</p>
        <h1 className="h-section mb-10 md:mb-14">
          This route <span className="accent-serif">doesn&apos;t exist.</span>
        </h1>

        {/* The broken wire: request → break (spark) - - - target */}
        <div aria-hidden className="broken-wire relative mb-8 flex h-10 items-center">
          <span className="relative z-[1] shrink-0 rounded-full border border-line bg-surface px-3 py-1 font-mono text-[12px] text-muted">GET</span>
          <span className="relative h-px flex-[0_0_42%] bg-accent/50">
            <span className="bw-run absolute inset-0">
              <span className="bw-packet absolute left-0 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
            </span>
            <span className="absolute right-0 top-1/2">
              {[0, 50, 110, 170, 230, 300].map((deg) => (
                <span key={deg} className="absolute left-0 top-0" style={{ transform: `rotate(${deg}deg)` }}>
                  <span className="bw-spark block h-px w-2 bg-accent" />
                </span>
              ))}
            </span>
          </span>
          <span className="relative mx-3 shrink-0 font-mono text-[13px] leading-none text-accent">
            <span className="bw-x inline-block">✕</span>
          </span>
          <span className="h-px flex-1 border-t border-dashed border-[var(--line-strong)]" />
          <span className="h-[10px] w-[10px] shrink-0 rounded-full border border-[var(--line-strong)] bg-bg" />
        </div>

        <Node
          name="Pipeline failed · node not found"
          icon="terminal"
          ports="in"
          state="idle"
          meta={{ idle: "error · 404" }}
          className="node-failed"
          bodyClassName="p-5 md:p-8"
        >
          <ol className="space-y-1.5 font-mono text-[13px] leading-relaxed text-muted" aria-label="Execution log">
            <li>
              <span className="text-fg/40">[00:00.000]</span> <span className="text-fg/80">▶ GET</span> <span id="nf-path" className="break-all text-fg" />
              <script dangerouslySetInnerHTML={{ __html: PATH_JS }} />
            </li>
            <li>
              <span className="text-fg/40">[00:00.004]</span> <span className="text-ok">✓</span> route table loaded
            </li>
            <li>
              <span className="text-fg/40">[00:00.009]</span> <span className="text-accent">✕</span> no node matches this path
            </li>
            <li>
              <span className="text-fg/40">[00:00.009]</span> <span className="text-accent">■</span> pipeline halted · exit 404
            </li>
          </ol>
          <p className="mt-6 max-w-xl leading-relaxed text-muted">The page you asked for isn&apos;t part of this workflow. It may have moved, or the link has a typo.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/" className={`${btn} bg-accent font-medium text-bg hover:bg-accent-hover`}>
              Retry from home <span aria-hidden>↻</span>
            </a>
            <a href="/#work" className={`${btn} border border-line hover:border-fg/30`}>
              View work <span aria-hidden>→</span>
            </a>
          </div>
        </Node>
      </div>
    </section>
  );
}
