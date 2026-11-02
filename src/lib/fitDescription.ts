const MIN = 150;
const MAX = 160;

/**
 * Fits generated text (GitHub-synced projects have no hand-written summary) to a 150-160 character
 * meta description: long text is cut at a word boundary, short text gets closing sentences.
 */
export function fitDescription(text: string, author: string): string {
  let out = text.replace(/\s+/g, " ").trim();

  if (out.length > MAX) {
    const cut = out.slice(0, MAX - 1);
    const atWord = cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.!?—–-]+$/, "");
    return (atWord.length >= MIN - 1 ? atWord : cut) + "…"; // a very long last word: cut inside it
  }

  const credits = [` Built by ${author}, a full-stack and AI automation engineer in Lahore, Pakistan.`, ` Built by ${author} in Lahore, Pakistan.`, ` Built by ${author}.`];
  const closers = [" See the features, stack, screens and a recording of it on this page.", " See the live site and source.", " Live site and source.", " Source on GitHub.", " Open source.", " Live site."];
  let pool = [...credits, ...closers];

  while (out.length < MIN) {
    const room = MAX - out.length;
    const next = pool.filter((s) => s.length <= room).sort((a, b) => b.length - a.length)[0];
    if (!next) break;
    out += next;
    pool = pool.filter((s) => s !== next && !(credits.includes(next) && credits.includes(s)));
  }
  return out;
}
