import GlobalPipeline from "@/components/pipeline/GlobalPipeline";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Skills from "@/components/sections/Skills";
import Projects from "@/components/sections/Projects";
import ClientWork from "@/components/sections/ClientWork";
import Experience from "@/components/sections/Experience";
import Services from "@/components/sections/Services";
import Contact from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
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
