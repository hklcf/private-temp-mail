// D1 data access for mailboxes, messages, sessions and rate limits.

import { generateLocalPart } from "./lib/random.js";
import { addressHash } from "./lib/crypto.js";
import { isExpired } from "./lib/time.js";

const db = (env) => env.DB;

// ---------- mailboxes ----------

export async function getMailboxByAddress(env, address) {
  return db(env)
    .prepare("SELECT * FROM mailboxes WHERE address = ?")
    .bind(String(address).toLowerCase())
    .first();
}

export async function getMailboxById(env, id) {
  return db(env).prepare("SELECT * FROM mailboxes WHERE id = ?").bind(id).first();
}

export async function getLiveMailboxByAddress(env, address, now) {
  const mb = await getMailboxByAddress(env, address);
  if (!mb || isExpired(mb.expires_at, now)) return null;
  return mb;
}

/**
 * Create a mailbox with a freshly generated address that has NEVER been
 * used before: the candidate address hash is checked against the tombstone
 * table, and a tombstone is written in the same batch as the mailbox.
 */
export async function createMailbox(env, { domain, codeHash, createdAt, expiresAt }) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const localPart = generateLocalPart();
    const address = `${localPart}@${domain}`;
    const addrHash = await addressHash(address);
    const used = await db(env)
      .prepare("SELECT 1 AS x FROM tombstones WHERE address_hash = ?")
      .bind(addrHash)
      .first();
    if (used) continue;

    const id = crypto.randomUUID();
    try {
      await db(env).batch([
        db(env)
          .prepare(
            "INSERT INTO mailboxes (id, address, local_part, domain, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(id, address, localPart, domain, codeHash, createdAt, expiresAt),
        db(env)
          .prepare("INSERT INTO tombstones (address_hash, created_at) VALUES (?, ?)")
          .bind(addrHash, createdAt),
      ]);
      return { id, address, localPart, domain, createdAt, expiresAt };
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err; // collision → retry with a new address
    }
  }
  throw new Error("Could not allocate a unique address, please try again");
}

/** Delete a mailbox and everything it owns (R2 objects first, then rows). */
export async function deleteMailboxFully(env, mailboxId) {
  const keys = [];
  const { results: rawKeys } = await db(env)
    .prepare("SELECT raw_r2_key AS k FROM messages WHERE mailbox_id = ? AND raw_r2_key IS NOT NULL")
    .bind(mailboxId)
    .all();
  const { results: attKeys } = await db(env)
    .prepare(
      "SELECT a.r2_key AS k FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.mailbox_id = ?"
    )
    .bind(mailboxId)
    .all();
  for (const r of [...rawKeys, ...attKeys]) if (r.k) keys.push(r.k);
  if (env.MAIL_BUCKET && keys.length) {
    // R2 delete accepts up to 1000 keys per call.
    for (let i = 0; i < keys.length; i += 1000) await env.MAIL_BUCKET.delete(keys.slice(i, i + 1000));
  }
  await db(env).batch([
    db(env).prepare(
      "DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE mailbox_id = ?)"
    ).bind(mailboxId),
    db(env).prepare("DELETE FROM messages WHERE mailbox_id = ?").bind(mailboxId),
    db(env).prepare("DELETE FROM sessions WHERE mailbox_id = ?").bind(mailboxId),
    db(env).prepare("DELETE FROM mailboxes WHERE id = ?").bind(mailboxId),
  ]);
}

export async function deleteMessageFully(env, mailboxId, messageId) {
  const msg = await db(env)
    .prepare("SELECT * FROM messages WHERE id = ? AND mailbox_id = ?")
    .bind(messageId, mailboxId)
    .first();
  if (!msg) return false;
  const { results: atts } = await db(env)
    .prepare("SELECT r2_key FROM attachments WHERE message_id = ?")
    .bind(messageId)
    .all();
  if (env.MAIL_BUCKET) {
    const keys = [msg.raw_r2_key, ...atts.map((a) => a.r2_key)].filter(Boolean);
    if (keys.length) await env.MAIL_BUCKET.delete(keys);
  }
  await db(env).batch([
    db(env).prepare("DELETE FROM attachments WHERE message_id = ?").bind(messageId),
    db(env).prepare("DELETE FROM messages WHERE id = ?").bind(messageId),
  ]);
  return true;
}

/** Cron cleanup: permanently removes expired mailboxes (tombstones stay). */
export async function cleanupExpired(env, now, batchSize = 100) {
  const { results } = await db(env)
    .prepare("SELECT id FROM mailboxes WHERE expires_at <= ? LIMIT ?")
    .bind(now, batchSize)
    .all();
  for (const row of results) await deleteMailboxFully(env, row.id);
  return results.length;
}

// ---------- sessions ----------

export async function createSessionRow(env, { tokenHash, mailboxId, createdAt, expiresAt }) {
  await db(env)
    .prepare("INSERT INTO sessions (token_hash, mailbox_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, mailboxId, createdAt, expiresAt)
    .run();
}

export async function getSessionMailbox(env, tokenHash, now) {
  const row = await db(env)
    .prepare(
      `SELECT m.* FROM sessions s JOIN mailboxes m ON m.id = s.mailbox_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND m.expires_at > ?`
    )
    .bind(tokenHash, now, now)
    .first();
  return row ?? null;
}

export async function deleteSession(env, tokenHash) {
  await db(env).prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function deleteOtherSessions(env, mailboxId, keepTokenHash) {
  await db(env)
    .prepare("DELETE FROM sessions WHERE mailbox_id = ? AND token_hash != ?")
    .bind(mailboxId, keepTokenHash)
    .run();
}

// ---------- rate limits (fixed window) ----------

async function readLimit(env, key, now, windowMs) {
  const row = await db(env).prepare("SELECT * FROM rate_limits WHERE key = ?").bind(key).first();
  if (!row || now - row.window_start >= windowMs) return { count: 0, windowStart: now };
  return { count: row.count, windowStart: row.window_start };
}

/** True when the key is already at/over its limit in the current window. */
export async function rateLimitExceeded(env, key, limit, windowMs, now) {
  const { count } = await readLimit(env, key, now, windowMs);
  return count >= limit;
}

export async function rateLimitHit(env, key, windowMs, now) {
  const { count, windowStart } = await readLimit(env, key, now, windowMs);
  await db(env)
    .prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start"
    )
    .bind(key, count + 1, windowStart)
    .run();
}

export async function rateLimitReset(env, key) {
  await db(env).prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
}
