// Content hashes for project media, so URLs change whenever a file is replaced under the same name.
//
// /videos and /images are cached for 30 days (vercel.json), so a re-captured clip or poster saved
// over the old file would keep showing the old version to returning visitors. src/lib/mediaVersion.ts
// appends `?v=<hash>` to these paths (and to their optimized WEBPs, which are regenerated from the
// same source). Runs automatically before `dev` and `build`; the output is generated, not committed.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const PUBLIC = "public";
const ROOTS = ["videos", "images/posters", "images/projects"];
const OUT = "src/data/media-versions.json";
const SKIP = "nextImageExportOptimizer"; // generated WEBPs; versioned through their source file

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === SKIP) return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const versions = {};
for (const root of ROOTS) {
  for (const file of walk(join(PUBLIC, root)).sort()) {
    const url = "/" + relative(PUBLIC, file).split(sep).join("/");
    versions[url] = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 10);
  }
}

writeFileSync(OUT, JSON.stringify(versions, null, 1) + "\n");
console.log(`media-versions: ${Object.keys(versions).length} files -> ${OUT}`);
