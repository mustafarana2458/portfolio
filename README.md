# Ghulam Mustafa Rana — Portfolio · "The Pipeline"

The whole site is a running automation workflow: every section is a **node**, one **pipeline** connects
them, and a **packet** of data flows down it as you scroll. Nodes "execute" (idle → running → success)
as the packet reaches them.

Next.js 14 (App Router, static export) · TypeScript · Tailwind · GSAP + ScrollTrigger · Lenis · Canvas 2D.

## Commands

```bash
npm install
npm run dev              # http://localhost:3000
npm run build            # static site in ./out (+ responsive WebP images)
npm start                # serve ./out locally
npm run prepare-images   # re-crop/compress raw files from ./images, cut out the portrait
                         # background (@imgly, runs in its own process), regenerate og.png
npm run capture          # every live URL in content.ts → ./captures/<slug>: stills + a deterministic
                         # frame-by-frame scroll-through at 1280x800 (no real-time recording, so a slow
                         # machine cannot drop frames). Sites with a REELS entry (CREASE) get a chapter
                         # highlight reel instead, chapters joined by a 3-frame dip to black (never a
                         # crossfade). Single-screen apps (PixelMind) get a scripted `interact` demo;
                         # per-site `css` hides overlays (Arden's watermarked hero photo is enlarged
                         # out of frame). `npm run capture crease` captures one site.
npm run prepare-videos   # frames → public/videos/<slug>.mp4 + .webm (30fps, -g 30, faststart, ≤1.5MB;
                         # 2MB for reels) and public/images/posters/<slug>.jpg (first frame)
```

### EventSaaS capture (local PHP app, fictional demo data)

EventSaaS has no public deployment, so `scripts/capture-eventsaas.mjs` captures a local run. The clone lives
outside this repo at `C:\projects\event_saas`, and its local-only files are in `.local/`, which is excluded
through `.git/info/exclude`, so nothing is ever committed there:

- `.local/.env`: DB name (`event_saas_demo`) and `APP_URL` (`http://localhost:8080`)
- `.local/router.php`: `php -S` router that applies `.env` before the app's `includes/config.php`
- `.local/seed_demo.sql`: fictional "Demo Banquet Hall" data, 15 bookings dated relative to the current month

```bash
C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone   # MariaDB
mysql -uroot event_saas_demo < .local/seed_demo.sql      # optional: re-date bookings to this month
cd C:\projects\event_saas && C:\xampp\php\php.exe -S localhost:8080 -t . .local/router.php
node scripts/capture-eventsaas.mjs && npm run prepare-videos   # (in this repo)
```

Demo login: `admin@demo-banquet.test` / `DemoPass2026!` (local only).

## Deploying (Netlify)

Deploy `./out`. The contact form uses **Netlify Forms**:
`public/__forms.html` is a hidden static copy of the form that Netlify detects at deploy time, and the
React form POSTs to `/__forms.html`. Field names in both files must match. Submissions appear under
*Site → Forms* in Netlify; turn on email notifications there. On any other host (or locally) the POST
fails and the form offers a prefilled `mailto:` link instead, so no message is lost.

## Editing content

All text, links, projects, skills and services live in **`src/data/content.ts`**.

- A link left as `undefined` hides its button.
- `about.stats`: fill in real numbers and they appear in the About node's output panel; `null` hides them.
- An experience item with `period: undefined` shows `—`; `status` is `"running"` or `"completed"`.
- A project without `image` gets a designed placeholder cover. `video` is the optional hover preview;
  when set, the card still is the video's first frame (16:10, so nothing crops or jumps). Set
  `keepImage: true` (and `imageFit: "contain"` for non-16:10 images) to keep a hand-made screenshot.
- `executionLog` is the hero's typed log. Keep it to real events.

### Case studies (`/work/<slug>`)

`caseStudies` in `content.ts` drives the four case-study pages. **Every string starting with `TODO`
renders with a visible TODO badge** (and dashed outline in the architecture diagram). Replace them with
real details or delete the line. The architecture diagram is built from `architecture.nodes` and
`architecture.edges`: add or rename nodes there and the graph re-lays itself out.

### Before going live

- Set `site.url` to your real domain (metadata, sitemap, OG, canonical URLs).
- Add `public/cv.pdf` and set `contact.cv: "/cv.pdf"`. The CV button and ⌘K command then appear.
- Fill the case-study TODOs.

## Structure

```
src/app/                  layout (fonts, metadata, JSON-LD), page, template (route transition),
                          work/[slug] (case studies), globals.css (tokens + node styles), sitemap, robots
src/data/content.ts       all copy and data
src/lib/
  gsap.ts                 plugin registration, useDeferredGSAP
  pipeline.ts             executeNode(): idle → running → success on any <Node>
  palette.ts              ⌘K commands + fuzzy match
  transition.ts           route curtain
  contactIntent.ts        "Use template" → preselect service in the form
src/components/
  pipeline/               Node, GlobalPipeline, HeroCanvas/HeroNetworkSvg, ExecutionLog, TriggerOutput,
                          SkillPalette, BatchRunner, HistoryTable, ArchitectureDiagram, ContactForm,
                          CommandPalette(+Host), TransitionLink, RevealOnExecute, AutoExecute, …
  sections/               Hero, About, Skills, Projects, ClientWork, Experience, Services, Contact
  layout/                 Navbar, Footer, FooterToast
  ui/                     SplitReveal, RevealImage, HoverVideo, CopyEmail, Cursor, MagneticButton, …
```

## Design rules

- Colors live once in `src/app/globals.css` as CSS variables (Tailwind tokens `bg`, `surface`, `fg`,
  `muted`, `accent`, `ok`, `line`). **Orange (`accent`) is only for data flow**: packets, active edges,
  running status, CTAs, focus. Green (`ok`) is only for success status.
- Headings: Space Grotesk + *Instrument Serif italic* for accent words (`*word*` in content).
  Labels, logs and data: JetBrains Mono.

## Performance / accessibility notes

- No preloader: the hero is server-rendered and paints immediately. The canvas starts in idle time,
  caps DPR at 2, and pauses offscreen or in hidden tabs. Reduced motion gets a static SVG.
- One scroll listener drives the whole pipeline (path sampled analytically, binary-searched per frame);
  other below-the-fold animation setup is deferred to idle time (`useDeferredGSAP`).
- The pipeline stroke uses `stroke-dashoffset` (paint on one SVG path); everything else animates
  transform/opacity only.
- Command palette: modal dialog with a combobox and listbox, focus trapped in the input, Esc restores
  focus. Timeline rows are disclosure buttons. All motion respects `prefers-reduced-motion`.
