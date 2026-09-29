# Catastrophe

A word-guessing game in Hebrew and US English: guess the letters of a word or phrase before the
cat knocks the vase off the shelf. One of the six Cyan games. The Flutter app loads it full-window
in a WebView from S3/CloudFront and talks to it over the **Cyan Game Bridge v1** (revision C).

## Binding

| | |
|---|---|
| `gameId` | `catastrophe` |
| Activity id | `cyan_game_catastrophe` |
| URL | `https://<cdn>/games/catastrophe/{lang}/index.html` (`{lang}` = `he` or `en`) |
| Display name | he: חתול תעלול · en: Catastrophe (from `translations.json`, key `game.title`) |
| Level catalogue | 1000 fixed levels, `catastrophe-0001` … `catastrophe-1000`, one word each |
| Rounds per session | 4 (the app sends `levelIds`; standalone QA mode also plays 4) |
| `level_completed.stats` | `wrongGuesses`, `hintsUsed` (int) |
| `game_finished.stats` | `wins`, `rounds`, `wrongGuesses`, `hintsUsed` (int, session totals) |
| Persisted | `localStorage["catastrophe.tutorialSeen"]` only; `session_start.tutorialSeen` wins |

### Levels

`client/src/content/levels.json` maps each level to `[categoryId, wordIndex]` in `words.json`.
The Hebrew and English word lists are index-aligned (same categories, same counts), so a level ID
means the same slot in both builds; the word itself is localised (for example, `cities` holds
Israeli cities in Hebrew and US cities in English). Categories are mixed evenly and never repeat
back to back.

The catalogue is **append-only**. To add words, append them to the end of a category in **both**
`words.json` files, then run `npm run levels`: existing IDs keep their meaning and the new words
are added as new levels at the end. Never reorder or delete words that are already in the catalogue.
The build fails if the catalogue does not resolve in every language.

### Bridge behaviour

- Lifecycle: load `./translations.json` and `./words.json` → `game_ready` → wait for
  `session_start` (5 s, then `game_error session_timeout`) → one `level_completed` per round →
  `game_finished` 1.5 s after the last round. There is no success screen after the last round.
- Error codes: `translations_unavailable`, `content_unavailable`, `locale_mismatch`,
  `invalid_level`, `unsupported_protocol`, `invalid_session`, `session_timeout`. After any error
  the page renders nothing; `message` is for logs only.
- `pause` disables input and music (and holds the final 1.5 s reveal); `abort` stops everything
  and posts nothing further. The ✕ quit button posts `game_exit_requested`.
- Support timer: after 90 s with no tap or key press during a round, the hint button flashes
  twice, and again after each further 90 s idle. It stops while paused, during the tutorial and
  on the round-end panel, and restarts from zero when play resumes. It is a colour change, so it
  also shows with `reducedMotion`. Tuning: `HINT_NUDGE_*` in `client/src/game-config.ts`.
- Standalone (no `window.CyanGameBridge`): 4 consecutive levels from a random start, posts nothing,
  "new game" continues with the next 4.

## Develop

```bash
npm install
npm run dev        # Hebrew, http://localhost:5173
npm run dev:en     # English
npm run check      # typecheck
```

## Build and QA

```bash
npm run build      # dist/games/catastrophe/{he,en}/
npm run serve      # S3-like local server on http://localhost:3000
```

Open `http://localhost:3000/games/catastrophe/he/index.html?bridge=1` to simulate the app: the
server injects a stand-in bridge that logs every message in the browser console and answers
`game_ready`. Console helpers: `qa.pause()`, `qa.resume()`, `qa.abort()`, `qa.messages`.
Overrides: `&levels=catastrophe-0010,catastrophe-0011`, `&tutorial=0`, `&locale=en-US`,
`&reducedMotion=1`. Without `?bridge=1` the page runs standalone.

The build also scans source and output for blinding vocabulary (BR-10) and for this game's retired
name (BR-16), and fails on a hit.

## Deploy

Upload each language folder to `games/catastrophe/<lang>/` with these cache headers:

| Files | `Cache-Control` |
|---|---|
| `index.html`, `translations.json`, `words.json` | `no-cache` |
| `assets/*` | `public, max-age=31536000, immutable` |

Copy and words can be corrected by replacing `translations.json` or `words.json` on S3 without a
rebuild, as long as the word lists stay index-aligned with the catalogue.
