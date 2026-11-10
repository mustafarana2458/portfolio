import { projects, sectionWires, testimonials } from "@/data/content";
import { autoProjects } from "@/lib/autoProjects";
import Node from "@/components/pipeline/Node";
import WireField from "@/components/ui/WireField";
import RevealOnExecute from "@/components/pipeline/RevealOnExecute";
import TransitionLink from "@/components/pipeline/TransitionLink";
import SplitReveal from "@/components/ui/SplitReveal";
import { cn } from "@/lib/utils";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const projectTitle = (s: string) => [...projects, ...autoProjects].find((p) => p.slug === s)?.title;

/**
 * Testimonials: each quote is a node; consecutive nodes are joined by a wire with a packet
 * (port to port across the gap on wide screens, top to bottom when stacked). The packets are
 * `.loop-anim`: paused off screen and static on html.lite. Renders nothing while the
 * `testimonials` array is empty.
 */
export default function Testimonials() {
  const n = testimonials.length;
  if (!n) return null;
  return (
    <section id="testimonials" className="section">
      <div className="container">
        <div className="relative">
          <WireField seed="testimonials" color={sectionWires.testimonials.color} labels={sectionWires.testimonials.labels} variant="section" ports="both" />
          <Node
            name={`Webhook responses · Testimonials (${n})`}
            icon="send"
            anchor="testimonials"
            meta={{ success: `success · ${n} received` }}
            bodyClassName="p-6 md:p-10 xl:p-14"
          >
            <p className="eyebrow mb-4">feedback · testimonials</p>
            <SplitReveal text="What clients *say*." className="mb-10 h-section" />
            <RevealOnExecute as="ol" className="grid gap-12 md:grid-cols-2 md:gap-x-14 xl:grid-cols-3" stagger={0.08}>
              {testimonials.map((t, i) => {
                const last = i === n - 1;
                const title = t.projectSlug ? projectTitle(t.projectSlug) : undefined;
                return (
                  <li key={`${t.name}-${i}`} className="relative">
                    <Node
                      as="figure"
                      name={`response ${i + 1} · ${slug(t.company)}`}
                      icon="user"
                      ports={n === 1 ? "none" : i === 0 ? "out" : last ? "in" : "both"}
                      meta={{ success: "200 OK" }}
                      className="h-full bg-bg/60"
                      bodyClassName="flex h-[calc(100%-var(--node-header-h))] flex-col p-6"
                    >
                      <blockquote className="flex-1 text-lg leading-relaxed text-fg/90">
                        <p>
                          <span aria-hidden className="text-accent">“</span>
                          {t.quote}
                          <span aria-hidden className="text-accent">”</span>
                        </p>
                      </blockquote>
                      <figcaption className="mt-6 border-t border-line pt-4">
                        <p className="font-semibold">{t.name}</p>
                        <p className="mt-0.5 font-mono text-[12px] text-muted">
                          {t.role} · {t.company}
                        </p>
                        {t.projectSlug && title && (
                          <TransitionLink href={`/work/${t.projectSlug}/`} className="mt-3 inline-flex font-mono text-[12px] text-accent hover:text-accent-hover">
                            project · {title} →
                          </TransitionLink>
                        )}
                      </figcaption>
                    </Node>
                    {!last && <Wire i={i} />}
                  </li>
                );
              })}
            </RevealOnExecute>
          </Node>
        </div>
      </div>
    </section>
  );
}

/** Wire to the next card: down the gap when stacked, across the gap (row ends excepted) in a grid. */
function Wire({ i }: { i: number }) {
  return (
    <>
      <span aria-hidden className="absolute left-8 top-full h-12 w-px overflow-hidden bg-[var(--line-strong)] md:hidden">
        <span className="loop-anim absolute inset-0 [animation:packet-drop_1.6s_cubic-bezier(0.65,0,0.35,1)_infinite] [background:radial-gradient(circle,rgb(var(--accent))_0_2.5px,transparent_3.5px)_no-repeat_center/7px_7px]" />
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute left-full top-[calc(var(--node-header-h)/2)] hidden h-px w-14 overflow-hidden bg-[var(--line-strong)]",
          i % 2 === 0 ? "md:block" : "md:hidden",
          i % 3 === 2 ? "xl:hidden" : "xl:block"
        )}
      >
        <span className="loop-anim absolute inset-0 [animation:packet-run_1.6s_cubic-bezier(0.65,0,0.35,1)_infinite] [background:radial-gradient(circle,rgb(var(--accent))_0_2.5px,transparent_3.5px)_no-repeat_center/7px_7px]" />
      </span>
    </>
  );
}
