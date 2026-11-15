// Retention and expiry rules — the single source of truth for the spec:
//
//   * A mailbox is created with a retention chosen from RETENTION_DAYS
//     (default 7). Expiry is mailbox-level: expires_at = created_at + days.
//   * Extend adds days to the CURRENT expiry (never shortens what remains),
//     but the new expiry may not exceed now + MAX_AHEAD_DAYS (365).
//   * Logging in and receiving mail never extend a mailbox.

export const DAY_MS = 86_400_000;
export const RETENTION_DAYS = [7, 30, 90, 180, 365];
export const DEFAULT_RETENTION_DAYS = 7;
export const EXTEND_DAYS = [7, 30, 90, 180, 365];
export const MAX_AHEAD_DAYS = 365;

/** Validate a retention/extend value coming from the client. Null = invalid. */
export function validateDays(value, fallback = null) {
  const n = Number(value);
  return RETENTION_DAYS.includes(n) ? n : fallback;
}

export function computeExpiresAt(createdAtMs, days) {
  return createdAtMs + days * DAY_MS;
}

/**
 * New expiry after extending.
 * Returns { expiresAt, appliedDays, capped } — capped is true when the
 * 365-days-from-now ceiling truncated the requested extension.
 */
export function computeExtendedExpiry(currentExpiresAtMs, addDays, nowMs) {
  const cap = nowMs + MAX_AHEAD_DAYS * DAY_MS;
  const wanted = currentExpiresAtMs + addDays * DAY_MS;
  const expiresAt = Math.min(wanted, cap);
  return {
    expiresAt,
    appliedDays: Math.max(0, Math.round((expiresAt - currentExpiresAtMs) / DAY_MS)),
    capped: expiresAt < wanted,
    changed: expiresAt > currentExpiresAtMs,
  };
}

export function isExpired(expiresAtMs, nowMs) {
  return expiresAtMs <= nowMs;
}

/** Whole days remaining (0 when less than a day is left). */
export function daysRemaining(expiresAtMs, nowMs) {
  return Math.max(0, Math.floor((expiresAtMs - nowMs) / DAY_MS));
}
