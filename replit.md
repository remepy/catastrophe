# replit.md

## Overview

**חתול תעלול** (gameId `Catastrophe`): a Hebrew hangman game where players guess letters before a cat pushes a vase off a shelf. It is one of six games in the Cyan app, a Flutter health app for people with Parkinson's. The app loads each game as a static site from S3/CloudFront in a full-window WebView. The game and the app talk over the **Cyan Game Bridge v1** (spec: `attached_assets/cyan-game-bridge-v1_*.md`).

## User Preferences

Preferred communication style: Simple, everyday language.
Dictionary edits: approve suggestion lists before applying; replacement words must not already exist in the dictionary.

## Bridge integration (how the game maps to the spec)

- **Level = category.** `levelIds` from `session_start` are category ids (`animals`, `flowers`, …); the game picks a random word from each, without repeats within a session.
- **Lifecycle**: load `./translations.json` + `./words.json` → `game_ready` → wait for `session_start` (5 s timeout → `game_error session_timeout`) → one `level_completed` per round → `game_finished` 1.5 s after the last round. There is no success screen after the last round.
- **Error codes**: `translations_unavailable`, `content_unavailable`, `locale_mismatch`, `invalid_level`, `unsupported_protocol`, `invalid_session`, `session_timeout`. After any error the page renders nothing.
- **Stats keys**: `level_completed` → `wrongGuesses`, `hintsUsed`; `game_finished` → `wins`, `rounds`, `wrongGuesses`, `hintsUsed` (all ints).
- **Standalone** (no `window.CyanGameBridge`): 3 random categories, posts nothing, "new game" at the end.
- Only persisted value: `localStorage["catastrophe.tutorialSeen"]`; `session_start.tutorialSeen` wins when present.
- **Blinding (BR-10)**: no "placebo/sham/control/mock/demo/dummy" in identifiers, keys, file names or copy. `npm run build:games` checks source and output and fails on a hit.
- **Hebrew copy must be gender-neutral** (impersonal forms such as "יש לבחור" or "אפשר ללחוץ", never masculine/feminine singular).

## Structure

- `client/src/bridge/cyan-bridge.ts` — transport (post / receive / terminate).
- `client/src/session/use-game-session.ts` — load, handshake, validation, standalone defaults.
- `client/src/i18n/translations.tsx` — loads and validates `translations.json`, `t()`; required keys are listed in `REQUIRED_KEYS`.
- `client/src/content/words.ts` — loads `words.json` (keyboard rows, final-letter forms, categories).
- `client/src/pages/game.tsx` — rounds, hints, music, pause/abort, quit.
- `client/locales/<lang>/translations.json` and `words.json` — all copy and words per language. Adding a language means adding a folder, e.g. `client/locales/en/`.
- `client/src/game-config.ts` — gameId, timeouts, rounds, limits.
- Images/music live in `client/src/assets/` and are imported so the build content-hashes them.

## Build & run

- `npm run dev` — Express + Vite on port 5000. Vite serves the Hebrew locale files at `/`. Set `GAME_LANG=xx` to use a different language.
- `npm run build:games [lang…]` — static builds at `dist/games/Catastrophe/<lang>/` (relative base, hashed `assets/`) + blinding check.
- S3 cache policy: `index.html`, `translations.json`, `words.json` → `no-cache`; `assets/*` → `public, max-age=31536000, immutable`.
- `npm run build` / `npm run start` — the Express build still exists, serving the Hebrew build at `/`.

## Tech

React 18 + TypeScript, Vite, Tailwind + shadcn/ui, Heebo font self-hosted via `@fontsource/heebo` (no external requests). Express is used only as the dev server; there are no API routes.
