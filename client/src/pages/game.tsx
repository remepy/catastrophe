import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AnimationScene } from "@/components/animation-scene";
import { LetterKeyboard } from "@/components/letter-keyboard";
import { WordDisplay } from "@/components/word-display";
import { Lightbulb, Volume2, VolumeX, X } from "lucide-react";
import backgroundMusic from "@/assets/music/background.mp3";
import { isAborted, isPaused, post, subscribe } from "@/bridge/cyan-bridge";
import { createLetterSet, lettersInWord, type GameContent } from "@/content/words";
import { resolveLevel } from "@/content/levels";
import { RichText, useI18n } from "@/i18n/translations";
import { storeTutorialSeen, type SessionConfig } from "@/session/use-game-session";
import { FINAL_REVEAL_MS, MAX_WRONG } from "@/game-config";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "animals": { bg: "bg-amber-200 dark:bg-amber-700", text: "text-amber-900 dark:text-amber-100" },
  "foods": { bg: "bg-rose-200 dark:bg-rose-700", text: "text-rose-900 dark:text-rose-100" },
  "household-items": { bg: "bg-sky-200 dark:bg-sky-700", text: "text-sky-900 dark:text-sky-100" },
  "clothing": { bg: "bg-violet-200 dark:bg-violet-700", text: "text-violet-900 dark:text-violet-100" },
  "sports": { bg: "bg-emerald-200 dark:bg-emerald-700", text: "text-emerald-900 dark:text-emerald-100" },
  "nature": { bg: "bg-cyan-200 dark:bg-cyan-700", text: "text-cyan-900 dark:text-cyan-100" },
  "instruments": { bg: "bg-orange-200 dark:bg-orange-700", text: "text-orange-900 dark:text-orange-100" },
  "holidays": { bg: "bg-indigo-200 dark:bg-indigo-700", text: "text-indigo-900 dark:text-indigo-100" },
  "countries": { bg: "bg-teal-200 dark:bg-teal-700", text: "text-teal-900 dark:text-teal-100" },
  "professions": { bg: "bg-pink-200 dark:bg-pink-700", text: "text-pink-900 dark:text-pink-100" },
  "solar-system": { bg: "bg-purple-200 dark:bg-purple-700", text: "text-purple-900 dark:text-purple-100" },
  "cities": { bg: "bg-lime-200 dark:bg-lime-700", text: "text-lime-900 dark:text-lime-100" },
  "historical-figures": { bg: "bg-stone-200 dark:bg-stone-700", text: "text-stone-900 dark:text-stone-100" },
  "flowers": { bg: "bg-fuchsia-200 dark:bg-fuchsia-700", text: "text-fuchsia-900 dark:text-fuchsia-100" },
  "vehicles": { bg: "bg-blue-200 dark:bg-blue-700", text: "text-blue-900 dark:text-blue-100" },
};
const DEFAULT_CATEGORY_COLOR = { bg: "bg-muted", text: "text-foreground" };

type RoundState = "playing" | "won" | "lost";
/** Why input is permanently stopped: app abort, participant quit, or session reported finished. */
type StopReason = "aborted" | "exited" | "finished";

interface GameProps {
  content: GameContent;
  config: SessionConfig;
  onRestart: () => void;
}

export default function Game({ content, config, onRestart }: GameProps) {
  const { t, dir } = useI18n();
  const letterSet = useMemo(() => createLetterSet(content), [content]);
  const totalRounds = config.levelIds.length;

  const [roundIndex, setRoundIndex] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>("playing");
  const [snackbar, setSnackbar] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [showInstructions, setShowInstructions] = useState(!config.tutorialSeen);
  const [musicOn, setMusicOn] = useState(true);
  const [paused, setPaused] = useState(isPaused);
  const [stopped, setStopped] = useState<StopReason | null>(() => (isAborted() ? "aborted" : null));
  const [finishPending, setFinishPending] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  const levelId = config.levelIds[roundIndex];
  // Level IDs were validated against the catalogue in session_start; the word is fixed per ID.
  const { category, word } = useMemo(() => resolveLevel(levelId, content), [levelId, content]);
  const isLastRound = roundIndex === totalRounds - 1;

  const totals = useRef({ wins: 0, rounds: 0, wrongGuesses: 0, hintsUsed: 0 });
  const reportedRound = useRef(-1);
  const snackbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Reduced motion (mirrors the app setting) ----
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", config.reducedMotion);
  }, [config.reducedMotion]);

  // ---- Background music ----
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicOnRef = useRef(true);
  const canPlayRef = useRef(true);

  const playIfAllowed = useCallback(() => {
    const audio = audioRef.current;
    if (audio && musicOnRef.current && canPlayRef.current) audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    const audio = new Audio(backgroundMusic);
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;
    playIfAllowed();

    const events = ["click", "keydown", "touchstart"] as const;
    const startOnInteraction = () => {
      playIfAllowed();
      events.forEach((e) => document.removeEventListener(e, startOnInteraction));
    };
    events.forEach((e) => document.addEventListener(e, startOnInteraction));
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      events.forEach((e) => document.removeEventListener(e, startOnInteraction));
    };
  }, [playIfAllowed]);

  useEffect(() => {
    canPlayRef.current = !paused && !stopped;
    if (canPlayRef.current) {
      playIfAllowed();
    } else {
      audioRef.current?.pause();
    }
  }, [paused, stopped, playIfAllowed]);

  const toggleMusic = useCallback(() => {
    musicOnRef.current = !musicOnRef.current;
    setMusicOn(musicOnRef.current);
    if (musicOnRef.current) playIfAllowed();
    else audioRef.current?.pause();
  }, [playIfAllowed]);

  // ---- App -> game lifecycle messages ----
  useEffect(
    () =>
      subscribe((message) => {
        if (message.type === "pause") setPaused(true);
        else if (message.type === "resume") setPaused(false);
        else if (message.type === "abort") setStopped("aborted"); // the bridge already stopped outgoing messages
      }),
    [],
  );

  const showSnackbar = useCallback((text: string, type: "success" | "error" | "info") => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    setSnackbar({ text, type });
    snackbarTimer.current = setTimeout(() => setSnackbar(null), 2000);
  }, []);

  useEffect(() => () => {
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
  }, []);

  // ---- Round logic ----
  const solutionLetters = useMemo(() => lettersInWord(word, content, letterSet), [word, content, letterSet]);

  const isWon = useMemo(() => {
    for (const letter of Array.from(solutionLetters)) {
      if (!guessedLetters.has(letter)) return false;
    }
    return solutionLetters.size > 0;
  }, [solutionLetters, guessedLetters]);

  useEffect(() => {
    if (isWon && roundState === "playing") setRoundState("won");
  }, [isWon, roundState]);

  const inputDisabled = roundState !== "playing" || paused || stopped !== null || showInstructions;

  const handleGuess = useCallback(
    (letter: string) => {
      if (inputDisabled || guessedLetters.has(letter)) return;

      const newGuessed = new Set(guessedLetters);
      newGuessed.add(letter);
      setGuessedLetters(newGuessed);

      if (solutionLetters.has(letter)) {
        showSnackbar(t("feedback.correct"), "success");
      } else {
        const newWrong = wrongGuesses + 1;
        setWrongGuesses(newWrong);
        if (newWrong >= MAX_WRONG) {
          setRoundState("lost");
        } else {
          showSnackbar(t("feedback.wrong"), "error");
        }
      }
    },
    [inputDisabled, guessedLetters, solutionLetters, wrongGuesses, showSnackbar, t],
  );

  const handleHint = useCallback(() => {
    // No hint limit: each hint reveals one more letter, all the way to the full solution.
    if (inputDisabled) return;

    const unguessed = Array.from(solutionLetters).filter((l) => !guessedLetters.has(l));
    if (unguessed.length === 0) return;

    const randomLetter = unguessed[Math.floor(Math.random() * unguessed.length)];
    const newGuessed = new Set(guessedLetters);
    newGuessed.add(randomLetter);
    setGuessedLetters(newGuessed);
    setHintsUsed(hintsUsed + 1);
    showSnackbar(t("hint.revealed", { letter: randomLetter }), "info");
  }, [inputDisabled, hintsUsed, solutionLetters, guessedLetters, showSnackbar, t]);

  // Report each round once, when it ends (won or lost both count as completed, BR-02).
  useEffect(() => {
    if (roundState === "playing" || reportedRound.current === roundIndex) return;
    reportedRound.current = roundIndex;

    const won = roundState === "won";
    totals.current.rounds += 1;
    if (won) totals.current.wins += 1;
    totals.current.wrongGuesses += wrongGuesses;
    totals.current.hintsUsed += hintsUsed;

    post({
      type: "level_completed",
      data: { levelId, outcome: won ? "won" : "lost", stats: { wrongGuesses, hintsUsed } },
    });

    if (isLastRound) {
      if (config.standalone) setSessionDone(true);
      else setFinishPending(true);
    }
  }, [roundState, roundIndex, levelId, wrongGuesses, hintsUsed, isLastRound, config.standalone]);

  const finishSession = useCallback(() => {
    post({
      type: "game_finished",
      data: { lastCompletedLevelId: config.levelIds[totalRounds - 1], stats: { ...totals.current } },
    });
    setFinishPending(false);
    setStopped("finished");
  }, [config.levelIds, totalRounds]);

  // After the last round, keep the word visible briefly, then end the activity. Waits while paused.
  useEffect(() => {
    if (!finishPending || paused || stopped) return;
    const timer = setTimeout(finishSession, FINAL_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [finishPending, paused, stopped, finishSession]);

  const nextRound = useCallback(() => {
    if (paused || stopped || isLastRound) return;
    const next = roundIndex + 1;
    setRoundIndex(next);
    setGuessedLetters(new Set());
    setWrongGuesses(0);
    setHintsUsed(0);
    setSnackbar(null);
    setRoundState("playing");
  }, [paused, stopped, isLastRound, roundIndex]);

  const exitActivity = useCallback(() => {
    if (stopped) return;
    if (config.standalone) {
      window.close();
      return;
    }
    if (finishPending) return;
    post({ type: "game_exit_requested" });
    setStopped("exited");
  }, [stopped, config.standalone, finishPending]);

  const dismissInstructions = useCallback(() => {
    setShowInstructions(false);
    storeTutorialSeen();
  }, []);

  const categoryColor = CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
  const showRoundPanel = roundState !== "playing" && !isLastRound;
  const showFinishedPanel = sessionDone && config.standalone;
  const interactionLocked = paused || stopped !== null;
  // All rounds are done and game_finished is about to be posted; quitting now would abandon a completed session.
  const exitLocked = interactionLocked || finishPending;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background" dir={dir}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="relative flex flex-col items-center justify-start px-4 min-h-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 100px)", paddingBottom: "10px" }}
        >
          <div
            className="absolute right-2 left-2 z-20 flex items-center justify-between gap-2 pointer-events-none"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
          >
            <Button
              size="icon"
              variant="outline"
              onClick={toggleMusic}
              className="min-w-[2.75rem] min-h-[2.75rem] border-2 rounded-full bg-transparent shadow-none pointer-events-auto flex-shrink-0"
              data-testid="button-music-toggle"
              aria-label={musicOn ? t("hud.music_on") : t("hud.music_off")}
            >
              {musicOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            <div className="flex flex-col items-center gap-1.5 pointer-events-auto min-w-0">
              <h1
                className="text-xs sm:text-sm font-bold text-primary bg-transparent border-2 border-primary rounded-full px-4 py-1.5 whitespace-nowrap"
                data-testid="text-title"
              >
                {t("game.title")}
              </h1>
              <div className="flex gap-1" data-testid="punch-card">
                {Array.from({ length: MAX_WRONG }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full border transition-all duration-300 ${
                      i < wrongGuesses
                        ? "bg-red-500 border-red-700 dark:bg-red-500 dark:border-red-300"
                        : "bg-transparent border-foreground/50"
                    }`}
                    data-testid={`punch-hole-${i}`}
                  />
                ))}
              </div>
              {totalRounds > 1 && (
                <p className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-round">
                  {t("hud.round", { current: roundIndex + 1, total: totalRounds })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
              <Button
                size="icon"
                variant="outline"
                onClick={handleHint}
                disabled={inputDisabled}
                className="min-w-[2.75rem] min-h-[2.75rem] text-sm font-bold border-2 rounded-full bg-transparent shadow-none"
                data-testid="button-hint"
                aria-label={t("hud.hint")}
              >
                <Lightbulb className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={exitActivity}
                disabled={exitLocked}
                className="min-w-[2.75rem] min-h-[2.75rem] border-2 rounded-full bg-transparent shadow-none"
                data-testid="button-exit"
                aria-label={t("hud.exit")}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="w-full max-w-sm">
            <AnimationScene wrongGuesses={wrongGuesses} />
          </div>
        </div>

        <div className="px-4 text-center whitespace-nowrap" style={{ paddingTop: "6px", paddingBottom: "8px" }} data-testid="text-category">
          <span className="text-base text-foreground">{t("hud.category")} </span>
          <span className={`inline-block px-3 py-1 rounded-md text-base font-bold ${categoryColor.bg} ${categoryColor.text}`}>
            {t(`category.${category}`)}
          </span>
        </div>

        <div className="px-4 pt-1 pb-0">
          <WordDisplay
            word={word}
            content={content}
            letterSet={letterSet}
            guessedLetters={guessedLetters}
            revealed={roundState === "lost"}
            dir={dir}
          />
        </div>

        {(showRoundPanel || showFinishedPanel) && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom-4 duration-300"
            data-testid="endgame-panel"
          >
            <div
              className="bg-card border-t-2 border-primary shadow-2xl px-6 pt-5 flex flex-col items-center gap-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
            >
              <p className="text-2xl font-bold text-center text-foreground" data-testid="text-round-result">
                {roundState === "won" ? t("round.won") : t("round.lost")}
              </p>
              {showFinishedPanel && (
                <p className="text-lg text-center text-muted-foreground" data-testid="text-session-finished">
                  {t("session.finished")}
                </p>
              )}
              <div className="flex gap-3 w-full max-w-sm">
                <Button
                  size="lg"
                  onClick={showFinishedPanel ? onRestart : nextRound}
                  disabled={interactionLocked}
                  data-testid={showFinishedPanel ? "button-play-again" : "button-next-round"}
                  className="flex-1 text-xl font-bold py-7 border-2 shadow-lg"
                >
                  {showFinishedPanel ? t("session.again") : t("round.next")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={exitActivity}
                  disabled={exitLocked}
                  data-testid="button-exit-overlay"
                  className="flex-1 text-base font-semibold py-7 border-2"
                >
                  {t("round.exit")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="px-2 pt-1 pb-1" style={{ marginTop: "24px" }}>
          <LetterKeyboard
            rows={content.keyboard}
            guessedLetters={guessedLetters}
            solutionLetters={solutionLetters}
            onGuess={handleGuess}
            disabled={inputDisabled}
          />
        </div>
      </div>

      {showInstructions && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm px-6 animate-in fade-in duration-300"
          data-testid="instructions-overlay"
        >
          <div className="max-w-md w-full bg-card border-2 border-primary rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-5 text-foreground">
            <h2 className="text-2xl font-bold text-primary text-center" data-testid="text-instructions-title">
              {t("tutorial.title")}
            </h2>
            <div className="text-base sm:text-lg leading-relaxed space-y-4">
              <p>
                <RichText text={t("tutorial.attempts", { count: MAX_WRONG })} />
              </p>
              <p className="flex flex-wrap items-center gap-x-1 gap-y-2">
                <span>{t("tutorial.slots")}</span>
                <span className="inline-flex gap-1 align-middle mx-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="inline-block rounded-md"
                      style={{
                        width: "1.1rem",
                        height: "1.35rem",
                        background: "#ffffff",
                        border: "1px solid #e7e5e4",
                        boxShadow: "0 1.5px 0 #d6d3d1, 0 2px 5px rgba(0,0,0,0.06)",
                      }}
                    />
                  ))}
                </span>
                <span>{t("tutorial.letters")}</span>
              </p>
              <p>
                {t("tutorial.hint")} <Lightbulb className="inline w-5 h-5 align-middle text-primary" aria-hidden="true" />.
              </p>
            </div>
            <Button
              size="lg"
              onClick={dismissInstructions}
              disabled={interactionLocked}
              className="text-xl font-bold py-6 mt-2"
              data-testid="button-start-game"
            >
              {t("tutorial.start")}
            </Button>
          </div>
        </div>
      )}

      {snackbar && roundState === "playing" && (
        <div
          className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          <div
            className={`px-7 py-4 rounded-lg shadow-xl text-lg font-bold animate-in fade-in slide-in-from-bottom-4 duration-300 ${
              snackbar.type === "success" ? "bg-emerald-600 text-white" : snackbar.type === "error" ? "bg-red-600 text-white" : "bg-sky-600 text-white"
            }`}
            data-testid="snackbar-message"
          >
            {snackbar.text}
          </div>
        </div>
      )}
    </div>
  );
}
