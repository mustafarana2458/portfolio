import { services, sectionWires } from "@/data/content";
import Node from "@/components/pipeline/Node";
import WireField from "@/components/ui/WireField";
import NodeIcon, { type IconName } from "@/components/pipeline/NodeIcon";
import RevealOnExecute from "@/components/pipeline/RevealOnExecute";
import UseTemplateButton from "@/components/pipeline/UseTemplateButton";
import SplitReveal from "@/components/ui/SplitReveal";

const icons: Record<string, IconName> = { saas: "code", website: "globe", automation: "layers", agents: "ai" };

export default function Services() {
  return (
    <section id="services" className="section">
      <div className="container">
        <div className="relative">
        <WireField seed="services" color={sectionWires.services.color} labels={sectionWires.services.labels} variant="section" ports="both" />
        <Node
          name="Workflow templates · Services"
          icon="template"
          anchor="services"
          meta={{ success: `success · ${services.items.length} templates` }}
          bodyClassName="p-6 md:p-10 xl:p-14"
        >
          <p className="eyebrow mb-4">06 · services</p>
          <SplitReveal text={services.heading} className="mb-10 h-section" />
          <RevealOnExecute className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
            {services.items.map((s) => (
              <article key={s.id} className="flex flex-col rounded-xl border border-line bg-bg/60 p-6 transition-colors hover:border-fg/20">
                <div className="mb-8 flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-fg/80">
                    <NodeIcon name={icons[s.id] ?? "template"} />
                  </span>
                  <span className="font-mono text-[12px] text-muted">template · {s.id}</span>
                </div>
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-muted">{s.body}</p>
                <div className="mt-6">
                  <UseTemplateButton id={s.id} title={s.title} />
                </div>
              </article>
            ))}
          </RevealOnExecute>
        </Node>
        </div>
      </div>
    </section>
  );
}
