import { useCallback, useEffect, useState } from "react";
import { hasHost, isAborted, post, postError, subscribe, type SessionStartData } from "@/bridge/cyan-bridge";
import { loadContent, type GameContent } from "@/content/words";
import { LEVEL_COUNT, consecutiveLevels, isKnownLevel, unresolvedLevels } from "@/content/levels";
import { loadTranslations, type Translations } from "@/i18n/translations";
import {
  GAME_ID,
  PROTOCOL_VERSION,
  SESSION_START_TIMEOUT_MS,
  STANDALONE_ROUNDS,
  TUTORIAL_STORAGE_KEY,
} from "@/game-config";

export interface SessionConfig {
  levelIds: string[];
  reducedMotion: boolean;
  tutorialSeen: boolean;
  /** True when opened without the app (BR-09): nothing is posted. */
  standalone: boolean;
}

export type SessionState =
  | { phase: "loading" }
  | { phase: "running"; translations: Translations; content: GameContent; config: SessionConfig; runId: number }
  /** Unrecoverable or aborted before start: render nothing. */
  | { phase: "ended" };

export function readTutorialSeen(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function storeTutorialSeen(): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // Storage unavailable (e.g. private mode); the app's tutorialSeen flag stays authoritative.
  }
}

/** Standalone (BR-09): a random run of consecutive catalogue levels. "New game" continues from there. */
let standaloneStart = Math.floor(Math.random() * LEVEL_COUNT);

function nextStandaloneLevels(): string[] {
  const ids = consecutiveLevels(standaloneStart, STANDALONE_ROUNDS);
  standaloneStart = (standaloneStart + STANDALONE_ROUNDS) % LEVEL_COUNT;
  return ids;
}

function standaloneConfig(): SessionConfig {
  return {
    levelIds: nextStandaloneLevels(),
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    tutorialSeen: readTutorialSeen(),
    standalone: true,
  };
}

/** Validates session_start. Returns an error code, or null when valid. */
function validateSessionStart(data: SessionStartData | undefined, translations: Translations): string | null {
  if (!data || typeof data !== "object") return "invalid_session";
  if (data.protocolVersion !== PROTOCOL_VERSION) return "unsupported_protocol";
  if (typeof data.sessionId !== "string" || typeof data.reducedMotion !== "boolean") return "invalid_session";
  // tutorialSeen is optional: BR-06 only requires preferring it "when present".
  if (data.tutorialSeen !== undefined && typeof data.tutorialSeen !== "boolean") return "invalid_session";
  if (data.expectedLocale !== translations.locale) return "locale_mismatch";
  if (
    !Array.isArray(data.levelIds) ||
    data.levelIds.length === 0 ||
    !data.levelIds.every((id) => typeof id === "string" && isKnownLevel(id))
  ) {
    return "invalid_level";
  }
  return null;
}

let started = false;

/**
 * Runs the bridge lifecycle: load copy and content, post game_ready, wait for session_start.
 * See Cyan Game Bridge v1 §5.
 */
export function useGameSession() {
  const [state, setState] = useState<SessionState>({ phase: "loading" });

  useEffect(() => {
    // The lifecycle runs once per page load, even if the component remounts.
    if (started) return;
    started = true;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let finished = false;

    /** Ends the lifecycle for good; later bridge messages are ignored. */
    const stop = () => {
      finished = true;
      if (timeout) clearTimeout(timeout);
      unsubscribe?.();
      unsubscribe = undefined;
    };

    const end = (code: string, message: string) => {
      stop();
      postError(code, message);
      setState({ phase: "ended" });
    };

    (async () => {
      let translations: Translations;
      try {
        translations = await loadTranslations();
      } catch (error) {
        end("translations_unavailable", error instanceof Error ? error.message : "translations failed to load");
        return;
      }

      let content: GameContent;
      try {
        content = await loadContent();
      } catch (error) {
        end("content_unavailable", error instanceof Error ? error.message : "words failed to load");
        return;
      }

      const unresolved = unresolvedLevels(content);
      if (unresolved.length > 0) {
        end("content_unavailable", `words.json cannot resolve ${unresolved.length} catalogue levels, first ${unresolved[0]}`);
        return;
      }

      const missingCategories = Object.keys(content.categories).filter((id) => !translations.keys[`category.${id}`]);
      if (missingCategories.length > 0) {
        end("translations_unavailable", `translations.json is missing category names: ${missingCategories.join(", ")}`);
        return;
      }

      // BR-15: direction and language come only from translations.json.
      document.documentElement.dir = translations.dir;
      document.documentElement.lang = translations.locale;
      document.title = translations.keys["game.title"];

      if (!hasHost()) {
        setState({ phase: "running", translations, content, config: standaloneConfig(), runId: 0 });
        return;
      }

      if (isAborted()) {
        stop();
        setState({ phase: "ended" });
        return;
      }

      let sessionReceived = false;
      unsubscribe = subscribe((message) => {
        if (finished) return;
        if (message.type === "abort" && !sessionReceived) {
          // The bridge has already stopped outgoing messages.
          stop();
          setState({ phase: "ended" });
          return;
        }
        if (message.type !== "session_start" || sessionReceived) return;
        sessionReceived = true;
        if (timeout) clearTimeout(timeout);

        const errorCode = validateSessionStart(message.data, translations);
        if (errorCode) {
          end(errorCode, `session_start rejected: ${errorCode}`);
          return;
        }
        setState({
          phase: "running",
          translations,
          content,
          config: {
            levelIds: message.data.levelIds,
            reducedMotion: message.data.reducedMotion === true,
            // BR-06: the app's flag is authoritative when present.
            tutorialSeen: typeof message.data.tutorialSeen === "boolean" ? message.data.tutorialSeen : readTutorialSeen(),
            standalone: false,
          },
          runId: 0,
        });
        // Pause/resume/abort from here on are handled by the Game (and tracked by the bridge).
        stop();
      });

      post({ type: "game_ready", data: { gameId: GAME_ID, protocolVersion: PROTOCOL_VERSION, locale: translations.locale } });

      // BR-11: without session_start the activity ends without completion.
      timeout = setTimeout(() => {
        if (!sessionReceived && !finished) end("session_timeout", "no session_start within timeout");
      }, SESSION_START_TIMEOUT_MS);
    })();

    return () => stop();
  }, []);

  /** Standalone only: start a fresh session with the next run of levels. */
  const restartStandalone = useCallback(() => {
    setState((current) =>
      current.phase === "running" && current.config.standalone
        ? { ...current, config: standaloneConfig(), runId: current.runId + 1 }
        : current,
    );
  }, []);

  return { state, restartStandalone };
}
