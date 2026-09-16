import type { Request, Response } from "express";
import { createApp } from "../../server/_core/app";

let app: ReturnType<typeof createApp> | undefined;

export default async function handler(req: Request, res: Response) {
  try {
    app ??= createApp();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };
      res.once("finish", () => finish());
      res.once("close", () => finish());
      try {
        app!(req, res);
      } catch (error) {
        finish(error);
      }
    });
  } catch (error) {
    console.error("[Vercel] tRPC function failed:", error);
    if (!res.headersSent) {
      res.status(500).setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : "API request failed.",
      }));
    }
  }
}
