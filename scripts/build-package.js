#!/usr/bin/env node

import { chmod, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const DIST_DIR = resolve(ROOT_DIR, "dist");
const EXTERNAL_PACKAGES = [
  "@modelcontextprotocol/sdk",
  "@mozilla/readability",
  "impit",
  "linkedom",
  "node-html-parser",
];

async function resetDist() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
}

async function buildLibrary() {
  await build({
    entryPoints: [resolve(ROOT_DIR, "index.js")],
    outfile: resolve(DIST_DIR, "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    external: EXTERNAL_PACKAGES,
    legalComments: "none",
  });
}

async function copyTypes() {
  await copyFile(
    resolve(ROOT_DIR, "index.d.ts"),
    resolve(DIST_DIR, "index.d.ts")
  );
}

async function writeCliWrapper() {
  const cliPath = resolve(DIST_DIR, "search-mcp.js");
  const source = `#!/usr/bin/env node
import { main } from "./index.js";

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
`;

  await writeFile(cliPath, source, "utf8");
  await chmod(cliPath, 0o755);
}

async function main() {
  await resetDist();
  await Promise.all([buildLibrary(), copyTypes()]);
  await writeCliWrapper();
  console.log("Built package artifacts into dist/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
