import { about, sectionWires } from "@/data/content";
import Node from "@/components/pipeline/Node";
import WireField from "@/components/ui/WireField";
import TriggerOutput from "@/components/pipeline/TriggerOutput";
import RevealOnExecute from "@/components/pipeline/RevealOnExecute";
import SplitReveal from "@/components/ui/SplitReveal";

export default function About() {
  // Real numbers only: stats with value null (the default) are left out entirely.
  const stats = about.stats.filter((s) => s.value !== null).map((s) => `${s.value}${s.suffix} ${s.label.toLowerCase()}`);
  const profile = stats.length ? { ...about.profile, stats } : about.profile;

  return (
    <section id="about" className="section">
      <div className="container">
        <div className="relative">
        <WireField seed="about" color={sectionWires.about.color} labels={sectionWires.about.labels} variant="section" ports="both" />
        <Node
          name="Trigger · About"
          icon="bolt"
          anchor="about"
          meta={{ idle: "waiting for scroll", success: "success" }}
          bodyClassName="grid gap-10 p-6 md:p-10 xl:p-14 lg:grid-cols-12 lg:gap-12"
        >
          <div className="lg:col-span-6">
            <p className="eyebrow mb-4">01 · about</p>
            <SplitReveal text={about.heading} className="h-section" />
            <RevealOnExecute className="mt-8 space-y-5 text-lg leading-relaxed text-muted" stagger={0.1}>
              {about.paragraphs.map((p, i) => (
                <p key={i} className={i === 0 ? "text-fg/90" : undefined}>
                  {p}
                </p>
              ))}
            </RevealOnExecute>
          </div>
          <RevealOnExecute className="lg:col-span-6" stagger={0}>
            <TriggerOutput data={profile} />
          </RevealOnExecute>
        </Node>
        </div>
      </div>
    </section>
  );
}
