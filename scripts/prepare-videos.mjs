// Turn deterministic frame captures (captures/<slug>/frames/*.jpg, from capture-sites.mjs) into
// hover-preview videos:
//   public/videos/<slug>.mp4           H.264, 30fps, yuv420p, keyframe every 30 frames, faststart
//   public/videos/<slug>.webm          VP9, same frames
//   public/videos/<slug>-m.mp4         phones: 640px wide H.264, ≤500KB (served with <source media>)
//   public/images/posters/<slug>.jpg   first frame (poster + card still, so hover start never jumps)
// `--mobile-only` re-encodes just the phone versions.
// Each video is kept under MAX_BYTES by stepping the CRF up if needed.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC = "captures";
const OUT = "public/videos";
const POSTERS = "public/images/posters";
const MAX_BYTES = 1.5 * 1024 * 1024;
const MOBILE_BYTES = 500 * 1024;
const MOBILE_ONLY = process.argv.includes("--mobile-only");
// Longer highlight reels get a larger budget.
const BUDGET = { "crease-packaging": 2 * 1024 * 1024 };

const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const kb = (f) => Math.round(statSync(f).size / 1024);

function encode(input, output, codecArgs, crfs, max) {
  for (const crf of crfs) {
    ff(["-framerate", "30", "-i", input, ...codecArgs(crf), "-an", output]);
    if (statSync(output).size <= max) return crf;
  }
  return crfs.at(-1);
}

/**
 * Encode one frame folder (0000.jpg, 0001.jpg, …) into the desktop MP4 + WebM, the phone MP4
 * and the poster. Also used by scripts/auto-projects.mjs for GitHub-synced projects.
 */
export async function encodeClip({ frames, mp4, webm, mobile, poster, budget = MAX_BYTES, mobileOnly = false }) {
  const input = join(frames, "%04d.jpg");

  // Phones: 640x400 (same 16:10 frame), H.264 for the widest support.
  const mobileCrf = encode(input, mobile, (crf) => [
    "-vf", "scale=640:400:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
    "-pix_fmt", "yuv420p", "-profile:v", "main", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0", "-movflags", "+faststart",
  ], [26, 28, 30, 32, 34, 36], MOBILE_BYTES);
  if (mobileOnly) return { mobileCrf };

  const mp4Crf = encode(input, mp4, (crf) => [
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p",
    "-g", "30", "-keyint_min", "30", "-sc_threshold", "0", "-movflags", "+faststart",
  ], [26, 28, 30, 32, 34], budget);

  const webmCrf = encode(input, webm, (crf) => [
    "-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-pix_fmt", "yuv420p",
    "-g", "30", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
  ], [36, 40, 44, 48], budget);

  rmSync(poster, { force: true });
  await sharp(join(frames, "0000.jpg")).jpeg({ quality: 82, mozjpeg: true }).toFile(poster);
  return { mobileCrf, mp4Crf, webmCrf };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(POSTERS, { recursive: true });
  for (const slug of readdirSync(SRC)) {
    const frames = join(SRC, slug, "frames");
    if (!existsSync(frames)) continue;
    const count = readdirSync(frames).filter((f) => f.endsWith(".jpg")).length;
    if (!count) continue;
    const out = {
      frames,
      mp4: join(OUT, `${slug}.mp4`),
      webm: join(OUT, `${slug}.webm`),
      mobile: join(OUT, `${slug}-m.mp4`),
      poster: join(POSTERS, `${slug}.jpg`),
    };
    const { mobileCrf, mp4Crf, webmCrf } = await encodeClip({ ...out, budget: BUDGET[slug] ?? MAX_BYTES, mobileOnly: MOBILE_ONLY });
    if (MOBILE_ONLY) {
      console.log(`${slug.padEnd(18)} ${count} frames | mobile ${kb(out.mobile)} KB (crf ${mobileCrf})`);
      continue;
    }
    console.log(
      `${slug.padEnd(18)} ${count} frames → ${(count / 30).toFixed(1)}s @30fps | mp4 ${kb(out.mp4)} KB (crf ${mp4Crf}) | webm ${kb(out.webm)} KB (crf ${webmCrf}) | mobile ${kb(out.mobile)} KB (crf ${mobileCrf}) | poster ${kb(out.poster)} KB`
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
