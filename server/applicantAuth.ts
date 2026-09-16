import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";

export const APPLICANT_SESSION_COOKIE = "applicant_session";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type SessionClaims = {
  applicantId: number;
  email: string;
};

function getJwtSecret() {
  const secret = ENV.cookieSecret || ENV.supabaseServerKey;
  if (!secret) throw new Error("Session signing secret is missing");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedKey] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedKey) return false;

  const storedKey = Buffer.from(encodedKey, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;
  return (
    storedKey.length === derivedKey.length &&
    timingSafeEqual(createHash("sha256").update(storedKey).digest(), createHash("sha256").update(derivedKey).digest())
  );
}

export async function createApplicantSession(claims: SessionClaims) {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(claims.applicantId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function readApplicantSession(req: Request) {
  const token = req.headers.cookie
    ?.split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${APPLICANT_SESSION_COOKIE}=`))
    ?.slice(APPLICANT_SESSION_COOKIE.length + 1);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const applicantId = Number(payload.sub);
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!Number.isInteger(applicantId) || applicantId <= 0 || !email) return null;
    return { applicantId, email } satisfies SessionClaims;
  } catch {
    return null;
  }
}

export function setApplicantSession(res: Response, req: Request, token: string) {
  res.cookie(APPLICANT_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_DURATION_SECONDS * 1000,
  });
}

export function clearApplicantSession(res: Response, req: Request) {
  res.clearCookie(APPLICANT_SESSION_COOKIE, getSessionCookieOptions(req));
}
