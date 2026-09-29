/**
 * Language-specific game content, loaded from ./words.json next to the page.
 * Each language build ships its own file, so an English build only needs new content.
 */
export interface GameContent {
  /** Keyboard rows, in display order. Also defines which characters count as guessable letters. */
  keyboard: string[][];
  /** Final (sofit) letter forms mapped to the keyboard letter they are guessed with. */
  finalForms: Record<string, string>;
  /** Level catalogue: category id (the bridge levelId) -> words and phrases. */
  categories: Record<string, string[]>;
}

export async function loadContent(): Promise<GameContent> {
  const response = await fetch("./words.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`words.json responded ${response.status}`);
  const json = (await response.json()) as Partial<GameContent> | null;

  const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

  if (!json || !Array.isArray(json.keyboard) || !json.keyboard.every(isStringArray)) {
    throw new Error("words.json has an invalid keyboard");
  }
  if (!json.finalForms || typeof json.finalForms !== "object") {
    throw new Error("words.json has invalid finalForms");
  }
  if (!json.categories || typeof json.categories !== "object") {
    throw new Error("words.json has no categories");
  }
  for (const [id, words] of Object.entries(json.categories)) {
    if (!isStringArray(words) || words.length === 0) throw new Error(`words.json category ${id} is empty`);
  }
  return json as GameContent;
}

export function normalizeLetter(char: string, content: GameContent): string {
  return content.finalForms[char] ?? char;
}

export function createLetterSet(content: GameContent): Set<string> {
  return new Set(content.keyboard.flat());
}

/** The distinct guessable letters in a word, normalised to their keyboard form. */
export function lettersInWord(word: string, content: GameContent, letterSet: Set<string>): Set<string> {
  const letters = new Set<string>();
  for (const char of word) {
    const normalized = normalizeLetter(char, content);
    if (letterSet.has(normalized)) letters.add(normalized);
  }
  return letters;
}
