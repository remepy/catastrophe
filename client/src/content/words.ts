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

/**
 * The letter shown at the start of a round, or null when the word is too short.
 *
 * Counts letter slots only (spaces and punctuation such as ' - . are not slots). From
 * `minLetters` slots up, one letter is revealed:
 * - a single word: the middle slot (for an even count, the one before the centre);
 * - a phrase: the first slot of the second word.
 * Revealing a letter shows every slot with that letter, as a correct guess would. The choice is
 * fixed per word, so a level always starts the same way.
 */
export function startingRevealLetter(word: string, content: GameContent, letterSet: Set<string>, minLetters: number): string | null {
  const isSlot = (char: string) => letterSet.has(normalizeLetter(char, content));
  const words = word.split(" ").filter((w) => w.length > 0);
  const slotCount = words.reduce((n, w) => n + Array.from(w).filter(isSlot).length, 0);
  if (slotCount < minLetters) return null;

  if (words.length > 1) {
    const first = Array.from(words[1]).find(isSlot);
    if (first) return normalizeLetter(first, content);
  }
  const slots = Array.from(words[0]).filter(isSlot);
  if (slots.length === 0) return null;
  return normalizeLetter(slots[Math.floor((slots.length - 1) / 2)], content);
}
