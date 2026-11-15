// Random generation for mailbox addresses, access codes and session tokens.
// Uses WebCrypto (available in Workers and modern Node) — never Math.random().

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i look-alikes

function randomChars(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Local part of a mailbox address, e.g. "k7qx9mdp4rta". */
export function generateLocalPart(length = 12) {
  return randomChars(length);
}

/**
 * Access code: 20 random characters shown grouped in 5 blocks of 4,
 * e.g. "K7QX-9MDP-4RTA-8WZN-3FKE". This is the mailbox's only credential.
 */
export function generateAccessCode() {
  const raw = randomChars(20).toUpperCase();
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

/** Normalise a user-typed access code for comparison: case and separators ignored. */
export function normalizeAccessCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Ungrouped canonical form of a freshly generated code (what gets hashed). */
export function canonicalAccessCode(code) {
  return normalizeAccessCode(code);
}

/** Opaque session token (256-bit, base64url). Only its hash is stored. */
export function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
