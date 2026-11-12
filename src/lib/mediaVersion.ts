// Cache busting for project media: `?v=<content hash>` from scripts/media-versions.mjs (run before
// dev/build). Paths not in the map (or not project media) are returned unchanged.
import versions from "@/data/media-versions.json";

const map = versions as Record<string, string>;

export const mediaVersion = (path: string): string | undefined => map[path];

export const versioned = (path: string) => {
  const v = map[path];
  return v ? `${path}?v=${v}` : path;
};
