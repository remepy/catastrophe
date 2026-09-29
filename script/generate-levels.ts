/**
 * Builds or extends client/src/content/levels.json, the fixed level catalogue.
 *
 *   npm run levels
 *
 * - Checks that every language's words.json has the same categories with the same word counts
 *   (the lists are index-aligned translations of each other).
 * - Keeps every existing catalogue entry in place. Words that are not in the catalogue yet are
 *   appended, spread so that categories are evenly mixed and never repeat back to back.
 * - Deterministic: the same inputs always produce the same file.
 */
import { readdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

type Entry = [string, number];

const root = path.resolve(import.meta.dirname, "..");
const localesDir = path.join(root, "client", "locales");
const outFile = path.join(root, "client", "src", "content", "levels.json");
const SEED = 0x5eed_ca75;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadCounts(): Promise<Record<string, number>> {
  const langs = (await readdir(localesDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  let reference: Record<string, number> | null = null;
  let referenceLang = "";
  for (const lang of langs) {
    const words = JSON.parse(await readFile(path.join(localesDir, lang, "words.json"), "utf-8"));
    const counts = Object.fromEntries(Object.entries(words.categories as Record<string, string[]>).map(([c, w]) => [c, w.length]));
    if (!reference) {
      reference = counts;
      referenceLang = lang;
      continue;
    }
    const keys = new Set([...Object.keys(reference), ...Object.keys(counts)]);
    const diffs = [...keys].filter((c) => reference![c] !== counts[c]);
    if (diffs.length > 0) {
      throw new Error(`${lang}/words.json and ${referenceLang}/words.json differ in: ${diffs.map((c) => `${c} (${counts[c] ?? 0} vs ${reference![c] ?? 0})`).join(", ")}`);
    }
  }
  if (!reference) throw new Error("no locales found");
  return reference;
}

/** Spreads entries so every category is evenly distributed, then removes back-to-back repeats. */
function spread(entries: Entry[], random: () => number, previous?: string): Entry[] {
  const byCategory = new Map<string, Entry[]>();
  for (const e of entries) byCategory.set(e[0], [...(byCategory.get(e[0]) ?? []), e]);

  const keyed: { key: number; entry: Entry }[] = [];
  for (const list of byCategory.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    list.forEach((entry, k) => keyed.push({ key: (k + 0.1 + 0.8 * random()) / list.length, entry }));
  }
  const ordered = keyed.sort((a, b) => a.key - b.key).map((k) => k.entry);

  for (let i = 0; i < ordered.length; i++) {
    const before = i === 0 ? previous : ordered[i - 1][0];
    if (ordered[i][0] !== before) continue;
    const j = ordered.findIndex((e, k) => k > i && e[0] !== before && (k + 1 >= ordered.length || ordered[k + 1][0] !== ordered[i][0]) && ordered[k - 1][0] !== ordered[i][0]);
    if (j === -1) continue;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}

async function main() {
  const counts = await loadCounts();
  const existing: Entry[] = existsSync(outFile) ? JSON.parse(await readFile(outFile, "utf-8")) : [];

  for (const [i, [category, index]] of existing.entries()) {
    if (counts[category] === undefined || index >= counts[category]) {
      throw new Error(`catalogue entry ${i + 1} (${category} #${index}) no longer exists in words.json; words may only be appended`);
    }
  }

  const taken = new Set(existing.map(([c, i]) => `${c}#${i}`));
  const fresh: Entry[] = Object.entries(counts).flatMap(([c, n]) =>
    Array.from({ length: n }, (_, i): Entry => [c, i]).filter(([cc, i]) => !taken.has(`${cc}#${i}`)),
  );

  const catalogue = [...existing, ...spread(fresh, mulberry32(SEED + existing.length), existing.at(-1)?.[0])];
  const repeats = catalogue.filter((e, i) => i > 0 && e[0] === catalogue[i - 1][0]).length;

  await writeFile(outFile, "[\n" + catalogue.map((e) => "  " + JSON.stringify(e)).join(",\n") + "\n]\n");
  console.log(`levels.json: ${catalogue.length} levels (${existing.length} kept, ${fresh.length} added, ${repeats} back-to-back repeats)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
