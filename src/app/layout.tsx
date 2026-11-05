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

// deviceMemory is Chromium-only; where it's missing, cores + Data Saver decide.
const LITE_CHECK = `(function(){try{var n=navigator,c=n.connection||{},m=n.deviceMemory;if(matchMedia("(max-width: 767px)").matches&&(c.saveData||(n.hardwareConcurrency||0)<6||(m!==undefined&&m<4)))document.documentElement.classList.add("lite")}catch(e){}})()`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.seoTitle, template: `%s | ${site.name}` },
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
  robots: { index: true, follow: true },
  openGraph: { siteName: site.siteName },
};

export const viewport: Viewport = {
  themeColor: "#0C0C0E",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Adaptive quality, before first paint: phones that aren't capable (fewer than 6 cores,
            under 4GB memory, or Data Saver on) get html.lite: no background wire fields and
            static looping animations. Capable phones animate like desktop. */}
        <script dangerouslySetInnerHTML={{ __html: LITE_CHECK }} />
        <noscript>
          <style>{`.split-word{transform:none!important}.node .node-dot{background:rgb(var(--ok))!important}.node .node-meta>span{display:none!important}.node .node-meta>.meta-success{display:inline!important}`}</style>
        </noscript>
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
