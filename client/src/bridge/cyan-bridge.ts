/**
 * Cyan Game Bridge v1 transport.
 *
 * Game -> app: window.CyanGameBridge.postMessage(JSON.stringify({ type, data }))
 * App -> game: window.cyanBridge.receive({ type, data })
 *
 * When the page runs without the app (BR-09) nothing is posted.
 */

export type Stats = Record<string, number>;

export interface SessionStartData {
  protocolVersion: number;
  sessionId: string;
  expectedLocale: string;
  levelIds: string[];
  reducedMotion: boolean;
  tutorialSeen?: boolean;
}

export type AppMessage =
  | { type: "session_start"; data: SessionStartData }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "abort"; data?: { reason?: string } };

export type GameMessage =
  | { type: "game_ready"; data: { gameId: string; protocolVersion: number; locale: string } }
  | { type: "level_completed"; data: { levelId: string; outcome: "won" | "lost"; stats: Stats } }
  | { type: "game_finished"; data: { lastCompletedLevelId: string; stats: Stats } }
  | { type: "game_exit_requested" }
  | { type: "game_error"; data: { code: string; message: string } };

declare global {
  interface Window {
    CyanGameBridge?: { postMessage(message: string): void };
    cyanBridge?: { receive(message: unknown): void };
  }
}

/** Messages after which the game must post nothing further. */
const TERMINAL_TYPES = new Set<GameMessage["type"]>(["game_finished", "game_exit_requested", "game_error"]);

let terminated = false;
let paused = false;
let aborted = false;
const listeners = new Set<(message: AppMessage) => void>();
const pending: AppMessage[] = [];

export function hasHost(): boolean {
  return typeof window.CyanGameBridge?.postMessage === "function";
}

/** Latest pause/resume state from the app, so late subscribers start in the right state. */
export function isPaused(): boolean {
  return paused;
}

/** True once the app has sent `abort`. The game stops audio and input and posts nothing further. */
export function isAborted(): boolean {
  return aborted;
}

export function isTerminated(): boolean {
  return terminated;
}

/** Stop all further outgoing messages (used on `abort`). */
export function terminate(): void {
  terminated = true;
}

export function post(message: GameMessage): void {
  if (terminated) return;
  if (TERMINAL_TYPES.has(message.type)) terminated = true;

  if (!hasHost()) {
    if (import.meta.env.DEV) console.debug("[bridge] standalone, not posted:", message);
    return;
  }
  try {
    window.CyanGameBridge!.postMessage(JSON.stringify(message));
  } catch (error) {
    console.error("[bridge] postMessage failed", error);
  }
}

export function postError(code: string, message: string): void {
  post({ type: "game_error", data: { code, message } });
}

function parseIncoming(raw: unknown): AppMessage | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const type = (value as { type?: unknown }).type;
  if (type !== "session_start" && type !== "pause" && type !== "resume" && type !== "abort") return null;
  return value as AppMessage;
}

/** Defines window.cyanBridge.receive. Must run before `game_ready` is posted. */
export function installReceiver(): void {
  window.cyanBridge = {
    receive(raw: unknown) {
      const message = parseIncoming(raw);
      if (!message) {
        console.warn("[bridge] ignored unrecognised message");
        return;
      }
      if (message.type === "pause") paused = true;
      if (message.type === "resume") paused = false;
      if (message.type === "abort") {
        aborted = true;
        terminated = true;
      }
      if (listeners.size === 0) {
        pending.push(message);
        return;
      }
      listeners.forEach((listener) => listener(message));
    },
  };
}

/** Subscribe to app -> game messages. Messages received before the first subscriber are replayed. */
export function subscribe(listener: (message: AppMessage) => void): () => void {
  listeners.add(listener);
  while (pending.length > 0) listener(pending.shift()!);
  return () => {
    listeners.delete(listener);
  };
}
