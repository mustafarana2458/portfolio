import { contact, contactSection, services, sectionWires } from "@/data/content";
import Node from "@/components/pipeline/Node";
import WireField from "@/components/ui/WireField";
import ContactForm from "@/components/pipeline/ContactForm";
import CopyEmail from "@/components/ui/CopyEmail";
import SplitReveal from "@/components/ui/SplitReveal";

export default function Contact() {
  const links = [
    contact.whatsapp && { label: "WhatsApp", ariaLabel: "Chat on WhatsApp", href: contact.whatsapp.href, icon: "whatsapp" as const },
    { label: "LinkedIn", href: contact.linkedin },
    { label: "GitHub", href: contact.github },
  ].filter(Boolean) as { label: string; href: string; ariaLabel?: string; icon?: "whatsapp" }[];

  return (
    <section id="contact" className="section pb-20 md:pb-28">
      <div className="container">
        <div className="relative">
        <WireField seed="contact" color={sectionWires.contact.color} labels={sectionWires.contact.labels} variant="section" ports="in" />
        <Node
          name="Output · Contact"
          icon="send"
          anchor="contact"
          ports="in"
          meta={{ idle: "waiting for input", running: "executing…", success: "ready" }}
          bodyClassName="grid gap-12 p-6 md:p-10 xl:p-14 lg:grid-cols-12"
        >
          <div className="lg:col-span-6">
            <p className="eyebrow mb-4">07 · {contactSection.eyebrow.toLowerCase()}</p>
            <SplitReveal
              text={contactSection.heading}
              className="text-[clamp(2.5rem,1rem+3.6vw,80px)] font-semibold leading-[1.02]"
            />
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{contactSection.body}</p>

            <div className="mt-10 space-y-6">
              <CopyEmail email={contact.email} className="[&_a]:text-xl md:[&_a]:text-2xl" />
              <ul className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={l.ariaLabel ?? `${l.label} (opens in new tab)`}
                      className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 font-mono text-[13px] text-fg transition-colors hover:border-fg/40"
                    >
                      {l.icon === "whatsapp" && <WhatsAppIcon />}
                      {l.label}
                    </a>
                  </li>
                ))}
                {contact.cv && (
                  <li>
                    <a
                      href={contact.cv}
                      download
                      className="inline-flex h-12 items-center rounded-full border border-fg/25 px-5 font-mono text-[13px] text-fg transition-colors hover:border-accent hover:text-accent"
                    >
                      Download CV ↓
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-xl border border-line bg-bg/60">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[12px] text-muted">
                <span>input · parameters</span>
                <span>send message</span>
              </div>
              <div className="p-5 md:p-6">
                <ContactForm services={services.items.map(({ id, title }) => ({ id, title }))} email={contact.email} />
              </div>
            </div>
          </div>
        </Node>
        </div>
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.23-.73-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}
