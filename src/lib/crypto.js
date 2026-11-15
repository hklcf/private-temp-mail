// Hashing helpers. Access codes and session tokens are high-entropy random
// values, so a single SHA-256 pass is the right storage hash (unlike human
// passwords, they carry enough entropy that brute force is not feasible).

import { normalizeAccessCode } from "./random.js";

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash of a normalised access code — this is all the database ever stores. */
export function accessCodeHash(code) {
  return sha256Hex("code:" + normalizeAccessCode(code));
}

/** Hash of a full email address — used for the tombstone (never-reissue) list. */
export function addressHash(address) {
  return sha256Hex("addr:" + String(address).toLowerCase());
}

/** Hash of a session token for the sessions table. */
export function sessionTokenHash(token) {
  return sha256Hex("sess:" + String(token));
}

/** Constant-time comparison of two equal-length hex strings. */
export function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
