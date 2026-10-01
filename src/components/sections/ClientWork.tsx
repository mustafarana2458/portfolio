import { clientWork, sectionWires } from "@/data/content";
import Node from "@/components/pipeline/Node";
import WireField, { CardWires } from "@/components/ui/WireField";
import BatchRunner from "@/components/pipeline/BatchRunner";
import CardMediaView from "@/components/ui/CardMediaView";
import { cardMedia } from "@/lib/media";
import SplitReveal from "@/components/ui/SplitReveal";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function ClientWork() {
  return (
    <section id="clients" className="section">
      <div className="container">
        <div className="relative">
        <WireField seed="clients" color={sectionWires.clients.color} labels={sectionWires.clients.labels} variant="section" ports="both" />
        <Node
          name={`Batch run · Client work (${clientWork.length} items)`}
          icon="layers"
          anchor="clients"
          meta={{ idle: "queued", success: `success · ${clientWork.length}/${clientWork.length}` }}
          bodyClassName="p-6 md:p-10 xl:p-14"
        >
          <p className="eyebrow mb-4">04 · client work</p>
          <SplitReveal text="Built for *real businesses*." className="mb-10 h-section" />

          <ul className="grid gap-5 md:grid-cols-2">
            {clientWork.map((c, i) => (
              <li key={c.title}>
                <Node
                  as="article"
                  name={`item ${i + 1} · ${slug(c.title)}`}
                  icon="globe"
                  ports="none"
                  hoverRoot
                  data={{ "batch-item": "" }}
                  meta={{ idle: "queued", success: "done" }}
                  className="group h-full bg-bg/60"
                >
                  <CardWires seed={c.title} color={c.color} labels={c.wireLabels} />
                  <div className="overflow-hidden border-b border-line">
                    <CardMediaView
                      media={cardMedia(c)}
                      title={c.title}
                      kind={c.client}
                      index={i}
                      sizes="(min-width: 1360px) 600px, (min-width: 768px) 44vw, 92vw"
                      className="transition-transform duration-[1.2s] ease-expo group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div>
                      <h3 className="text-xl font-semibold md:text-2xl">{c.title}</h3>
                      <p className="mt-0.5 font-mono text-[12px] text-muted">{c.client}</p>
                      <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">{c.summary}</p>
                      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tech stack">
                        {c.tags.map((t) => (
                          <li key={t} className="tag">
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {c.live && (
                      <a
                        href={c.live}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit ${c.title} (opens in new tab)`}
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line text-fg transition-all duration-500 ease-expo hover:rotate-45 hover:border-transparent hover:bg-accent hover:text-bg"
                      >
                        <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M4 10 10 4m0 0H5m5 0v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    )}
                  </div>
                </Node>
              </li>
            ))}
          </ul>
          <BatchRunner />
        </Node>
        </div>
      </div>
    </section>
  );
}
