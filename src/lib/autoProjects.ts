// GitHub-synced projects (src/data/auto-projects.json, written by scripts/auto-projects.mjs).
// Shown after the featured projects with the same card, and a /work/<slug> page built from the
// README summary. Only projects with a live site and a full capture (screenshot + video) get a
// card. Anything already in content.ts wins: same slug, repo or live URL (or site.url) is dropped
// here too, so editing content.ts takes effect without waiting for the next sync.
// Malformed entries are skipped rather than breaking the build.
import data from "@/data/auto-projects.json";
import { caseStudies, clientWork, projects, site, type Project } from "@/data/content";

export const AUTO_MAX = 12;
/** Wire colour when the data has none (or an invalid one): the site's orange accent, as in the sync. */
const FALLBACK_COLOR = "#FF6B35";
const hexColor = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : FALLBACK_COLOR);

export type AutoProject = Project & {
  auto: true;
  repo: string;
  language?: string;
  topics: string[];
  poster?: string;
  intro: string;
  features: string[];
  gallery: { src: string; alt: string; caption: string }[];
};

const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter(str) : []);
const local = (v: unknown, prefix: string): string | undefined => (str(v) && v.startsWith(prefix) && !v.includes("..") ? v : undefined);
const url = (v: unknown): string | undefined => {
  if (!str(v)) return undefined;
  try {
    return ["http:", "https:"].includes(new URL(v).protocol) ? v : undefined;
  } catch {
    return undefined;
  }
};
const norm = (u?: string) => {
  if (!u) return undefined;
  const x = new URL(u);
  return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
};

const taken = {
  slugs: new Set([...projects.map((p) => p.slug), ...caseStudies.map((c) => c.slug)]),
  repos: new Set(projects.map((p) => p.github?.toLowerCase().replace(/\/+$/, "")).filter(Boolean)),
  lives: new Set([...[...projects, ...clientWork].map((p) => p.live), site.url].map(norm).filter(Boolean)),
};

function toProject(e: Record<string, unknown>): AutoProject | null {
  const slug = str(e.slug) && /^[a-z0-9-]+$/.test(e.slug) ? e.slug : null;
  const github = url(e.github);
  if (!slug || !str(e.title) || !github || !str(e.repo)) return null;
  const homepage = url(e.homepage);
  if (taken.slugs.has(slug) || taken.repos.has(github.toLowerCase().replace(/\/+$/, "")) || (homepage && taken.lives.has(norm(homepage)))) return null;

  const m = (e.media ?? {}) as Record<string, unknown>;
  const summary = (e.summary ?? {}) as Record<string, unknown>;
  const language = str(e.language) ? e.language : undefined;
  const topics = strs(e.topics).filter((t) => !/^colou?r-/i.test(t) && t !== "no-portfolio"); // control topics, not tech
  const intro = str(summary.intro) ? summary.intro : "";
  const description = str(e.description) ? e.description.trim() : intro;
  const video = local(m.video, "/videos/auto/");
  const poster = local(m.poster, "/images/projects/auto/");
  const image = local(m.image, "/images/projects/auto/");
  if (!homepage || !video || !poster || !image) return null; // live sites with a capture only
  const tags = Array.from(new Set([language, ...topics].filter(str))).slice(0, 6);
  return {
    auto: true,
    repo: e.repo,
    slug,
    title: e.title,
    kind: language ? `${language} project` : "Open-source project",
    problem: description || `Source on GitHub: ${e.repo}.`,
    solution: "",
    tags,
    image,
    imageAlt: `${e.title} homepage`,
    video,
    poster,
    color: hexColor(e.color), // brand colour from the capture, or a "color-xxxxxx" repo topic
    wireLabels: (tags.length ? tags : ["repo", "GitHub"]).slice(0, 4),
    live: homepage,
    github,
    language,
    topics,
    intro,
    features: strs(summary.features).slice(0, 6),
    gallery: (Array.isArray(m.gallery) ? m.gallery : [])
      .map((g: Record<string, unknown>) => ({ src: local(g?.src, "/images/projects/auto/"), caption: str(g?.caption) ? g.caption : "Screen" }))
      .filter((g): g is { src: string; caption: string } => !!g.src)
      .map((g) => ({ ...g, alt: `${e.title}: ${g.caption.toLowerCase()}` })),
  };
}

function load(): AutoProject[] {
  const list = (data as unknown as { projects?: unknown }).projects;
  if (!Array.isArray(list)) return [];
  const out: AutoProject[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    try {
      const p = toProject(e as Record<string, unknown>);
      if (p && !seen.has(p.slug)) {
        seen.add(p.slug);
        out.push(p);
      }
    } catch {
      // skip malformed entry
    }
    if (out.length >= AUTO_MAX) break;
  }
  return out;
}

export const autoProjects: AutoProject[] = load();
