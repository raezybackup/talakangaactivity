import type { Request, Response } from "express";

export default function health(_req: Request, res: Response) {
  res.status(200).json({ ok: true, service: "student-admission-auth" });
}
