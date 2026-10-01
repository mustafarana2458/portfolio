import { cn } from "@/lib/utils";

type Props = { title: string; kind: string; index?: number; className?: string };

/** Designed stand-in for projects without a screenshot yet — clearly artwork, not a fake UI. */
export default function ProjectCover({ title, kind, className }: Props) {
  const monogram = title
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div
      role="img"
      aria-label={`${title} cover artwork (${kind})`}
      className={cn("relative h-full w-full overflow-hidden bg-surface", className)}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, #000 25%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, #000 25%, transparent 75%)",
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center font-display text-[clamp(7rem,22vw,20rem)] font-semibold leading-none tracking-tighter text-transparent"
        style={{ WebkitTextStroke: "1.5px rgb(var(--fg) / 0.28)" }}
      >
        {monogram}
      </span>
      <span aria-hidden className="absolute bottom-[10%] left-[12%] h-1 w-10 rounded-full bg-accent" />
    </div>
  );
}
