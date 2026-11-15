// Session handling: an opaque random token in an HttpOnly cookie;
// only the token's hash ever touches the database.

import { generateSessionToken } from "./lib/random.js";
import { sessionTokenHash } from "./lib/crypto.js";
import { createSessionRow, getSessionMailbox, deleteSession } from "./db.js";

export const SESSION_COOKIE = "ptm_session";
const SESSION_TTL_MS = 30 * 86_400_000; // 30 days, but never past mailbox expiry

export async function startSession(env, mailbox, request) {
  const now = Date.now();
  const token = generateSessionToken();
  const tokenHash = await sessionTokenHash(token);
  const expiresAt = Math.min(now + SESSION_TTL_MS, mailbox.expires_at);
  await createSessionRow(env, { tokenHash, mailboxId: mailbox.id, createdAt: now, expiresAt });
  return { token, tokenHash, cookie: sessionCookie(token, request, expiresAt - now) };
}

export function sessionCookie(token, request, maxAgeMs) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const maxAge = Math.max(0, Math.floor(maxAgeMs / 1000));
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearedCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function tokenFromRequest(request) {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

/** The logged-in mailbox for this request, or null. Checks both expiries. */
export async function currentMailbox(env, request) {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const tokenHash = await sessionTokenHash(token);
  return getSessionMailbox(env, tokenHash, Date.now());
}

export async function currentTokenHash(request) {
  const token = tokenFromRequest(request);
  return token ? sessionTokenHash(token) : null;
}

export async function endSession(env, request) {
  const tokenHash = await currentTokenHash(request);
  if (tokenHash) await deleteSession(env, tokenHash);
}
