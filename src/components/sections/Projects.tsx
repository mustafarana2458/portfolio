import { caseStudies, projects, type Project } from "@/data/content";
import Node from "@/components/pipeline/Node";
import RevealOnExecute from "@/components/pipeline/RevealOnExecute";
import CardMediaView from "@/components/ui/CardMediaView";
import SplitReveal from "@/components/ui/SplitReveal";
import TransitionLink from "@/components/pipeline/TransitionLink";
import { cn } from "@/lib/utils";
import { cardMedia } from "@/lib/media";
import WireField from "@/components/ui/WireField";

const studied = new Set(caseStudies.map((c) => c.slug));
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** "Run metrics": derived from content.ts only, never invented numbers. */
function runMetrics(p: Project) {
  const m: [string, string][] = [["stack", `${p.tags.length} tools`]];
  m.push(["status", p.live ? "live" : p.private ? "private" : "repo"]);
  if (p.live) m.push(["host", host(p.live)]);
  m.push(["repo", p.github ? "public" : p.private ? "private" : "—"]);
  return m;
}

export default function Projects() {
  return (
    <section id="work" className="section">
      <div className="container">
        <div className="mb-14 max-w-4xl md:mb-20">
          <p className="eyebrow mb-4">03 · featured work</p>
          <SplitReveal text="Selected *projects*." className="h-section" />
        </div>
      </div>

      {/* Featured nodes get the wider 1440px frame. */}
      <div className="container container-wide">
        <ol className="space-y-16 md:space-y-24">
          {projects.map((p, i) => (
            <li key={p.slug} className="relative">
              <WireField seed={p.slug} color={p.color} labels={p.wireLabels} />
              <ProjectNode p={p} i={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const btn = "inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] transition-colors";

function ProjectNode({ p, i }: { p: Project; i: number }) {
  const n = String(i + 1).padStart(2, "0");
  const flip = i % 2 === 1; // media alternates sides on desktop
  return (
    <Node
      as="article"
      name={`Project ${n} · ${p.title}`}
      icon={p.kind.toLowerCase().includes("agent") ? "ai" : "box"}
      anchor={`project-${p.slug}`}
      hoverRoot
      meta={{ idle: "queued", success: p.private ? "success · private" : "success" }}
      bodyClassName="grid lg:grid-cols-[3fr_2fr]"
    >
      {/* 16:10 media frame (~60% of the node), the same aspect as the hover capture, so nothing crops. */}
      <div
        className={cn(
          "relative flex items-center overflow-hidden border-b border-line bg-bg/40 lg:border-b-0",
          flip ? "lg:order-2 lg:rounded-br-2xl lg:border-l" : "lg:rounded-bl-2xl lg:border-r"
        )}
      >
        <CardMediaView
          media={cardMedia(p)}
          title={p.title}
          kind={p.kind}
          index={i}
          cover={p.cover}
          slug={p.slug}
          sizes="(min-width: 1520px) 864px, (min-width: 1024px) 58vw, 94vw"
          className="w-full"
        />
        {p.private && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md border border-line bg-bg/90 px-2.5 py-1 font-mono text-[12px] text-fg">
            <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="2" y="5.5" width="8" height="5.5" rx="1.2" />
              <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" />
            </svg>
            private / case study
          </span>
        )}
      </div>

      <RevealOnExecute className="flex flex-col p-6 md:p-10 xl:p-12" stagger={0.08}>
        <div>
          <p className="eyebrow mb-3">{p.kind}</p>
          <h3 className="text-[clamp(2rem,1rem+2.4vw,3.5rem)] font-semibold leading-[1.02]">{p.title}</h3>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            {p.problem} <span className="text-fg/90">→ {p.solution}</span>
          </p>
        </div>
        <div className="mt-auto pt-8">
          <ul className="flex flex-wrap gap-1.5" aria-label="Tech stack">
            {p.tags.map((t) => (
              <li key={t} className="tag">
                {t}
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line font-mono text-[12px]">
            {runMetrics(p).map(([k, v]) => (
              <div key={k} className="bg-bg/80 px-3 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="truncate text-fg/85">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {studied.has(p.slug) && (
              <TransitionLink href={`/work/${p.slug}/`} className={cn(btn, "bg-accent font-medium text-bg hover:bg-accent-hover")}>
                Open case study <span aria-hidden>→</span>
                <span className="sr-only">: {p.title}</span>
              </TransitionLink>
            )}
            {p.live && (
              <a
                href={p.live}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${p.title} live site (opens in new tab)`}
                className={cn(btn, "border border-fg/20 text-fg hover:border-fg/50")}
              >
                Live <span aria-hidden>↗</span>
              </a>
            )}
            {p.github && (
              <a
                href={p.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${p.title} on GitHub (opens in new tab)`}
                className={cn(btn, "border border-line text-muted hover:border-fg/30 hover:text-fg")}
              >
                GitHub
              </a>
            )}
          </div>
        </div>
      </RevealOnExecute>
    </Node>
  );
}
