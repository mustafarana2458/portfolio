"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { nav, site } from "@/data/content";
import { cn, scrollToId } from "@/lib/utils";
import { PALETTE_OPEN_EVENT } from "@/lib/palette";

type LenisLike = { stop: () => void; start: () => void };

export default function Navbar() {
  const bar = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState("⌘");
  const pathname = usePathname();
  const onHome = pathname === "/";

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setMod("Ctrl");
  }, []);

  // No ScrollTriggers here: they'd run on every scroll event for the life of the page.
  // Hide on scroll down / show on scroll up: one passive listener toggling a CSS transform.
  useEffect(() => {
    const el = bar.current!;
    let last = window.scrollY, hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      const dir = y - last;
      last = y;
      const shouldHide = dir > 2 && y > 160 ? true : dir < -2 || y <= 160 ? false : hidden;
      if (shouldHide === hidden) return;
      hidden = shouldHide;
      el.toggleAttribute("data-hidden", hidden);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section: whichever section crosses the line 45% down the viewport.
  useEffect(() => {
    const els = nav.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else if (e.target.id === nav[0].id && e.boundingClientRect.top > 0) setActive(""); // back above the first section
        }
      },
      { rootMargin: "-45% 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (open) lenis?.stop();
    else lenis?.start();
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On the home page, section links smooth-scroll; elsewhere they navigate to /#section.
  const go = (id: string) => (e: MouseEvent) => {
    setOpen(false);
    if (!onHome) return;
    e.preventDefault();
    scrollToId(id);
  };
  const openPalette = () => {
    setOpen(false);
    window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
  };

  return (
    <>
      <header ref={bar} className="fixed inset-x-0 top-0 z-50 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] data-[hidden]:-translate-y-[110%] border-b border-line bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
        <nav aria-label="Primary" className="container flex h-[var(--nav-h)] items-center justify-between gap-4">
          <a href={onHome ? "#top" : "/"} onClick={go("top")} className="font-display text-lg font-semibold tracking-tight">
            {site.initials}
            <span className="text-accent">.</span>
            <span className="sr-only"> — {site.name}, home</span>
          </a>

          <ul className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <li key={n.id}>
                <a
                  href={onHome ? `#${n.id}` : `/#${n.id}`}
                  onClick={go(n.id)}
                  aria-current={active === n.id && onHome ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3.5 py-2.5 text-[15px] transition-colors duration-300",
                    active === n.id && onHome ? "text-fg" : "text-muted hover:text-fg"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full border transition-all duration-300",
                      active === n.id && onHome ? "scale-100 border-accent bg-accent" : "scale-75 border-[var(--line-strong)] bg-transparent"
                    )}
                  />
                  {n.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPalette}
              aria-label={`${mod} K: open command palette`}
              aria-keyshortcuts="Control+K Meta+K"
              className="inline-flex h-12 items-center gap-1.5 rounded-full border border-line px-4 font-mono text-[13px] text-muted transition-colors hover:border-fg/30 hover:text-fg"
            >
              <kbd className="font-mono">{mod}</kbd>{" "}
              <kbd className="font-mono">K</kbd>
            </button>
            <a
              href={onHome ? "#contact" : "/#contact"}
              onClick={go("contact")}
              className="hidden h-12 items-center rounded-full bg-accent px-5 text-[15px] font-medium text-bg transition-colors duration-300 hover:bg-accent-hover md:inline-flex"
            >
              Hire me
            </a>
            <button
              type="button"
              className="relative z-[60] -mr-2 flex h-11 w-11 items-center justify-center md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span className={cn("absolute h-px w-6 bg-fg transition-transform duration-500 ease-expo", open ? "rotate-45" : "-translate-y-1")} />
              <span className={cn("absolute h-px w-6 bg-fg transition-transform duration-500 ease-expo", open ? "-rotate-45" : "translate-y-1")} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-0 z-40 flex flex-col justify-center bg-bg/[0.98] px-6 transition-opacity duration-500 md:hidden",
          open ? "visible opacity-100" : "invisible opacity-0"
        )}
        aria-hidden={!open}
        inert={!open ? ("" as unknown as boolean) : undefined}
      >
        <ul className="space-y-2">
          {nav.map((n, i) => (
            <li key={n.id} className="overflow-hidden">
              <a
                href={onHome ? `#${n.id}` : `/#${n.id}`}
                onClick={go(n.id)}
                className={cn(
                  "block font-display text-5xl font-semibold tracking-tight transition-transform duration-700 ease-expo",
                  open ? "translate-y-0" : "translate-y-full"
                )}
                style={{ transitionDelay: open ? `${80 + i * 60}ms` : "0ms" }}
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
