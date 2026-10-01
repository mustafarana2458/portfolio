import { experience, sectionWires } from "@/data/content";
import Node from "@/components/pipeline/Node";
import WireField from "@/components/ui/WireField";
import HistoryTable from "@/components/pipeline/HistoryTable";
import RevealOnExecute from "@/components/pipeline/RevealOnExecute";
import SplitReveal from "@/components/ui/SplitReveal";

export default function Experience() {
  return (
    <section id="experience" className="section">
      <div className="container">
        <div className="relative">
        <WireField seed="experience" color={sectionWires.experience.color} labels={sectionWires.experience.labels} variant="section" ports="both" />
        <Node
          name="Execution history · Experience"
          icon="clock"
          anchor="experience"
          meta={{ success: `success · ${experience.length} runs` }}
          bodyClassName="p-6 md:p-10 xl:p-14"
        >
          <p className="eyebrow mb-4">05 · experience</p>
          <SplitReveal text="Where I've *built*." className="mb-10 h-section" />
          <RevealOnExecute stagger={0}>
            <HistoryTable rows={experience} />
          </RevealOnExecute>
        </Node>
        </div>
      </div>
    </section>
  );
}
