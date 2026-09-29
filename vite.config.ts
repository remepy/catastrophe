import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/** Language build to produce or serve. `npm run build:games` sets this per language. */
const gameLang = process.env.GAME_LANG ?? "he";

/** Per-language files that sit next to index.html and can be replaced on S3 without a rebuild. */
const LOCALE_FILES = ["translations.json", "words.json"];

function gameLocale(lang: string): Plugin {
  const dir = path.resolve(import.meta.dirname, "client", "locales", lang);
  if (!fs.existsSync(dir)) throw new Error(`No locale folder for "${lang}" at ${dir}`);

  return {
    name: "game-locale",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? "").split("?")[0].replace(/^\//, "");
        if (!LOCALE_FILES.includes(name)) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(fs.readFileSync(path.join(dir, name)));
      });
    },
    generateBundle() {
      for (const fileName of LOCALE_FILES) {
        const source = fs.readFileSync(path.join(dir, fileName), "utf-8");
        JSON.parse(source); // fail the build on invalid JSON
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}

export default defineConfig({
  // Relative base: every asset and ./translations.json resolve relative to the page (bridge spec §4.1).
  base: "./",
  plugins: [
    react(),
    gameLocale(gameLang),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
