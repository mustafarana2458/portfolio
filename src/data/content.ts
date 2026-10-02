// ─────────────────────────────────────────────────────────────
//  All site copy lives here. Edit text, links and projects in this
//  file only — components read from it.
//
//  Rules:
//  • Leave a link as `undefined` and its button is not rendered.
//  • A stat with `value: null` is hidden (the whole row hides if all are null).
//  • An experience item with `period: undefined` shows no date.
//  • A project with `image: undefined` gets a designed placeholder cover.
//  • `video` is an optional hover preview (desktop only). Generate with
//    `npm run capture` then `npm run prepare-videos` → /videos/<slug>.mp4
//    To add a screenshot: put it in /public/images/projects/ and set
//    `image: "/images/projects/<file>.jpg"`.
// ─────────────────────────────────────────────────────────────

export const site = {
  url: "https://mustafarana.netlify.app",
  name: "Ghulam Mustafa Rana",
  initials: "GMR",
  title: "Full-Stack & AI Automation Engineer",
  description:
    "Ghulam Mustafa Rana — Full-Stack & AI Automation Engineer from Lahore. Co-Founder & CTO at Aevia, building Celaris SaaS. Web apps, SaaS, AI agents and n8n automation.",
  location: "Lahore, Pakistan",
  available: true,
};

export const contact = {
  email: "mustafarana2458@gmail.com",
  // Set to undefined to hide. Opens a chat with a pre-filled message; the number is never shown on the site.
  whatsapp: {
    href: "https://wa.me/923020431890?text=Hi%20Mustafa%2C%20I%20saw%20your%20portfolio",
  } as { href: string } | undefined,
  linkedin: "https://linkedin.com/in/mustafa-rana-83a69a25b",
  github: "https://github.com/mustafarana2458",
  cv: undefined as string | undefined, // set to "/cv.pdf" after adding public/cv.pdf
};

export const nav = [
  { id: "about", label: "About" },
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "services", label: "Services" },
  { id: "contact", label: "Contact" },
];

export const hero = {
  // Words wrapped in *asterisks* render in the serif italic accent face.
  headline: "I build software that *runs itself*.",
  subline: "Full-stack & AI automation engineer · Co-Founder & CTO at Aevia",
  portraitAlt: "Portrait of Ghulam Mustafa Rana wearing a black kurta, arms crossed",
};

/** Hero "execution log": real events only. Loops in the hero panel. */
export const executionLog = [
  "celaris.cloud — multi-tenant SaaS deployed",
  "reel-pipeline — LangGraph agents → Remotion render",
  "packagingbox.netlify.app — shipped",
  "thegroovegen.org — shipped",
  "nutribalance-pk.netlify.app — shipped",
  "thebe-adspot-website.netlify.app — shipped",
  "n8n + HubSpot sales automation — Aificient Labs",
  "Linux VPS infrastructure — Aificient Labs",
];

export const about = {
  /** Shown in the Trigger node's Table / JSON output panel. */
  profile: {
    name: "Ghulam Mustafa Rana",
    role: "Full-Stack & AI Automation Engineer",
    location: "Lahore, Pakistan",
    education: "BS Computer Science (final year), Lahore Garrison University",
    focus: ["AI automation", "multi-tenant SaaS", "LLM agents", "n8n workflows"],
    stack: ["TypeScript", "Next.js", "Node.js", "Python", "PostgreSQL", "Supabase", "Docker", "AWS", "LangGraph", "n8n"],
  },
  heading: "Engineer by trade, *builder* by habit.",
  paragraphs: [
    "I'm Mustafa, a full-stack and AI automation engineer based in Lahore. As Co-Founder & CTO of Aevia I lead development of Celaris — a multi-tenant business suite with CRM, deals, projects, invoicing and a built-in AI assistant.",
    "Before that I ran infrastructure and automation at Aificient Labs: AI pipelines, Linux VPS fleets, n8n workflow systems and HubSpot sales automation. I'm finishing my BS in Computer Science at Lahore Garrison University.",
    "I care about the whole stack — clean interfaces, solid data models, and systems that keep running after launch.",
  ],
  facts: [
    { label: "Building", value: "Celaris @ Aevia" },
    { label: "Role", value: "Co-Founder & CTO" },
    { label: "Studying", value: "BS CS, final year" },
    { label: "Based in", value: "Lahore, Pakistan" },
  ],
  // Real numbers only; they appear in the About node's output panel,
  // e.g. { value: 12, suffix: "+", label: "Projects shipped" }. `value: null` hides a stat.
  stats: [] as { value: number | null; suffix: string; label: string }[],
};

export const skills = {
  heading: "Tools I *reach for*.",
  groups: [
    { name: "Frontend", items: ["TypeScript", "JavaScript", "React", "Next.js", "Tailwind CSS", "Flutter (basics)"] },
    { name: "Backend", items: ["Node.js", "PHP", "Python", "PostgreSQL", "Supabase"] },
    { name: "AI & Automation", items: ["LangGraph", "Claude / LLM APIs", "n8n", "Remotion"] },
    { name: "DevOps", items: ["Docker", "AWS", "Linux / VPS", "Caddy"] },
  ],
};

export type Project = {
  slug: string;
  title: string;
  kind: string;
  problem: string;
  solution: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
  /** "contain" shows the whole image on the surface colour (use when it isn't 16:10). */
  imageFit?: "cover" | "contain";
  /** Keep `image` as the card still even when a hover video exists (default: video's first frame). */
  keepImage?: boolean;
  video?: string;
  /** Designed cover when there is no screenshot: "agent-graph" animates the case study's architecture. */
  cover?: "agent-graph";
  /** Brand colour for the background wire field behind this project (hex). */
  color: string;
  /** 2-3 tiny mono labels on that wire field. */
  wireLabels: string[];
  live?: string;
  github?: string;
  private?: boolean;
};

export const projects: Project[] = [
  {
    slug: "celaris",
    color: "#3B82F6",
    wireLabels: ["CRM", "invoice", "RLS", "Supabase", "Docker"],
    title: "Celaris",
    kind: "Multi-tenant SaaS",
    problem: "Growing teams juggle separate tools for clients, deals, projects and billing.",
    solution: "One AI-native workspace: CRM, deals, projects, invoicing and a built-in AI assistant.",
    tags: ["TypeScript", "Next.js", "PostgreSQL", "Supabase", "Docker", "AWS"],
    // Captured from the app (demo workspace, fictional data) by scripts/capture-celaris.mjs.
    image: "/images/projects/celaris-dashboard.png",
    imageAlt: "Celaris dashboard in a demo workspace: contact, deal, project and invoice totals, a deals pipeline chart and a leads vs customers breakdown",
    video: "/videos/celaris.mp4",
    live: "https://celaris.cloud",
    github: "https://github.com/mustafarana2458/celaris",
  },
  {
    slug: "ai-reel-pipeline",
    color: "#FF6B35",
    wireLabels: ["script", "render", "QC", "LangGraph", "Remotion"],
    title: "AI Reel Pipeline",
    kind: "Multi-agent system",
    problem: "Producing short-form vertical video by hand is slow and repetitive.",
    solution: "LangGraph agents script, plan and render vertical reels end-to-end with Remotion.",
    tags: ["LangGraph", "Multi-agent", "LLM APIs", "Remotion"],
    cover: "agent-graph",
    private: true,
  },
  {
    slug: "crease",
    color: "#C8A27A",
    wireLabels: ["scroll", "frames", "GSAP", "Lenis"],
    title: "CREASE Packaging",
    kind: "Cinematic landing page",
    problem: "Premium packaging is tactile — a flat page can't sell how it feels to open.",
    solution: "A scroll-synced story, Flat → Form → Craft → Process → Planet → Proof, driven by scroll.",
    tags: ["JavaScript", "GSAP", "Lenis"],
    image: "/images/projects/crease.png",
    imageAlt: "CREASE homepage: 'Engineered to be opened.' over a flat kraft box blank on a dark backdrop",
    video: "/videos/crease-packaging.mp4",
    live: "https://packagingbox.netlify.app/",
    github: "https://github.com/mustafarana2458/crease-packaging-landing",
  },
  {
    slug: "event-saas",
    color: "#8B5CF6",
    wireLabels: ["booking", "hall", "PHP", "MariaDB"],
    title: "EventSaaS",
    kind: "Full-stack SaaS",
    problem: "Marriage halls and event companies run bookings on paper and spreadsheets.",
    solution: "A multi-tenant platform for venues and event companies, from one hall to multi-branch.",
    tags: ["PHP 8.2", "MariaDB", "JavaScript", "Bootstrap"],
    // Captured from a local run with fictional demo data (scripts/capture-eventsaas.mjs).
    image: "/images/projects/eventsaas-dashboard.png",
    imageAlt: "EventSaaS dashboard with demo data: booking totals, revenue, an October booking calendar and upcoming events",
    video: "/videos/eventsaas.mp4",
    github: "https://github.com/mustafarana2458/event_saas",
  },
  {
    slug: "pixel-mind",
    color: "#22C55E",
    wireLabels: ["kernel", "histogram", "pixel", "Zustand", "Recharts"],
    title: "PixelMind",
    kind: "Browser image studio",
    problem: "Image-processing tools hide the math behind a single slider.",
    solution: "Filters, pipelines and custom convolution kernels with per-pixel inspection — no backend.",
    tags: ["React", "Vite", "Zustand", "Recharts"],
    image: "/images/projects/pixel-mind.jpg",
    imageAlt: "PixelMind studio with a split original/processed view, histogram and color adjustment sliders",
    video: "/videos/pixelmind.mp4",
    live: "https://pixelmind1234.netlify.app/",
    github: "https://github.com/mustafarana2458/Pixel_Mind",
  },
  {
    slug: "arden-form",
    color: "#B07A4F",
    wireLabels: ["WebGL", "3D", "scroll", "Three.js"],
    title: "Arden Form",
    kind: "Cinematic 3D brand website",
    problem: "A furniture brand needs its craft to feel physical on screen.",
    solution: "A cinematic 3D furniture brand site with scroll-driven motion and WebGL scenes.",
    tags: ["Three.js", "GSAP", "Lenis", "JavaScript"],
    image: "/images/projects/arden-form.jpg",
    imageAlt: "Arden Form homepage: 'Furniture that earns its place.' over a sunlit room with a walnut chair",
    video: "/videos/arden-form.mp4",
    live: "https://admirable-toffee-38d2a4.netlify.app/",
    github: "https://github.com/mustafarana2458/3d-cinematic-motion-website",
  },
];

export type ClientProject = {
  title: string;
  client: string;
  summary: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
  imageFit?: "cover" | "contain";
  keepImage?: boolean;
  video?: string;
  live?: string;
  /** Brand colour for the background wire field behind this card (hex). */
  color: string;
  wireLabels: string[];
};

export const clientWork: ClientProject[] = [
  {
    title: "NutriBalance PK",
    color: "#3E9B6E",
    wireLabels: ["booking", "plans"],
    client: "Ayesha Nutrition Care",
    summary: "Marketing and booking site for a 100% online nutrition practice.",
    tags: ["React", "TypeScript", "Framer Motion"],
    image: "/images/projects/nutribalance.png",
    imageAlt: "NutriBalance PK homepage: 'Personalized nutrition, grounded in science' beside a bowl of whole foods",
    video: "/videos/nutribalance-pk.mp4",
    live: "https://nutribalance-pk.netlify.app/",
  },
  {
    title: "The Be Adspot",
    color: "#9B4A86",
    wireLabels: ["order", "WhatsApp"],
    client: "Handmade jewellery brand",
    summary: "Storefront where every order opens WhatsApp pre-filled.",
    tags: ["Next.js", "Tailwind"],
    image: "/images/projects/thebe-adspot.jpg",
    imageAlt: "The Be Adspot homepage: 'Jewellery that carries your story' beside a green bead necklace",
    video: "/videos/the-be-adspot.mp4",
    live: "https://thebe-adspot-website.netlify.app/",
  },
  {
    title: "GROOVEGEN",
    color: "#1F8A4C",
    wireLabels: ["React", "events"],
    client: "Youth leadership platform",
    summary: "Speak. Lead. Rise. — official site on the client's brand system.",
    tags: ["React", "Tailwind", "Framer Motion"],
    image: "/images/projects/groovegen.jpg",
    imageAlt: "GROOVEGEN homepage with 'Speak. Lead. Rise.' headline over a dark world map",
    video: "/videos/groovegen.mp4",
    live: "https://thegroovegen.org",
  },
  {
    title: "C4 Cleaning",
    color: "#C6F000",
    wireLabels: ["quote", "WhatsApp"],
    client: "Premium cleaning, Lahore",
    summary: "Bold, animation-rich static site built to convert to WhatsApp bookings.",
    tags: ["Next.js", "Lenis", "Framer Motion"],
    image: "/images/projects/c4-cleaning.jpg",
    imageAlt: "C4 Cleaning homepage: 'Shining standards, spotless results' over a pressure washer spray",
    video: "/videos/c4-cleaning.mp4",
    live: "https://incandescent-crepe-27af96.netlify.app/",
  },
];

export const experience = [
  {
    role: "Co-Founder & CTO",
    org: "Aevia",
    status: "running" as "running" | "completed",
    href: "https://aevia.site",
    period: undefined as string | undefined, // e.g. "2025 — Present"
    points: [
      "Lead product and engineering for Celaris, a multi-tenant business management SaaS.",
      "Own architecture, infrastructure and delivery — Docker, AWS, PostgreSQL, TypeScript.",
    ],
  },
  {
    role: "Infrastructure & Automation Engineer",
    org: "Aificient Labs",
    status: "completed" as "running" | "completed",
    period: undefined as string | undefined,
    points: [
      "Built AI automation pipelines and n8n workflow systems.",
      "Ran Linux VPS infrastructure and HubSpot sales automation.",
    ],
  },
  {
    role: "Machine Learning Intern",
    org: "Elevvo Pathways",
    status: "completed" as "running" | "completed",
    period: undefined as string | undefined,
    points: ["Worked on machine learning tasks and model experiments."],
  },
  {
    role: "BS Computer Science",
    org: "Lahore Garrison University",
    status: "running" as "running" | "completed",
    period: "2022 — 2026" as string | undefined,
    points: ["Final year."],
  },
];

/** Background wire fields behind the non-project sections: site accent + a few labels each. */
export const sectionWires: Record<string, { color: string; labels: string[] }> = {
  about: { color: "#FF6B35", labels: ["trigger", "profile", "JSON", "output"] },
  skills: { color: "#FF6B35", labels: ["node", "palette", "n8n", "TypeScript", "Docker"] },
  clients: { color: "#FF6B35", labels: ["batch", "items", "Next.js", "WhatsApp"] },
  experience: { color: "#FF6B35", labels: ["run", "history", "Aevia", "CTO", "n8n"] },
  services: { color: "#FF6B35", labels: ["template", "workflow", "SaaS", "agents", "n8n"] },
  contact: { color: "#FF6B35", labels: ["input", "send", "email", "WhatsApp"] },
};

export const services = {
  heading: "How I can *help*.",
  items: [
    {
      id: "saas",
      title: "Web apps & SaaS",
      body: "From idea to paying users: auth, billing, dashboards and multi-tenant data, deployed and monitored.",
    },
    {
      id: "website",
      title: "Business websites",
      body: "Fast, cinematic sites that make your brand feel premium and turn visitors into enquiries.",
    },
    {
      id: "automation",
      title: "AI automation & n8n",
      body: "Stop doing it by hand. Workflows that connect your CRM, inbox and tools and run on their own.",
    },
    {
      id: "agents",
      title: "AI agents",
      body: "LLM agents that research, write, qualify leads or produce content — built to be reliable, not demos.",
    },
  ],
};

export const contactSection = {
  eyebrow: "Contact",
  heading: "Let's build something *worth shipping*.",
  body: "Hiring for a full-stack or AI role, or have a project in mind? Send me a message.",
};

// ─────────────────────────────────────────────────────────────
//  Case studies: /work/<slug>. Only confirmed facts are filled in.
//  Any string starting with "TODO" renders with a visible TODO badge.
//  Replace it with the real detail, or delete the line.
// ─────────────────────────────────────────────────────────────

export type ArchNode = {
  id: string;
  label: string;
  kind: "trigger" | "app" | "ai" | "data" | "infra" | "output";
  note?: string;
};

export type CaseStudy = {
  slug: string;
  problem: string;
  role: string;
  architecture: { nodes: ArchNode[]; edges: [string, string][] };
  decisions: string[];
  challenges: string[];
  result: string;
  /** Extra screenshots shown under the hero media (1280×800). */
  gallery?: { src: string; alt: string; caption: string }[];
  /** Shown under the gallery, e.g. where the screens come from. */
  galleryNote?: string;
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "celaris",
    problem:
      "Growing teams run clients, deals, projects and invoicing across separate tools, so data is duplicated and nothing is connected.",
    role: "Co-Founder & CTO at Aevia. Co-built Celaris with Rana Muhammad Bilal.",
    architecture: {
      nodes: [
        { id: "user", label: "Team workspace", kind: "trigger", note: "one tenant per workspace" },
        { id: "app", label: "Next.js 14 app", kind: "app", note: "TypeScript · CRM, deals, projects, tasks, invoices" },
        { id: "db", label: "Supabase / PostgreSQL", kind: "data", note: "Row-Level Security per workspace" },
        { id: "ai", label: "AI client", kind: "ai", note: "Groq Llama 3.3 70B, Mistral fallback" },
        { id: "ci", label: "GitHub Actions", kind: "infra", note: "auto-deploy on push" },
        { id: "infra", label: "Docker + Caddy", kind: "infra", note: "self-hosted, automatic HTTPS" },
        { id: "out", label: "celaris.cloud", kind: "output", note: "live" },
      ],
      edges: [
        ["user", "app"],
        ["ci", "app"],
        ["app", "db"],
        ["app", "ai"],
        ["app", "infra"],
        ["infra", "out"],
      ],
    },
    decisions: [
      "Multi-tenant from day one, because it is a SaaS for many businesses. Each workspace is a tenant: every table carries workspace_id, and Postgres Row-Level Security (is_workspace_member) enforces isolation in the database.",
      "The current workspace is always resolved server-side, never trusted from the client. Owner, admin and member roles are enforced by security-definer RPCs.",
      "Supabase / PostgreSQL: the data is relational (contacts, companies, deals, projects, invoices), RLS isolates tenants at the database level, and auth is built in. Self-hosted in Docker.",
      "One central AI client: Groq (Llama 3.3 70B) first, with automatic fallback to Mistral on rate limits, timeouts or errors, plus retry and backoff. It started on self-hosted Ollama and moved off it because CPU inference was too slow.",
      "The AI assistant uses function calling over a fixed tool catalog. Every tool runs through the same workspace-scoped server actions, so it can only read the current workspace's data. Writes (create a contact, task or deal) show a Confirm / Cancel card and run only after the user confirms.",
    ],
    challenges: [
      "Keeping AI fast and reliable under rate limits: retries with backoff and the Groq → Mistral fallback.",
      "A silent bug: new deals saved, but the list showed \"No deals yet\" because a PostgREST join failed and its error was swallowed. Fixed with explicit foreign-key-hinted joins and error checks everywhere.",
    ],
    result:
      "Live at celaris.cloud: CRM (people, companies, segments), deal pipelines with forecasts, projects with templates, milestones and a Gantt view, a task board with a workload planner, invoices with line items, PDF export and a public QR link, team roles, and AI features (assistant, follow-ups, task breakdown, deal summaries).",
    galleryNote: "Demo workspace with fictional data.",
    gallery: [
      {
        src: "/images/projects/celaris-deals.png",
        alt: "Celaris deals pipeline as a kanban board with stage totals, pipeline forecast, weighted forecast and win rate",
        caption: "Deals pipeline",
      },
      {
        src: "/images/projects/celaris-project.png",
        alt: "Celaris project page for a demo website rebuild: overall progress, milestones and linked tasks with priority and status",
        caption: "Project with tasks",
      },
      {
        src: "/images/projects/celaris-tasks.png",
        alt: "Celaris task board with To Do, In Progress, In Review and Done columns of demo tasks",
        caption: "Task board",
      },
      {
        src: "/images/projects/celaris-contacts.png",
        alt: "Celaris people list of fictional contacts with email, phone, type and AI follow-up actions",
        caption: "CRM contacts",
      },
      {
        src: "/images/projects/celaris-invoices.png",
        alt: "Celaris invoices list with paid and unpaid totals and per-invoice status",
        caption: "Invoices",
      },
    ],
  },
  {
    slug: "ai-reel-pipeline",
    problem: "Producing short-form vertical video by hand is slow and repetitive.",
    role: "Designed and built at Aevia.",
    architecture: {
      nodes: [
        { id: "in", label: "Topic", kind: "trigger", note: "one topic in, finished reel out" },
        { id: "sup", label: "Supervisor", kind: "ai", note: "LangGraph · routes the workers" },
        { id: "script", label: "Script + Hook", kind: "ai", note: "beat-by-beat script, scroll-stopping first beat" },
        { id: "visual", label: "Visual prompt + Asset", kind: "ai", note: "generates the images" },
        { id: "edit", label: "Editing agents", kind: "ai", note: "parallel: camera, transitions, pacing, grade, text, voiceover, music, SFX, beat sync" },
        { id: "qc", label: "QC", kind: "ai", note: "validates everything; render runs only if it passes" },
        { id: "render", label: "Remotion render", kind: "app", note: "video defined in React" },
        { id: "out", label: "Vertical reel", kind: "output", note: "1080×1920 MP4 · 30 fps · voiceover + animated captions" },
      ],
      edges: [
        ["in", "sup"],
        ["sup", "script"],
        ["script", "visual"],
        ["visual", "edit"],
        ["edit", "qc"],
        ["qc", "render"],
        ["render", "out"],
      ],
    },
    decisions: [
      "LangGraph: an explicit graph with a supervisor, parallel branches, merge steps and a conditional QC → render edge. State is shared and inspectable.",
      "Remotion: the video is defined in React code, so motion, transitions and captions are fully programmatic and repeatable, with no manual editing.",
    ],
    challenges: [
      "Timing: fixed short beats clashed with the real voiceover length, so captions were unreadable. Beat duration is now driven by the voiceover length.",
      "Parallel agents overloaded the LLM endpoint, so calls now retry with backoff.",
    ],
    result: "The full pipeline runs end-to-end on a server and renders a finished reel from a single topic. Private repo, case study only.",
  },
  {
    slug: "crease",
    problem: "Premium packaging is tactile, and a flat page can't sell how it feels to open.",
    role: "Designed and built solo as a take-home task for a job interview. CREASE is a fictional packaging brand.",
    architecture: {
      nodes: [
        { id: "brief", label: "Brand brief", kind: "trigger", note: "fictional premium packaging maker" },
        { id: "assets", label: "Generated assets", kind: "ai", note: "images & video made with Google Flow" },
        { id: "story", label: "Scroll story", kind: "app", note: "Flat → Form → Craft → Process → Planet → Proof → You" },
        { id: "lenis", label: "Lenis", kind: "infra", note: "smooth scrolling" },
        { id: "gsap", label: "GSAP ScrollTrigger", kind: "app", note: "scroll-synced scenes" },
        { id: "out", label: "packagingbox.netlify.app", kind: "output", note: "live on Netlify" },
      ],
      edges: [
        ["brief", "story"],
        ["assets", "story"],
        ["story", "gsap"],
        ["lenis", "gsap"],
        ["gsap", "out"],
      ],
    },
    decisions: ["TODO: how scenes are synced to scroll", "TODO: how you kept it fast with heavy media"],
    challenges: ["TODO"],
    result: "Live at packagingbox.netlify.app.",
  },
  {
    slug: "event-saas",
    problem: "Marriage halls, banquets and event companies run bookings on paper and spreadsheets.",
    role: "TODO: your role",
    architecture: {
      nodes: [
        { id: "tenant", label: "Venue / event company", kind: "trigger", note: "single venue → multi-branch" },
        { id: "ui", label: "Bootstrap + JS UI", kind: "app" },
        { id: "app", label: "PHP 8.2 app", kind: "app", note: "full-stack, multi-tenant" },
        { id: "db", label: "MariaDB", kind: "data" },
        { id: "out", label: "TODO: modules (bookings, halls, billing?)", kind: "output" },
      ],
      edges: [
        ["tenant", "ui"],
        ["ui", "app"],
        ["app", "db"],
        ["app", "out"],
      ],
    },
    decisions: ["TODO: how tenants and branches are modelled"],
    challenges: ["TODO"],
    result: "TODO: status (in use? demo?) and any real outcome.",
    galleryNote: "Screens from a local run with fictional demo data.",
    gallery: [
      {
        src: "/images/projects/eventsaas-calendar.png",
        alt: "EventSaaS booking calendar for October with colour-coded bookings per day and status totals",
        caption: "Booking calendar",
      },
      {
        src: "/images/projects/eventsaas-bookings.png",
        alt: "EventSaaS bookings list with event, date, hall, client, payment and status columns",
        caption: "Bookings",
      },
      {
        src: "/images/projects/eventsaas-booking.png",
        alt: "EventSaaS booking detail: event details, client and a payment summary with the share already paid",
        caption: "Booking detail",
      },
      {
        src: "/images/projects/eventsaas-halls.png",
        alt: "EventSaaS halls page with two halls, their capacity, price per event, amenities and upcoming bookings",
        caption: "Halls & venues",
      },
    ],
  },
];
