import type { MetadataRoute } from "next";
import { caseStudies, site } from "@/data/content";
import { autoProjects } from "@/lib/autoProjects";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [...caseStudies, ...autoProjects];
  // The home page lists every project, so it changes when any of them does.
  const latest = [site.updated, ...pages.map((c) => c.updated)].sort().pop();
  return [
    { url: `${site.url}/`, lastModified: latest, changeFrequency: "monthly", priority: 1 },
    ...pages.map((c) => ({
      url: `${site.url}/work/${c.slug}/`,
      lastModified: c.updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
