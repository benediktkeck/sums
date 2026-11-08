/**
 * Optional password protection (SUMS_PASSWORD).
 *
 * The session cookie is an HMAC of the password, keyed with a server secret:
 * no session store, changing the password signs everyone out, and a leaked
 * cookie can't be used to guess the password offline. The secret is
 * SUMS_SESSION_SECRET, or (server mode) a random value created once in a file
 * next to the database. Local-mode installs without either fall back to a key
 * derived from the password alone.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "@sums/core/env";
import { storageMode } from "./config";
import { dbPath } from "./db/path";

export const AUTH_COOKIE = "sums_session";
/** Cookie lifetime: half a year. */
export const AUTH_MAX_AGE = 60 * 60 * 24 * 182;

export function authPassword(): string | null {
  return env("PASSWORD") || null;
}

const SECRET_FILE = "session-secret";
let cachedSecret: string | null | undefined;

/** Reads or creates the secret file (mode 0600) beside the database. */
function fileSecret(): string | null {
  const file = path.join(path.dirname(dbPath()), SECRET_FILE);
  try {
    return fs.readFileSync(file, "utf8").trim() || null;
  } catch {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const secret = randomBytes(32).toString("base64url");
      // "wx": if another process created it meanwhile, use theirs.
      fs.writeFileSync(file, secret, { mode: 0o600, flag: "wx" });
      return secret;
    } catch {
      try {
        return fs.readFileSync(file, "utf8").trim() || null;
      } catch {
        return null;
      }
    }
  }
}

export function sessionSecret(): string | null {
  if (cachedSecret !== undefined) return cachedSecret;
  cachedSecret = env("SESSION_SECRET")?.trim() || (storageMode() === "server" ? fileSecret() : null);
  return cachedSecret;
}

function toBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

export async function sessionToken(password: string, secret: string | null = sessionSecret()): Promise<string> {
  return secret ? hmac(secret, `sums-session-v2\u0000${password}`) : hmac(password, "sums-session-v1");
}

/** Compares without leaking where the strings differ. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function isValidSession(cookie: string | undefined, password: string): Promise<boolean> {
  return !!cookie && safeEqual(cookie, await sessionToken(password));
}

/** Only same-site paths, so the login form can't be used to redirect elsewhere. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
