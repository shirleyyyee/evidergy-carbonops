import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChatGPTUser } from "@/app/chatgpt-auth";

/**
 * Local, credential-based sign-in for running and demonstrating the product
 * on a developer machine without the platform-owned "Sign in with ChatGPT"
 * identity (which only exists inside the dispatch-hosted environment -- see
 * app/chatgpt-auth.ts). This is NOT a production authentication system: it
 * exists so the product can be logged into and reviewed locally.
 *
 * Disabled by default. Must be explicitly enabled with
 * EVIDERGY_LOCAL_LOGIN=1, and refuses to run at all when NODE_ENV=production
 * unless EVIDERGY_ALLOW_LOCAL_LOGIN_IN_PRODUCTION=1 is also set -- so it can
 * never silently become a backdoor on the real hosted deployment.
 */

const COOKIE_NAME = "evidergy_local_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type LocalAccount = {
  username: string;
  password: string;
  displayName: string;
  email: string;
};

function defaultAccounts(): LocalAccount[] {
  const password = process.env.EVIDERGY_LOCAL_LOGIN_PASSWORD || "evidergy-demo";
  return [
    { username: "operator", password, displayName: "Site Operator (local demo)", email: "operator@evidergy.local" },
    { username: "reviewer", password, displayName: "Grant Reviewer (local demo)", email: "reviewer@evidergy.local" },
  ];
}

export function localLoginEnabled(): boolean {
  if (process.env.EVIDERGY_LOCAL_LOGIN !== "1") return false;
  if (process.env.NODE_ENV === "production" && process.env.EVIDERGY_ALLOW_LOCAL_LOGIN_IN_PRODUCTION !== "1") {
    return false;
  }
  return true;
}

function secret(): string {
  const configured = process.env.EVIDERGY_LOCAL_LOGIN_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("EVIDERGY_LOCAL_LOGIN_SECRET must be set to use local login outside development.");
  }
  return "evidergy-local-dev-secret-not-for-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function verifyLocalCredentials(username: string, password: string): LocalAccount | null {
  const account = defaultAccounts().find((candidate) => candidate.username === username.trim().toLowerCase());
  if (!account) return null;
  return safeEqual(account.password, password) ? account : null;
}

export async function createLocalSession(username: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${username}.${expiresAt}`;
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearLocalSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getLocalSessionUser(): Promise<ChatGPTUser | null> {
  if (!localLoginEnabled()) return null;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expiresAtRaw, signature] = parts;
  const payload = `${username}.${expiresAtRaw}`;
  if (!safeEqual(sign(payload), signature)) return null;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const account = defaultAccounts().find((candidate) => candidate.username === username);
  if (!account) return null;
  return { userId: `local:${account.username}`, displayName: account.displayName, email: account.email, fullName: account.displayName };
}

export function localAccountUsernames(): string[] {
  return defaultAccounts().map((account) => account.username);
}
