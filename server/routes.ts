import type { Express } from "express";
import type { Server } from "http";

// The game is a static site (it runs from S3/CloudFront in production), so it needs no API routes.
// In development, Vite serves ./translations.json and ./words.json (see vite.config.ts).
export async function registerRoutes(
  httpServer: Server,
  _app: Express
): Promise<Server> {
  return httpServer;
}
