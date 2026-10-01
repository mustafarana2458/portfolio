import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { caseStudies, projects, site } from "@/data/content";
import Node from "@/components/pipeline/Node";
import type { IconName } from "@/components/pipeline/NodeIcon";
import ArchitectureDiagram from "@/components/pipeline/ArchitectureDiagram";
import CaseMedia from "@/components/pipeline/CaseMedia";
import TransitionLink from "@/components/pipeline/TransitionLink";
import AutoExecute from "@/components/pipeline/AutoExecute";
import CardMediaView from "@/components/ui/CardMediaView";
import ExportedImage from "next-image-export-optimizer";
import { cardMedia } from "@/lib/media";
import { cn } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

const find = (slug: string) => {
  const cs = caseStudies.find((c) => c.slug === slug);
  const p = projects.find((x) => x.slug === slug);
  return cs && p ? { cs, p } : null;
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const f = find(params.slug);
  if (!f) return {};
  const title = `${f.p.title} — case study`;
  const description = `${f.p.problem} ${f.p.solution}`;
  return {
    title,
    description,
    alternates: { canonical: `/work/${f.p.slug}/` },
    openGraph: { title: `${title} · ${site.name}`, description, url: `/work/${f.p.slug}/`, images: [{ url: "/og.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

const isTodo = (s: string) => s.trim().toUpperCase().startsWith("TODO");

/** Renders a fact; anything marked TODO gets a visible badge so it can't ship unnoticed. */
function Fact({ text, className }: { text: string; className?: string }) {
  if (!isTodo(text)) return <p className={className}>{text}</p>;
  return (
    <p className={cn(className, "rounded-lg border border-dashed border-fg/25 px-3 py-2 italic text-fg/60")}>
      <span className="mr-2 rounded bg-fg/10 px-1.5 py-0.5 font-mono text-[12px] not-italic text-fg">TODO</span>
      {text.replace(/^TODO:?\s*/i, "")}
    </p>
  );
}

export default function CaseStudyPage({ params }: { params: { slug: string } }) {
  const f = find(params.slug);
  if (!f) notFound();
  const { cs, p } = f;
  const idx = caseStudies.findIndex((c) => c.slug === cs.slug);
  const next = caseStudies[(idx + 1) % caseStudies.length];
  const nextProject = projects.find((x) => x.slug === next.slug)!;
  const media = cardMedia(p);

  const steps: { name: string; icon: IconName; body: React.ReactNode }[] = [
    { name: "The problem", icon: "bolt", body: <Fact text={cs.problem} className="text-lg leading-relaxed text-fg/90" /> },
    { name: "My role", icon: "user", body: <Fact text={cs.role} className="text-lg leading-relaxed text-fg/90" /> },
    {
      name: "Architecture",
      icon: "layers",
      body: <ArchitectureDiagram nodes={cs.architecture.nodes} edges={cs.architecture.edges} title={p.title} />,
    },
    {
      name: "Key decisions",
      icon: "code",
      body: (
        <ul className="space-y-3">
          {cs.decisions.map((d) => (
            <li key={d}>
              <Fact text={d} className="leading-relaxed text-fg/85" />
            </li>
          ))}
        </ul>
      ),
    },
    {
      name: "Challenges",
      icon: "terminal",
      body: (
        <ul className="space-y-3">
          {cs.challenges.map((d) => (
            <li key={d}>
              <Fact text={d} className="leading-relaxed text-fg/85" />
            </li>
          ))}
        </ul>
      ),
    },
    { name: "Result", icon: "send", body: <Fact text={cs.result} className="text-lg leading-relaxed text-fg/90" /> },
  ];

  return (
    <article className="pb-24 pt-[calc(var(--nav-h)+2.5rem)]">
      <div className="container">
        <TransitionLink href="/#work" className="inline-flex items-center gap-2 font-mono text-[12px] text-muted transition-colors hover:text-fg">
          <span aria-hidden>←</span> all workflows
        </TransitionLink>

        <header className="mt-8 max-w-4xl">
          <p className="eyebrow mb-4">case study · {p.kind.toLowerCase()}</p>
          <h1 className="text-[clamp(2.75rem,7vw,6rem)] font-semibold leading-[0.98]">
            {p.title} <span className="accent-serif text-fg/80">case study</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">
            {p.problem} <span className="text-fg/90">→ {p.solution}</span>
          </p>
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
            {p.private && <span className="inline-flex h-12 items-center rounded-full border border-line px-5 font-mono text-[12px] text-muted">private repo · case study only</span>}
          </div>
        </header>

        <div className="relative mt-12 overflow-hidden rounded-2xl border border-line md:mt-16">
          <CardMediaView media={media} title={p.title} kind={p.kind} cover={p.cover} slug={p.slug} sizes="(min-width: 1360px) 1264px, 92vw" priority hoverVideo={false} />
          {media.video && <CaseMedia mp4={media.video.mp4} webm={media.video.webm} poster={media.video.poster} label={`Scroll-through recording of ${p.title}`} />}
        </div>

        {cs.gallery?.length ? (
          <section aria-labelledby="screens-h" className="mt-8 md:mt-10">
            <h2 id="screens-h" className="sr-only">
              Screens
            </h2>
            <ul className="grid gap-6 md:grid-cols-2">
              {cs.gallery.map((g) => (
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
            {cs.galleryNote && <p className="mt-4 font-mono text-[13px] text-muted">{cs.galleryNote}</p>}
          </section>
        ) : null}

        {/* The case study itself is a small workflow: one node per step, joined by an edge. */}
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
          <li className="relative pl-10 md:pl-14">
            <span aria-hidden className="absolute left-[14px] top-[15px] h-[9px] w-[9px] rounded-full border border-[var(--line-strong)] bg-bg md:left-[22px]" />
            <Node as="section" name={`${String(steps.length + 1).padStart(2, "0")} · Stack`} icon="grid" ports="none" bodyClassName="p-6 md:p-8">
              <h2 className="sr-only">Stack</h2>
              <ul className="flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <li key={t} className="tag text-[12px]">
                    {t}
                  </li>
                ))}
              </ul>
              <AutoExecute delay={150 + steps.length * 120} />
            </Node>
          </li>
        </ol>

        <nav aria-label="Next case study" className="mt-20 border-t border-line pt-10">
          <p className="eyebrow mb-3">next workflow</p>
          <TransitionLink href={`/work/${next.slug}/`} className="group inline-flex items-baseline gap-4 font-display text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-none">
            {nextProject.title}
            <span aria-hidden className="text-accent transition-transform duration-500 ease-expo group-hover:translate-x-2">→</span>
          </TransitionLink>
        </nav>
      </div>
    </article>
  );
}
