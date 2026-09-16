import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get(["/api/health", "/health"], (_req, res) => {
    res.json({ ok: true, service: "student-admission-auth" });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.use(
    ["/api/trpc", "/trpc"],
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Vercel] API request failed:", error);
    if (res.headersSent) return;
    res.status(500).json({ error: "The API request failed." });
  });

  return app;
}
