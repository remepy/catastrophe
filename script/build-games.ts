/**
 * Builds one static site per language for S3/CloudFront:
 *
 *   dist/games/<GAME_ID>/<lang>/index.html
 *   dist/games/<GAME_ID>/<lang>/translations.json   (serve no-cache)
 *   dist/games/<GAME_ID>/<lang>/words.json          (serve no-cache)
 *   dist/games/<GAME_ID>/<lang>/assets/…            (content-hashed, immutable)
 *
 * Usage: npm run build            (every folder in client/locales)
 *        npm run build -- he      (selected languages)
 *
 * Before building it checks that the level catalogue still resolves in every words.json, and
 * scans source and output for blinding (BR-10) and retired-name (BR-16) vocabulary.
 */
import { build } from "vite";
import { readdir, readFile, rm } from "fs/promises";
import path from "path";
import { GAME_ID } from "../client/src/game-config";

const root = path.resolve(import.meta.dirname, "..");
const localesDir = path.join(root, "client", "locales");
const outRoot = path.join(root, "dist", GAME_ID);

// BR-10: arm-identifying vocabulary must not appear in any shipped file name or text.
// BR-16: names this game was deliberately renamed away from must not appear either.
const BLINDING_TERMS = [
  /placebo/i, /sham/i, /control/i, /mock/i, /demo/i, /dummy/i, /פלסבו/, /פלצבו/, /טיפול דמה/,
  /hang-?man/i, /איש תלוי/, /איש התלוי/,
];
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json"]);
/**
 * Whole words that bundled third-party code (React DOM) cannot avoid and that carry no arm meaning:
 * the HTML media attribute "controls", the keyboard key name "Control", and React's "controlled" inputs.
 * Only applied to .js bundles; our own source and content are checked without exceptions.
 */
const PLATFORM_WORDS_IN_JS = new Set(["controls", "Control", "controlled"]);
/** First-party source and content, scanned strictly. Vendored UI primitives live in components/ui. */
const SOURCE_DIRS = [path.join(root, "client", "src"), path.join(root, "client", "locales"), path.join(root, "script")];
const SOURCE_FILES = ["client/index.html", "README.md", "package.json", "vite.config.ts", "tailwind.config.ts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".json", ".html", ".md", ".mjs"]);
/** This file lists the terms themselves. */
const SELF = path.relative(root, import.meta.filename);

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

function wordAt(text: string, index: number, length: number): string {
  let start = index;
  let end = index + length;
  while (start > 0 && /[A-Za-z]/.test(text[start - 1])) start--;
  while (end < text.length && /[A-Za-z]/.test(text[end])) end++;
  return text.slice(start, end);
}

async function checkSource(): Promise<string[]> {
  const problems: string[] = [];
  const files = SOURCE_FILES.map((f) => path.join(root, f));
  for (const dir of SOURCE_DIRS) files.push(...(await listFiles(dir)));
  for (const file of files) {
    const rel = path.relative(root, file);
    if (rel.includes(`components${path.sep}ui${path.sep}`)) continue;
    if (BLINDING_TERMS.some((term) => term.test(path.basename(file)))) problems.push(`${rel}: file name`);
    if (rel === SELF) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
    // The HTTP header name "Cache-Control" in the dev/QA servers is the only allowed exception.
    const text = (await readFile(file, "utf-8")).replaceAll("Cache-Control", "");
    for (const term of BLINDING_TERMS) {
      if (term.test(text)) problems.push(`${rel}: contains ${term}`);
    }
  }
  return problems;
}

async function checkBlinding(dir: string): Promise<string[]> {
  const problems: string[] = [];
  for (const file of await listFiles(dir)) {
    const rel = path.relative(dir, file);
    for (const term of BLINDING_TERMS) {
      if (term.test(rel)) problems.push(`${rel}: file name matches ${term}`);
    }
    if (!TEXT_EXTENSIONS.has(path.extname(file))) continue;
    const text = await readFile(file, "utf-8");
    for (const term of BLINDING_TERMS) {
      const global = new RegExp(term.source, term.flags + "g");
      for (const match of text.matchAll(global)) {
        if (file.endsWith(".js") && PLATFORM_WORDS_IN_JS.has(wordAt(text, match.index!, match[0].length))) continue;
        const start = Math.max(0, match.index! - 30);
        problems.push(`${rel}: …${text.slice(start, match.index! + match[0].length + 30).replace(/\s+/g, " ")}…`);
      }
    }
  }
  return problems;
}

async function main() {
  const requested = process.argv.slice(2);
  const available = (await readdir(localesDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const langs = requested.length > 0 ? requested : available;
  const unknown = langs.filter((l) => !available.includes(l));
  if (unknown.length > 0) throw new Error(`No locale folder for: ${unknown.join(", ")}`);

  // The catalogue must resolve in every language (index-aligned word lists).
  const catalogue: [string, number][] = JSON.parse(await readFile(path.join(root, "client", "src", "content", "levels.json"), "utf-8"));
  for (const lang of langs) {
    const words = JSON.parse(await readFile(path.join(localesDir, lang, "words.json"), "utf-8"));
    const broken = catalogue.filter(([c, i]) => !words.categories[c] || i >= words.categories[c].length);
    if (broken.length > 0) throw new Error(`${lang}/words.json cannot resolve ${broken.length} catalogue levels (e.g. ${broken[0].join(" #")}); run npm run levels`);
  }

  let failed = false;
  const sourceProblems = await checkSource();
  if (sourceProblems.length > 0) {
    console.error("Blinding check failed for source files:");
    sourceProblems.forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }

  await rm(outRoot, { recursive: true, force: true });

  for (const lang of langs) {
    const outDir = path.join(outRoot, lang);
    console.log(`\nbuilding ${GAME_ID}/${lang}...`);
    // vite.config.ts reads GAME_LANG to pick the locale folder.
    process.env.GAME_LANG = lang;
    await build({
      configFile: path.join(root, "vite.config.ts"),
      mode: "production",
      build: { outDir, emptyOutDir: true },
    });

    const problems = await checkBlinding(outDir);
    if (problems.length > 0) {
      failed = true;
      console.error(`\nBlinding check failed for ${lang}:`);
      problems.forEach((p) => console.error(`  ${p}`));
    }
  }

  if (failed) process.exit(1);
  console.log(`\nDone: ${langs.map((l) => path.relative(root, path.join(outRoot, l))).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
