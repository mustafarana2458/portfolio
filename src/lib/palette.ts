"use client";

import { caseStudies, clientWork, contact, projects } from "@/data/content";
import { HERO_BURST_EVENT } from "./pipeline";

export const PALETTE_OPEN_EVENT = "palette:open";

export type Command = {
  id: string;
  group: "Navigate" | "Projects" | "Case studies" | "Actions" | "Links";
  label: string;
  hint?: string;
  keywords?: string;
  /** Run while the palette is still open and flash the returned confirmation. */
  stayOpen?: boolean;
  /** Returns an optional short confirmation (used with stayOpen). */
  run: (ctx: { go: (target: string) => void; push: (href: string) => void }) => void | string | Promise<string | void>;
};

const external = (href: string): void => {
  window.open(href, "_blank", "noopener,noreferrer");
};

export function buildCommands(): Command[] {
  const cmds: Command[] = [
    { id: "top", group: "Navigate", label: "Go to top", keywords: "home hero start", run: ({ go }) => go("top") },
    { id: "about", group: "Navigate", label: "About", keywords: "trigger bio json profile", run: ({ go }) => go("about") },
    { id: "skills", group: "Navigate", label: "Skills", keywords: "node palette stack tools", run: ({ go }) => go("skills") },
    { id: "work", group: "Navigate", label: "Featured work", keywords: "projects portfolio", run: ({ go }) => go("work") },
    { id: "clients", group: "Navigate", label: "Client work", keywords: "batch run websites", run: ({ go }) => go("clients") },
    { id: "experience", group: "Navigate", label: "Experience", keywords: "execution history cv jobs", run: ({ go }) => go("experience") },
    { id: "services", group: "Navigate", label: "Services", keywords: "workflow templates hire freelance", run: ({ go }) => go("services") },
    { id: "contact", group: "Navigate", label: "Contact", keywords: "output form email message hire", run: ({ go }) => go("contact") },
  ];

  projects.forEach((p) =>
    cmds.push({
      id: `project-${p.slug}`,
      group: "Projects",
      label: p.title,
      hint: p.kind,
      keywords: p.tags.join(" "),
      run: ({ go }) => go(`[data-pipeline-anchor="project-${p.slug}"]`),
    })
  );
  caseStudies.forEach((c) => {
    const p = projects.find((x) => x.slug === c.slug);
    cmds.push({
      id: `case-${c.slug}`,
      group: "Case studies",
      label: `Case study: ${p?.title ?? c.slug}`,
      keywords: "architecture deep dive",
      run: ({ push }) => push(`/work/${c.slug}/`),
    });
  });

  cmds.push(
    {
      id: "copy-email",
      group: "Actions",
      stayOpen: true,
      label: "Copy email address",
      hint: contact.email,
      keywords: "mail clipboard",
      run: async () => {
        try {
          await navigator.clipboard.writeText(contact.email);
          return "Copied to clipboard";
        } catch {
          window.location.href = `mailto:${contact.email}`;
        }
      },
    },
    {
      id: "burst",
      group: "Actions",
      label: "Run hero burst",
      hint: "packets ▸",
      keywords: "animation fun easter egg",
      run: ({ go }) => {
        go("top");
        window.setTimeout(() => window.dispatchEvent(new Event(HERO_BURST_EVENT)), 700);
      },
    }
  );
  if (contact.whatsapp) {
    const wa = contact.whatsapp;
    cmds.push({ id: "whatsapp", group: "Actions", label: "Open WhatsApp chat", keywords: "phone message chat", run: () => external(wa.href) });
  }
  if (contact.cv) {
    const cv = contact.cv;
    cmds.push({
      id: "cv",
      group: "Actions",
      label: "Download CV",
      keywords: "resume pdf",
      run: () => {
        const a = document.createElement("a");
        a.href = cv;
        a.download = "";
        a.click();
      },
    });
  }

  cmds.push(
    { id: "linkedin", group: "Links", label: "LinkedIn", keywords: "profile", run: () => external(contact.linkedin) },
    { id: "github", group: "Links", label: "GitHub", keywords: "code repos", run: () => external(contact.github) }
  );
  [...projects, ...clientWork].forEach((p) => {
    if (p.live) cmds.push({ id: `live-${p.title}`, group: "Links", label: `Open ${p.title} (live)`, hint: new URL(p.live).hostname, run: () => external(p.live!) });
  });
  return cmds;
}

/** Subsequence fuzzy match; higher is better, -1 = no match. */
export function fuzzyScore(query: string, text: string) {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (!q) return 0;
  let ti = 0, score = 0, streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 1 + streak * 2 + (found === 0 || t[found - 1] === " " ? 3 : 0);
    ti = found + 1;
  }
  return score - t.length * 0.01;
}
