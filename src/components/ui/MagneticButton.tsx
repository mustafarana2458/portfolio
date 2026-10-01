"use client";

import { useRef, type ReactNode, type MouseEventHandler } from "react";
import { gsap, useDeferredGSAP, MQ } from "@/lib/gsap";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  variant?: "primary" | "ghost" | "outline";
  size?: "md" | "lg";
  external?: boolean;
  download?: boolean;
  className?: string;
  ariaLabel?: string;
};

const variants = {
  // Dark text on the accent keeps ~7:1 contrast.
  primary: "bg-accent text-bg hover:bg-accent-hover",
  outline: "border border-fg/25 text-fg hover:border-accent hover:text-accent",
  ghost: "border border-line text-fg hover:border-fg/30",
};

export default function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  external,
  download,
  className,
  ariaLabel,
}: Props) {
  const root = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useDeferredGSAP(() => {
    gsap.matchMedia().add(MQ.finePointer, () => {
        const el = root.current!;
        const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
        const ixTo = gsap.quickTo(inner.current, "x", { duration: 0.6, ease: "power3" });
        const iyTo = gsap.quickTo(inner.current, "y", { duration: 0.6, ease: "power3" });

        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          xTo(x * 0.3);
          yTo(y * 0.4);
          ixTo(x * 0.12);
          iyTo(y * 0.16);
        };
        const leave = () => {
          gsap.to([el, inner.current], { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.35)" });
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
  }, root);

  const cls = cn(
    "relative isolate inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-300",
    size === "lg" ? "h-14 px-8 text-base" : "h-12 px-6 text-[15px]",
    variants[variant],
    className
  );
  const content = (
    <span ref={inner} className="inline-flex items-center gap-2">
      {children}
    </span>
  );

  return (
    <span ref={root} className="inline-block">
      {href ? (
        <a
          href={href}
          onClick={onClick}
          className={cls}
          aria-label={ariaLabel}
          download={download || undefined}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {content}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
          {content}
        </button>
      )}
    </span>
  );
}
