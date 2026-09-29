import { Button } from "@/components/ui/button";

interface LetterKeyboardProps {
  rows: string[][];
  guessedLetters: Set<string>;
  solutionLetters: Set<string>;
  onGuess: (letter: string) => void;
  disabled: boolean;
}

export function LetterKeyboard({ rows, guessedLetters, solutionLetters, onGuess, disabled }: LetterKeyboardProps) {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full" data-testid="letter-keyboard">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1.5 sm:gap-3 justify-center w-full">
          {row.map((letter) => {
            const isGuessed = guessedLetters.has(letter);
            const isCorrect = isGuessed && solutionLetters.has(letter);
            const isWrong = isGuessed && !solutionLetters.has(letter);

            return (
              <Button
                key={letter}
                variant={isCorrect ? "default" : isWrong ? "destructive" : "outline"}
                className={`flex-1 max-w-[4.5rem] min-w-0 min-h-[3.5rem] sm:min-h-[4rem] text-2xl sm:text-3xl font-bold px-0 border-2 ${
                  isGuessed ? "opacity-70" : ""
                } ${isWrong ? "line-through" : ""}`}
                onClick={() => onGuess(letter)}
                disabled={disabled || isGuessed}
                data-testid={`button-letter-${letter}`}
              >
                {letter}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
