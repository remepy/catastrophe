import { normalizeLetter, type GameContent } from "@/content/words";

const PUNCTUATION_DISPLAY: Record<string, string> = {
  "'": "׳",
  "\u05F3": "׳",
  '"': "״",
  "\u05F4": "״",
};

interface WordDisplayProps {
  word: string;
  content: GameContent;
  letterSet: Set<string>;
  guessedLetters: Set<string>;
  revealed: boolean;
  dir: "rtl" | "ltr";
}

export function WordDisplay({ word, content, letterSet, guessedLetters, revealed, dir }: WordDisplayProps) {
  const words = word.split(" ");
  // Geresh/gershayim substitution only applies to right-to-left scripts.
  const displayPunctuation = (char: string) => (dir === "rtl" ? PUNCTUATION_DISPLAY[char] ?? char : char);

  return (
    <div className="flex flex-wrap justify-center gap-4" dir={dir} data-testid="word-display">
      {words.map((w, wordIdx) => {
        const characters = Array.from(w);
        const letters = characters.filter((part) => letterSet.has(normalizeLetter(part, content))).length;
        const punctuation = characters.length - letters;
        // Keep each whole word inside the game area, including on narrow phones.
        const slotWidth = `min(clamp(1.95rem, calc((100vw - 2rem) / 18), 3.5rem), calc((100vw - 2rem - ${(characters.length - 1) * 4}px - ${punctuation * 20}px) / ${letters || 1}))`;
        return (
        <div key={wordIdx} className="flex gap-1 justify-center">
          {characters.map((char, charIdx) => {
            const normalizedChar = normalizeLetter(char, content);

            if (!letterSet.has(normalizedChar)) {
              return (
                <div
                  key={charIdx}
                  className="flex items-center justify-center text-lg font-bold text-foreground"
                  style={{ width: "1.25rem" }}
                >
                  {displayPunctuation(char)}
                </div>
              );
            }

            const isRevealed = revealed || guessedLetters.has(normalizedChar);
            const isMissed = revealed && !guessedLetters.has(normalizedChar);
            return (
              <div
                key={charIdx}
                className="flex items-center justify-center rounded-xl transition-all duration-300"
                style={{
                  width: slotWidth,
                  height: "clamp(2.35rem, calc((100vw - 2rem) / 18 * 1.35), 4.2rem)",
                  background: isMissed ? "#fef2f2" : isRevealed ? "#ecfdf5" : "#ffffff",
                  border: isMissed ? "1px solid #fca5a5" : isRevealed ? "1px solid #6ee7b7" : "1px solid #e7e5e4",
                  boxShadow: isMissed
                    ? "0 2px 0 #ef4444, 0 3px 8px rgba(239,68,68,0.18)"
                    : isRevealed
                    ? "0 2px 0 #10b981, 0 3px 8px rgba(16,185,129,0.18)"
                    : "0 2px 0 #d6d3d1, 0 3px 8px rgba(0,0,0,0.06)",
                }}
                data-testid={`letter-slot-${wordIdx}-${charIdx}`}
              >
                {isRevealed && (
                  <span
                    className="font-bold"
                    style={{
                      color: isMissed ? "#991b1b" : "#065f46",
                      fontSize: `min(clamp(1.125rem, calc((100vw - 2rem) / 18 * 0.65), 2rem), calc(${slotWidth} * 0.72))`,
                    }}
                  >
                    {char}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        );
      })}
    </div>
  );
}
