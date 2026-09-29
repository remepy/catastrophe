/**
 * Bridge spec §4.1: one slug for the `gameId` in `game_ready`, the level-ID prefix, the S3 path
 * segment (/games/catastrophe/{lang}/) and the activity id suffix (cyan_game_catastrophe).
 */
export const GAME_ID = "catastrophe";

/** Cyan Game Bridge protocol version implemented by this build. */
export const PROTOCOL_VERSION = 1;

/** BR-11: how long to wait for `session_start` after posting `game_ready`. */
export const SESSION_START_TIMEOUT_MS = 5000;

/** Rounds played when the page is opened without the app (BR-09, QA in a desktop browser). */
export const STANDALONE_ROUNDS = 4;

/** Pause after the final round so the solved or revealed word stays visible before `game_finished`. */
export const FINAL_REVEAL_MS = 1500;

/** BR-06: the only value this game persists across sessions. */
export const TUTORIAL_STORAGE_KEY = "catastrophe.tutorialSeen";

export const MAX_WRONG = 7;

/** Support timer: after this long with no interaction during a round, the hint button flashes. */
export const HINT_NUDGE_IDLE_MS = 90_000;
/** How many times the hint button flashes per nudge, and the on/off step length. */
export const HINT_NUDGE_FLASHES = 2;
export const HINT_NUDGE_STEP_MS = 400;

/** Words and phrases with at least this many letter slots start the round with one letter shown. */
export const STARTING_REVEAL_MIN_LETTERS = 7;
