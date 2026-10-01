// Turn deterministic frame captures (captures/<slug>/frames/*.jpg, from capture-sites.mjs) into
// hover-preview videos:
//   public/videos/<slug>.mp4           H.264, 30fps, yuv420p, keyframe every 30 frames, faststart
//   public/videos/<slug>.webm          VP9, same frames
//   public/images/posters/<slug>.jpg   first frame (poster + card still, so hover start never jumps)
// Each video is kept under MAX_BYTES by stepping the CRF up if needed.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SRC = "captures";
const OUT = "public/videos";
const POSTERS = "public/images/posters";
const MAX_BYTES = 1.5 * 1024 * 1024;
// Longer highlight reels get a larger budget.
const BUDGET = { "crease-packaging": 2 * 1024 * 1024 };
mkdirSync(OUT, { recursive: true });
mkdirSync(POSTERS, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const kb = (f) => Math.round(statSync(f).size / 1024);

function encode(input, output, codecArgs, crfs, max) {
  for (const crf of crfs) {
    ff(["-framerate", "30", "-i", input, ...codecArgs(crf), "-an", output]);
    if (statSync(output).size <= max) return crf;
  }
  return crfs.at(-1);
}

for (const slug of readdirSync(SRC)) {
  const frames = join(SRC, slug, "frames");
  if (!existsSync(frames)) continue;
  const count = readdirSync(frames).filter((f) => f.endsWith(".jpg")).length;
  if (!count) continue;
  const input = join(frames, "%04d.jpg");

  const mp4 = join(OUT, `${slug}.mp4`);
  const mp4Crf = encode(input, mp4, (crf) => [
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p",
    "-g", "30", "-keyint_min", "30", "-sc_threshold", "0", "-movflags", "+faststart",
  ], [26, 28, 30, 32, 34], BUDGET[slug] ?? MAX_BYTES);

  const webm = join(OUT, `${slug}.webm`);
  const webmCrf = encode(input, webm, (crf) => [
    "-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-pix_fmt", "yuv420p",
    "-g", "30", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
  ], [36, 40, 44, 48], BUDGET[slug] ?? MAX_BYTES);

  const poster = join(POSTERS, `${slug}.jpg`);
  rmSync(poster, { force: true });
  await sharp(join(frames, "0000.jpg")).jpeg({ quality: 82, mozjpeg: true }).toFile(poster);

  console.log(
    `${slug.padEnd(18)} ${count} frames → ${(count / 30).toFixed(1)}s @30fps | mp4 ${kb(mp4)} KB (crf ${mp4Crf}) | webm ${kb(webm)} KB (crf ${webmCrf}) | poster ${kb(poster)} KB`
  );
}
