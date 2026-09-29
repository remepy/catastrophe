import catalogue from "./levels.json";
import { GAME_ID } from "@/game-config";
import type { GameContent } from "./words";

/**
 * Fixed level catalogue. Level `catastrophe-0001` is catalogue[0], and so on.
 * Each entry is [categoryId, wordIndex] into words.json. The he and en word lists are
 * index-aligned, so a level ID names the same slot in every language build.
 *
 * The catalogue is append-only: `npm run levels` keeps every existing entry and only adds new
 * words at the end, so an ID the app has already stored never changes meaning (BR-03).
 */
export type LevelEntry = readonly [category: string, wordIndex: number];

const ENTRIES = catalogue as unknown as LevelEntry[];

export const LEVEL_COUNT = ENTRIES.length;

export function levelIdAt(position: number): string {
  return `${GAME_ID}-${String(position + 1).padStart(4, "0")}`;
}

const POSITION_BY_ID = new Map<string, number>(ENTRIES.map((_, i) => [levelIdAt(i), i]));

export function isKnownLevel(id: string): boolean {
  return POSITION_BY_ID.has(id);
}

export interface Level {
  id: string;
  category: string;
  word: string;
}

/** Resolves a level ID to its category and word. Throws on an unknown ID. */
export function resolveLevel(id: string, content: GameContent): Level {
  const position = POSITION_BY_ID.get(id);
  if (position === undefined) throw new Error(`unknown level ${id}`);
  const [category, wordIndex] = ENTRIES[position];
  return { id, category, word: content.categories[category][wordIndex] };
}

/** Catalogue entries that words.json cannot satisfy (missing category or index out of range). */
export function unresolvedLevels(content: GameContent): string[] {
  return ENTRIES.flatMap(([category, wordIndex], i) => {
    const words = content.categories[category];
    return words && wordIndex < words.length ? [] : [levelIdAt(i)];
  });
}

/** `count` consecutive level IDs starting at `start`, wrapping at the end of the catalogue. */
export function consecutiveLevels(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, k) => levelIdAt((start + k) % LEVEL_COUNT));
}
