import { site } from "@/data/content";
import { pageMetadata, personLd } from "@/lib/seo";
import JsonLd from "@/components/ui/JsonLd";
import GlobalPipeline from "@/components/pipeline/GlobalPipeline";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Skills from "@/components/sections/Skills";
import Projects from "@/components/sections/Projects";
import ClientWork from "@/components/sections/ClientWork";
import Experience from "@/components/sections/Experience";
import Services from "@/components/sections/Services";
import Contact from "@/components/sections/Contact";

export const metadata = pageMetadata({ shareTitle: site.seoTitle, description: site.description, path: "/", type: "website" });

export default function Home() {
  return (
    <>
      <JsonLd data={personLd} />
      <GlobalPipeline />
      <Hero />
      <About />
      <Skills />
      <Projects />
      <ClientWork />
      <Experience />
      <Services />
      <Contact />
    </>
  );
}
