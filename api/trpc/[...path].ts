import type { Request, Response } from "express";
import { createApp } from "../../server/_core/app";

const app = createApp();

export default async function handler(req: Request, res: Response) {
  try {
    await Promise.resolve(app(req, res));
  } catch (error) {
    console.error("[Vercel] tRPC function failed:", error);
    if (!res.headersSent) {
      res.status(500).setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : "API request failed.",
      }));
    }
  }
}
