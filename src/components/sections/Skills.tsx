import { skills, sectionWires } from "@/data/content";
import { skillGroups } from "@/lib/skills";
import Node from "@/components/pipeline/Node";
import WireField from "@/components/ui/WireField";
import SkillPalette from "@/components/pipeline/SkillPalette";
import RevealOnExecute from "@/components/pipeline/RevealOnExecute";
import SplitReveal from "@/components/ui/SplitReveal";

export default function Skills() {
  return (
    <section id="skills" className="section">
      <div className="container">
        <div className="relative">
        <WireField seed="skills" color={sectionWires.skills.color} labels={sectionWires.skills.labels} variant="section" ports="both" />
        <Node name="Node palette · Skills" icon="grid" anchor="skills" bodyClassName="p-6 md:p-10 xl:p-14">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-4">02 · skills</p>
              <SplitReveal text={skills.heading} className="h-section" />
            </div>
          </div>
          <RevealOnExecute stagger={0}>
            <SkillPalette groups={skillGroups()} />
          </RevealOnExecute>
        </Node>
        </div>
      </div>
    </section>
  );
}
