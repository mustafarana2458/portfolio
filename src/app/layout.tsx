import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { contact, site } from "@/data/content";
import Backdrop from "@/components/ui/Backdrop";
import Cursor from "@/components/ui/Cursor";
import SmoothScroll from "@/components/providers/SmoothScroll";
import SiteReady from "@/components/providers/SiteReady";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CommandPaletteHost from "@/components/pipeline/CommandPaletteHost";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-serif", display: "swap" });
// Mono is for small labels/logs: not preloaded, so it never competes with the hero for bandwidth.
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap", preload: false });

const fullTitle = `${site.name} — ${site.title}`;

// deviceMemory is Chromium-only; where it's missing, cores + Data Saver decide.
const WIRES_CHECK = `(function(){try{var n=navigator,c=n.connection||{},m=n.deviceMemory;if(matchMedia("(max-width: 767px)").matches&&(c.saveData||(n.hardwareConcurrency||0)<6||(m!==undefined&&m<4)))document.documentElement.classList.add("wires-off")}catch(e){}})()`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: fullTitle, template: `%s — ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: contact.github }],
  keywords: [
    "Full-Stack Developer",
    "AI Automation Engineer",
    "Next.js",
    "TypeScript",
    "n8n",
    "LangGraph",
    "SaaS",
    "Lahore",
    "Pakistan",
    site.name,
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: fullTitle,
    description: site.description,
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: fullTitle }],
  },
  twitter: { card: "summary_large_image", title: fullTitle, description: site.description, images: ["/og.png"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0C0C0E",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: site.title,
  url: site.url,
  email: `mailto:${contact.email}`,
  address: { "@type": "PostalAddress", addressLocality: "Lahore", addressCountry: "PK" },
  worksFor: { "@type": "Organization", name: "Aevia", url: "https://aevia.site" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "Lahore Garrison University" },
  sameAs: [contact.github, contact.linkedin],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Adaptive quality, before first paint: phones that aren't capable (fewer than 6 cores,
            under 4GB memory, or Data Saver on) get no background wire fields. */}
        <script dangerouslySetInnerHTML={{ __html: WIRES_CHECK }} />
        <noscript>
          <style>{`.split-word{transform:none!important}.node .node-dot{background:rgb(var(--ok))!important}.node .node-meta>span{display:none!important}.node .node-meta>.meta-success{display:inline!important}`}</style>
        </noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      </head>
      <body id="top">
        <a
          href="#main"
          className="sr-only z-[110] rounded-full bg-fg px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <SiteReady />
        <Backdrop />
        <SmoothScroll />
        <Cursor />
        <Navbar />
        <main id="main" className="relative z-10 overflow-x-clip">
          {children}
        </main>
        <Footer />
        <CommandPaletteHost />
      </body>
    </html>
  );
}
