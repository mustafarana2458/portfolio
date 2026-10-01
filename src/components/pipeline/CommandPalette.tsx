"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildCommands, fuzzyScore, type Command } from "@/lib/palette";
import { scrollToTarget } from "@/lib/utils";
import { navigateWithTransition } from "@/lib/transition";
import { cn } from "@/lib/utils";

type LenisLike = { stop: () => void; start: () => void };

/**
 * ⌘K / Ctrl+K command palette. Accessible dialog: modal, focus stays in the combobox
 * input, options are announced via aria-activedescendant, Esc closes and restores focus.
 */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const commands = useMemo(() => buildCommands(), []);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [flash, setFlash] = useState("");
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const returnFocus = useRef<Element | null>(null);

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((c) => ({ c, s: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, `${c.label} ${c.keywords ?? ""} ${c.hint ?? ""}`) - 2) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [commands, query]);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    input.current?.focus();
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => setShown(true));
    return () => {
      lenis?.start();
      document.body.style.overflow = "";
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const ctx = {
    go: (target: string) => {
      if (pathname !== "/") {
        router.push(target.startsWith("[") ? "/#work" : `/#${target}`);
        return;
      }
      scrollToTarget(target);
    },
    push: (href: string) => navigateWithTransition(() => router.push(href)),
  };

  const run = async (cmd: Command) => {
    // Commands that confirm in place (copy email) run while open and flash a message.
    if (cmd.stayOpen) {
      const msg = await cmd.run(ctx);
      if (typeof msg === "string") setFlash(msg);
      window.setTimeout(onClose, 900);
      return;
    }
    // Everything else: close first (restarts smooth scroll, restores focus), then run.
    onClose();
    window.setTimeout(() => cmd.run(ctx), 60);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) run(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault(); // focus trap: the input is the only focusable element
    }
  };

  // Group while keeping the flat index for aria-activedescendant.
  let idx = -1;
  const groups = results.reduce<Record<string, { c: Command; i: number }[]>>((acc, c) => {
    idx++;
    (acc[c.group] ??= []).push({ c, i: idx });
    return acc;
  }, {});
  const activeId = results[active] ? `cmd-${results[active].id}` : undefined;

  return (
    <div className="fixed inset-0 z-[90]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div aria-hidden className={cn("absolute inset-0 bg-bg/85 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          "node relative mx-auto mt-[12vh] w-[min(92vw,620px)] overflow-hidden transition-[opacity,transform] duration-200 ease-out",
          shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        )}
        data-state="success"
      >
        <div className="node-header">
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-fg/70">
            <path d="m3 4.5 3 3-3 3m4.5 1h5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-fg/85">command palette</span>
          <span className="ml-auto text-muted">{results.length} commands</span>
        </div>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span aria-hidden className="font-mono text-accent">▸</span>
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Type a command or search"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full bg-transparent font-mono text-sm text-fg placeholder:text-muted focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[12px] text-muted">esc</kbd>
        </div>

        <ul ref={list} id="cmd-list" role="listbox" aria-label="Commands" className="max-h-[min(56vh,420px)] overflow-y-auto overscroll-contain p-2" data-lenis-prevent>
          {Object.entries(groups).map(([group, items]) => (
            <li key={group} role="presentation">
              <p aria-hidden className="px-3 pb-1 pt-3 font-mono text-[12px] uppercase tracking-[0.16em] text-muted">
                {group}
              </p>
              <ul role="group" aria-label={group}>
                {items.map(({ c, i }) => (
                  <li
                    key={c.id}
                    id={`cmd-${c.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(c)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm",
                      i === active ? "bg-fg/[0.07] text-fg" : "text-fg/80"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", i === active ? "bg-accent" : "bg-fg/20")} />
                      <span className="truncate">{c.label}</span>
                    </span>
                    {c.hint && <span className="shrink-0 truncate font-mono text-[12px] text-muted">{c.hint}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {!results.length && <li className="px-3 py-6 text-center font-mono text-sm text-muted">No matching command.</li>}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[12px] text-muted">
          <span>↑↓ navigate · ↵ run · esc close</span>
          <span role="status" aria-live="polite" className="text-ok">
            {flash && `✓ ${flash}`}
          </span>
        </div>
      </div>
    </div>
  );
}
