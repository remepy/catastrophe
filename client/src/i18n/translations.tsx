import { createContext, useContext, type ReactNode } from "react";

/** Keys every translations.json must define. Category names (`category.<id>`) are checked against the word list. */
export const REQUIRED_KEYS = [
  "game.title",
  "tutorial.title",
  "tutorial.attempts",
  "tutorial.slots",
  "tutorial.letters",
  "tutorial.hint",
  "tutorial.start",
  "hud.category",
  "hud.round",
  "hud.hint",
  "hud.exit",
  "hud.music_on",
  "hud.music_off",
  "feedback.correct",
  "feedback.wrong",
  "hint.revealed",
  "round.won",
  "round.lost",
  "round.next",
  "round.exit",
  "session.finished",
  "session.again",
] as const;

export type TranslationKey = (typeof REQUIRED_KEYS)[number] | `category.${string}`;

export interface Translations {
  locale: string;
  dir: "rtl" | "ltr";
  keys: Record<string, string>;
}

/** BR-12 / BR-13: copy comes only from ./translations.json next to the page. Throws on any problem. */
export async function loadTranslations(): Promise<Translations> {
  const response = await fetch("./translations.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`translations.json responded ${response.status}`);
  const json: unknown = await response.json();
  if (!json || typeof json !== "object") throw new Error("translations.json is not an object");

  const { locale, dir, keys } = json as Record<string, unknown>;
  if (typeof locale !== "string" || locale.length === 0) throw new Error("translations.json has no locale");
  if (dir !== "rtl" && dir !== "ltr") throw new Error("translations.json has an invalid dir");
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) throw new Error("translations.json has no keys");

  const entries = Object.entries(keys as Record<string, unknown>);
  if (entries.some(([, v]) => typeof v !== "string")) throw new Error("translations.json has a non-string value");
  const map = Object.fromEntries(entries) as Record<string, string>;

  const missing = REQUIRED_KEYS.filter((key) => !map[key]);
  if (missing.length > 0) throw new Error(`translations.json is missing keys: ${missing.join(", ")}`);

  return { locale, dir, keys: map };
}

export type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function createTranslator(translations: Translations): TranslateFn {
  return (key, vars) => {
    const template = translations.keys[key];
    // Keys are validated at load time; never render a raw key (BR-10/BR-13).
    if (template === undefined) return "";
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

interface I18nValue {
  t: TranslateFn;
  dir: "rtl" | "ltr";
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ translations, children }: { translations: Translations; children: ReactNode }) {
  const value: I18nValue = {
    t: createTranslator(translations),
    dir: translations.dir,
    locale: translations.locale,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

/** Renders `**bold**` segments from a translated string. */
export function RichText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <span key={i} className="font-bold">{part}</span> : <span key={i}>{part}</span>))}
    </>
  );
}
