import { executionLog, hero, site } from "@/data/content";
import { cn, parseAccent } from "@/lib/utils";
import Node from "@/components/pipeline/Node";
import HeroNetwork from "@/components/pipeline/HeroNetwork";
import ExecutionLog from "@/components/pipeline/ExecutionLog";
import AutoExecute from "@/components/pipeline/AutoExecute";
import RevealImage from "@/components/ui/RevealImage";
import HeroActions from "./HeroActions";

// Server-rendered and visible on first paint (no preloader, no hide-then-reveal):
// the headline is the LCP element. Motion comes from the canvas, log and node states.
export default function Hero() {
  const words = parseAccent(hero.headline);

  return (
    <section
      aria-label="Introduction"
      className="relative flex min-h-[100svh] items-center overflow-hidden pb-10 pt-[calc(var(--nav-h)+1.5rem)] lg:pb-8"
    >
      <HeroNetwork />

      <div className="container relative grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-7">
          {site.available && (
            <p className="eyebrow mb-5 flex items-center gap-2.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
              available for work · {site.location}
            </p>
          )}

          <h1 className="text-[clamp(2.75rem,min(7.4vw,12.5vh),120px)] font-semibold leading-[0.96]">
            {words.map((w, i) => (
              <span key={i} className={cn(w.accent && "accent-serif")}>
                {w.word}
                {i < words.length - 1 && " "}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted xl:text-[1.35rem]">{hero.subline}</p>

          <HeroActions />

          <Node
            name="Execution log"
            icon="terminal"
            ports="none"
            state="running"
            meta={{ running: "live" }}
            className="mt-8 max-w-xl"
            bodyClassName="px-4 py-2.5"
          >
            <ExecutionLog events={executionLog} rows={3} />
          </Node>
        </div>

        {/* Width follows viewport height on desktop so the whole hero fits in 100vh. */}
        <div className="mx-auto w-full min-w-0 max-w-[360px] lg:col-span-5 lg:mr-0 lg:w-[min(100%,calc((100svh_-_var(--nav-h)_-_40px_-_4.5rem)*0.8))] lg:max-w-none">
          <Node
            name={`operator: ${site.name}`}
            icon="user"
            anchor="hero"
            ports="out"
            meta={{ success: "online" }}
            bodyClassName="overflow-hidden rounded-b-2xl"
          >
            <RevealImage
              src="/images/portrait.png"
              alt={hero.portraitAlt}
              priority
              reveal={false}
              sizes="(min-width: 1024px) 34vw, 360px"
              className="aspect-[4/5] bg-surface"
              imgClassName="object-bottom [mask-image:linear-gradient(to_bottom,#000_62%,transparent_97%)]"
              underlay={
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: "radial-gradient(60% 55% at 50% 40%, rgb(var(--accent) / 0.08), transparent 72%)" }}
                />
              }
            />
            <AutoExecute delay={500} />
          </Node>
        </div>
      </div>
    </section>
  );
}
