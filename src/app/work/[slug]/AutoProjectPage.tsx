import Node from "@/components/pipeline/Node";
import type { IconName } from "@/components/pipeline/NodeIcon";
import CaseMedia from "@/components/pipeline/CaseMedia";
import TransitionLink from "@/components/pipeline/TransitionLink";
import AutoExecute from "@/components/pipeline/AutoExecute";
import CardMediaView from "@/components/ui/CardMediaView";
import ExportedImage from "next-image-export-optimizer";
import { cardMedia } from "@/lib/media";
import type { AutoProject } from "@/lib/autoProjects";

/**
 * /work/<slug> for a GitHub-synced project: the same layout as a case study, filled only with
 * what the README says (first paragraph + feature bullets). Nothing here is written by hand.
 */
export default function AutoProjectPage({ p, next }: { p: AutoProject; next: { slug: string; title: string } }) {
  const media = cardMedia(p);
  const steps: { name: string; icon: IconName; body: React.ReactNode }[] = [];
  // The header already shows the description (or the intro when there is none): don't repeat it.
  if (p.intro && p.intro !== p.problem) steps.push({ name: "Overview", icon: "bolt", body: <p className="text-lg leading-relaxed text-fg/90">{p.intro}</p> });
  if (p.features.length)
    steps.push({
      name: "Features",
      icon: "code",
      body: (
        <ul className="list-disc space-y-2 pl-5 marker:text-fg/40">
          {p.features.map((f) => (
            <li key={f} className="leading-relaxed text-fg/85">
              {f}
            </li>
          ))}
        </ul>
      ),
    });
  if (p.tags.length)
    steps.push({
      name: "Stack",
      icon: "grid",
      body: (
        <ul className="flex flex-wrap gap-2">
          {p.tags.map((t) => (
            <li key={t} className="tag text-[12px]">
              {t}
            </li>
          ))}
        </ul>
      ),
    });

  return (
    <article className="pb-24 pt-[calc(var(--nav-h)+2.5rem)]">
      <div className="container">
        <TransitionLink href="/#work" className="inline-flex items-center gap-2 font-mono text-[12px] text-muted transition-colors hover:text-fg">
          <span aria-hidden>←</span> all workflows
        </TransitionLink>

        <header className="mt-8 max-w-4xl">
          <p className="eyebrow mb-4">project · {p.kind.toLowerCase()}</p>
          <h1 className="text-[clamp(2.75rem,7vw,6rem)] font-semibold leading-[0.98]">{p.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">{p.problem}</p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {p.live && (
              <a href={p.live} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-1.5 rounded-full bg-accent px-5 text-[15px] font-medium text-bg transition-colors hover:bg-accent-hover">
                Live site <span aria-hidden>↗</span>
                <span className="sr-only">(opens in new tab)</span>
              </a>
            )}
            {p.github && (
              <a href={p.github} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-1.5 rounded-full border border-fg/20 px-5 text-[15px] text-fg transition-colors hover:border-fg/50">
                GitHub <span className="sr-only">(opens in new tab)</span>
              </a>
            )}
          </div>
        </header>

        <div className="relative mt-12 overflow-hidden rounded-2xl border border-line md:mt-16">
          <CardMediaView media={media} title={p.title} kind={p.kind} slug={p.slug} sizes="(min-width: 1360px) 1264px, 92vw" priority hoverVideo={false} />
          {media.video && <CaseMedia mp4={media.video.mp4} webm={media.video.webm} poster={media.video.poster} label={`Scroll-through recording of ${p.title}`} />}
        </div>

        {p.gallery.length ? (
          <section aria-labelledby="screens-h" className="mt-8 md:mt-10">
            <h2 id="screens-h" className="sr-only">
              Screens
            </h2>
            <ul className="grid gap-6 md:grid-cols-2">
              {p.gallery.map((g) => (
                <li key={g.src}>
                  <figure>
                    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-surface">
                      <ExportedImage src={g.src} alt={g.alt} fill sizes="(min-width: 1360px) 640px, (min-width: 768px) 46vw, 92vw" className="object-cover object-top" />
                    </div>
                    <figcaption className="mt-3 font-mono text-[13px] text-muted">{g.caption}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ol className="relative mt-20 space-y-10 before:absolute before:bottom-8 before:left-[18px] before:top-8 before:w-px before:bg-[var(--line-strong)] md:space-y-14 md:before:left-[26px]">
          {steps.map((s, i) => (
            <li key={s.name} className="relative pl-10 md:pl-14">
              <span aria-hidden className="absolute left-[14px] top-[15px] h-[9px] w-[9px] rounded-full border border-[var(--line-strong)] bg-bg md:left-[22px]" />
              <Node as="section" name={`${String(i + 1).padStart(2, "0")} · ${s.name}`} icon={s.icon} ports="none" bodyClassName="p-6 md:p-8">
                <h2 className="sr-only">{s.name}</h2>
                {s.body}
                <AutoExecute delay={150 + i * 120} />
              </Node>
            </li>
          ))}
        </ol>
        <p className="mt-8 font-mono text-[13px] text-muted">Summary taken from the README of {p.repo}; synced automatically from GitHub.</p>

        <nav aria-label="Next case study" className="mt-20 border-t border-line pt-10">
          <p className="eyebrow mb-3">next workflow</p>
          <TransitionLink href={`/work/${next.slug}/`} className="group inline-flex items-baseline gap-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-none">
            {next.title}
            <span aria-hidden className="text-accent transition-transform duration-500 ease-expo group-hover:translate-x-2">→</span>
          </TransitionLink>
        </nav>
      </div>
    </article>
  );
}
