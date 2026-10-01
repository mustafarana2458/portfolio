import { contact, site } from "@/data/content";
import Node from "@/components/pipeline/Node";
import ExecuteInView from "@/components/pipeline/ExecuteInView";
import FooterToast from "./FooterToast";
import BackToTop from "./BackToTop";

/** The closing node: the workflow's last step. */
export default function Footer() {
  const year = new Date().getFullYear();
  const socials = [
    { label: "GitHub", href: contact.github },
    { label: "LinkedIn", href: contact.linkedin },
    contact.whatsapp && { label: "WhatsApp", href: contact.whatsapp.href },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="relative z-10 pb-10 pt-4 md:pb-14">
      <div className="container">
        <Node
          name="End · Workflow complete"
          icon="bolt"
          ports="in"
          meta={{ idle: "waiting", running: "finishing…", success: "complete" }}
          bodyClassName="p-6 md:p-10 xl:p-14"
        >
          <p className="eyebrow mb-4 flex items-center gap-2.5">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
            all nodes executed
          </p>
          <h2 className="h-section">
            Workflow <span className="accent-serif">complete</span>.
          </h2>
          <a
            href={`mailto:${contact.email}`}
            className="mt-8 inline-block break-all font-display text-[clamp(1.6rem,0.8rem+3vw,4rem)] font-medium leading-tight tracking-tight underline decoration-[var(--line-strong)] decoration-2 underline-offset-[0.18em] transition-colors hover:decoration-accent"
          >
            {contact.email}
          </a>

          <div className="mt-10 flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
            <ul className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.label} (opens in new tab)`}
                    className="inline-flex h-12 items-center gap-1.5 rounded-full border border-line px-5 text-[15px] text-fg transition-colors hover:border-fg/40"
                  >
                    {s.label} <span aria-hidden className="text-muted">↗</span>
                  </a>
                </li>
              ))}
            </ul>
            <BackToTop />
          </div>
          <ExecuteInView />
        </Node>

        <p className="mt-6 font-mono text-[13px] text-muted">
          © {year} {site.name} · {site.location}
        </p>
      </div>
      <FooterToast />
    </footer>
  );
}
