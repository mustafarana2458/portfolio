import type { Metadata } from "next";
import { contact, hero, site, type Project } from "@/data/content";

const OG_IMAGE = "/og.png";
const PERSON_ID = `${site.url}/#person`;

/** Canonical, Open Graph and Twitter tags for one page. `path` starts and ends with a slash. */
export function pageMetadata({ title, shareTitle = title, description, path, type }: { title?: string; shareTitle?: string; description: string; path: string; type: "website" | "article" }): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: path,
      siteName: site.name,
      title: shareTitle,
      description,
      locale: "en_US",
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: shareTitle }],
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [OG_IMAGE] },
  };
}

export const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": PERSON_ID,
  name: site.name,
  jobTitle: site.title,
  url: `${site.url}/`,
  image: { "@type": "ImageObject", url: `${site.url}/images/portrait.png`, caption: hero.portraitAlt },
  email: `mailto:${contact.email}`,
  address: { "@type": "PostalAddress", addressLocality: "Lahore", addressCountry: "Pakistan" },
  worksFor: { "@type": "Organization", name: "Aevia", url: "https://aevia.site" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "Lahore Garrison University" },
  sameAs: [contact.github, contact.linkedin],
};

/** The page itself is a CreativeWork; `about` is the thing it documents. */
export function caseStudyLd({ project: p, name, description, image, updated }: { project: Project; name: string; description: string; image?: string; updated: string }) {
  const isSite = /website|landing page/i.test(p.kind);
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    headline: name,
    description,
    url: `${site.url}/work/${p.slug}/`,
    image: `${site.url}${image ?? OG_IMAGE}`,
    inLanguage: "en",
    dateModified: updated,
    keywords: p.tags.join(", "),
    author: { "@type": "Person", "@id": PERSON_ID, name: site.name, url: `${site.url}/` },
    about: {
      "@type": isSite ? "WebSite" : "SoftwareApplication",
      name: p.title,
      ...(isSite ? {} : { applicationCategory: p.kind }),
      ...(p.live ? { url: p.live } : {}),
      ...(!isSite && p.live ? { operatingSystem: "Web" } : {}),
      ...(p.github ? { sameAs: p.github } : {}),
    },
  };
}
