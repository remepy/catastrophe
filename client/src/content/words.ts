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
 * The one slot shown at the start of a round, as an index into `Array.from(word)`, or null when
 * the word is too short.
 *
 * Counts letter slots only (spaces and punctuation such as ' - . are not slots). From
 * `minLetters` slots up, exactly one slot is shown, even if its letter appears elsewhere:
 * - a single word: the middle slot (for an even count, the one before the centre);
 * - a phrase: the first slot of the second word.
 * The letter itself is not marked as guessed. The choice is fixed per word, so a level always
 * starts the same way.
 */
export function startingRevealIndex(word: string, content: GameContent, letterSet: Set<string>, minLetters: number): number | null {
  const chars = Array.from(word);
  const isSlot = (char: string) => letterSet.has(normalizeLetter(char, content));
  const slots = chars.flatMap((c, i) => (isSlot(c) ? [i] : []));
  if (slots.length < minLetters) return null;

  // Word boundaries: index where each space-separated word starts.
  const wordStarts = chars.flatMap((c, i) => (c !== " " && (i === 0 || chars[i - 1] === " ") ? [i] : []));
  if (wordStarts.length > 1) {
    const firstOfSecond = slots.find((i) => i >= wordStarts[1] && (wordStarts.length < 3 || i < wordStarts[2]));
    if (firstOfSecond !== undefined) return firstOfSecond;
  }
  const end = wordStarts.length > 1 ? wordStarts[1] : chars.length;
  const firstWordSlots = slots.filter((i) => i < end);
  if (firstWordSlots.length === 0) return null;
  return firstWordSlots[Math.floor((firstWordSlots.length - 1) / 2)];
}

/**
 * Letters the participant still has to find: every letter in the word, except a letter whose only
 * occurrence is the slot shown at the start.
 */
export function requiredLetters(word: string, content: GameContent, letterSet: Set<string>, givenIndex: number | null): Set<string> {
  const letters = new Set<string>();
  Array.from(word).forEach((char, i) => {
    const normalized = normalizeLetter(char, content);
    if (letterSet.has(normalized) && i !== givenIndex) letters.add(normalized);
  });
  return letters;
}
