import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./server/_core/app";

const app = createApp();
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public");

// Vercel serves files in public/ from its CDN. This fallback handles direct
// navigation to client-side routes such as /login and /dashboard.
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
