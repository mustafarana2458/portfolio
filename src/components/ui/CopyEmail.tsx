"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function CopyEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Fallback for browsers/contexts without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-3 sm:flex-row sm:items-center", className)}>
      <a
        href={`mailto:${email}`}
        className="break-all font-display text-2xl font-medium tracking-tight underline decoration-line decoration-1 underline-offset-8 transition-colors hover:decoration-accent md:text-4xl"
      >
        {email}
      </a>
      <button
        type="button"
        onClick={copy}
        className="relative inline-flex h-12 shrink-0 items-center whitespace-nowrap justify-center gap-2 overflow-hidden rounded-full border border-line px-5 text-sm text-fg transition-colors hover:border-fg/30"
      >
        <span className={cn("inline-flex items-center gap-2 transition-transform duration-500 ease-expo", copied && "-translate-y-[150%]")}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <rect x="5" y="5" width="9" height="9" rx="2" />
            <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
          </svg>
          Copy email
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center justify-center gap-2 text-accent transition-transform duration-500 ease-expo",
            copied ? "translate-y-0" : "translate-y-[150%]"
          )}
        >
          ✓ Copied
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Email address copied to clipboard" : ""}
      </span>
    </div>
  );
}
