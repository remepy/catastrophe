/** Identifier reported to the Cyan app in `game_ready`. Also the folder name in the S3 layout. */
export const GAME_ID = "Catastrophe";

/** Cyan Game Bridge protocol version implemented by this build. */
export const PROTOCOL_VERSION = 1;

/** BR-11: how long to wait for `session_start` after posting `game_ready`. */
export const SESSION_START_TIMEOUT_MS = 5000;

/** Rounds played when the page is opened without the app (BR-09, QA in a desktop browser). */
export const STANDALONE_ROUNDS = 3;

/** Pause after the final round so the solved or revealed word stays visible before `game_finished`. */
export const FINAL_REVEAL_MS = 1500;

/** BR-06: the only value this game persists across sessions. */
export const TUTORIAL_STORAGE_KEY = "catastrophe.tutorialSeen";

export const MAX_WRONG = 7;
export const MAX_HINTS = 2;
