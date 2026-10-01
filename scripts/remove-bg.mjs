// Runs in its own process: @imgly/background-removal-node bundles an older `sharp`,
// and loading two libvips builds in one process crashes. Usage: node remove-bg.mjs in.png out.png
import { readFileSync, writeFileSync } from "node:fs";
import { removeBackground } from "@imgly/background-removal-node";

const [input, output] = process.argv.slice(2);
const blob = await removeBackground(new Blob([readFileSync(input)], { type: "image/png" }), {
  model: "medium",
  output: { format: "image/png", quality: 1 },
});
writeFileSync(output, Buffer.from(await blob.arrayBuffer()));
