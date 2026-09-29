# Catastrophe

A word-guessing game in Hebrew and US English. Guess letters before the cat knocks the vase off the shelf.

## Run locally

```bash
npm install
npm run dev
```

The default preview uses Hebrew. To preview English, run `GAME_LANG=en npm run dev`.

## Build

```bash
npm run check
npm run build:games
```

The static games are written to `dist/games/Catastrophe/he/` and `dist/games/Catastrophe/en/`. Each language has its own `translations.json` and `words.json`; serve the files in each folder together. The game also runs in standalone mode without a host bridge.

This repository contains the runnable game source and its required assets. Generated builds, original uploads, review spreadsheets, and workspace backups are not included.