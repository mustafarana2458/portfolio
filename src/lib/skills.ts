// Skills → logo (simple-icons) + where each skill was used, derived from content.ts only.
// Server-side: only the few SVG paths that are used reach the client, as props.
import {
  siCaddy,
  siClaude,
  siDocker,
  siFlutter,
  siJavascript,
  siLanggraph,
  siLinux,
  siN8n,
  siNextdotjs,
  siNodedotjs,
  siPhp,
  siPostgresql,
  siPython,
  siReact,
  siSupabase,
  siTailwindcss,
  siTypescript,
} from "simple-icons";
import { caseStudies, clientWork, experience, projects, skills } from "@/data/content";
import type { IconName } from "@/components/pipeline/NodeIcon";

// AWS (removed from simple-icons for trademark reasons) and Remotion (not in the set) use a
// neutral NodeIcon glyph instead of a logo.
const LOGOS: Record<string, { path: string } | IconName> = {
  TypeScript: siTypescript,
  JavaScript: siJavascript,
  React: siReact,
  "Next.js": siNextdotjs,
  "Tailwind CSS": siTailwindcss,
  "Flutter (basics)": siFlutter,
  "Node.js": siNodedotjs,
  PHP: siPhp,
  Python: siPython,
  PostgreSQL: siPostgresql,
  Supabase: siSupabase,
  LangGraph: siLanggraph,
  "Claude / LLM APIs": siClaude,
  n8n: siN8n,
  Remotion: "film",
  Docker: siDocker,
  AWS: "infra",
  "Linux / VPS": siLinux,
  Caddy: siCaddy,
};

const GROUP_ICONS: Record<string, IconName> = { Frontend: "code", Backend: "data", "AI & Automation": "ai", DevOps: "infra" };

/** "Claude / LLM APIs" → ["claude", "llm apis"]; "Tailwind CSS" also matches "tailwind". */
function terms(skill: string) {
  const base = skill.replace(/\(.*?\)/g, "").split("/").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const extra: Record<string, string[]> = { "tailwind css": ["tailwind"], "llm apis": ["llm"] };
  return base.flatMap((t) => [t, ...(extra[t] ?? [])]);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, t: string) => new RegExp(`(^|[^a-z0-9])${escape(t)}([^a-z0-9]|$)`, "i").test(text);

/** Project / client / employer names whose tags, architecture or role description mention the skill. */
function usedIn(skill: string) {
  const ts = terms(skill);
  const hit = (texts: string[]) => texts.some((x) => ts.some((t) => mentions(x, t)));
  const out: string[] = [];
  for (const p of projects) {
    const cs = caseStudies.find((c) => c.slug === p.slug);
    const arch = cs ? cs.architecture.nodes.flatMap((n) => [n.label, n.note ?? ""]) : [];
    if (hit([...p.tags, ...arch])) out.push(p.title);
  }
  for (const c of clientWork) if (hit(c.tags)) out.push(c.title);
  for (const e of experience) if (hit(e.points)) out.push(e.org);
  return Array.from(new Set(out));
}

export type SkillItem = { name: string; logo?: string; glyph?: IconName; usedIn: string[] };
export type SkillGroup = { name: string; icon: IconName; items: SkillItem[] };

export function skillGroups(): SkillGroup[] {
  return skills.groups.map((g) => ({
    name: g.name,
    icon: GROUP_ICONS[g.name] ?? "grid",
    items: g.items.map((name) => {
      const l = LOGOS[name];
      return {
        name,
        ...(typeof l === "string" ? { glyph: l } : l ? { logo: l.path } : { glyph: "box" as IconName }),
        usedIn: usedIn(name),
      };
    }),
  }));
}
