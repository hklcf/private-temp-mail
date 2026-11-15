// HTTP API for the web UI. Every mailbox-scoped route requires a session;
// there is no way to read a mailbox with just its address.

import {
  getLiveMailboxByAddress, createMailbox, deleteMailboxFully, deleteMessageFully,
  deleteOtherSessions, rateLimitExceeded, rateLimitHit, rateLimitReset,
} from "./db.js";
import { generateAccessCode } from "./lib/random.js";
import { accessCodeHash, timingSafeEqualHex } from "./lib/crypto.js";
import {
  validateDays, computeExpiresAt, computeExtendedExpiry, daysRemaining,
  DEFAULT_RETENTION_DAYS, EXTEND_DAYS,
} from "./lib/time.js";
import { sanitizeEmailHtml, emailHtmlDocument } from "./lib/sanitize.js";
import { startSession, currentMailbox, currentTokenHash, endSession, clearedCookie } from "./auth.js";

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_PER_ADDRESS = 5;
const LOGIN_MAX_PER_IP = 50;
const CREATE_WINDOW_MS = 60 * 60_000;
const CREATE_MAX_PER_IP = 30;

export function configuredDomains(env) {
  return String(env.EMAIL_DOMAINS ?? "")
    .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}
const err = (status, message) => json({ error: message }, status);

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

function mailboxView(mb, now) {
  return {
    address: mb.address,
    domain: mb.domain,
    createdAt: mb.created_at,
    expiresAt: mb.expires_at,
    daysRemaining: daysRemaining(mb.expires_at, now),
    extendedCount: mb.extended_count,
  };
}

// ---------- public routes ----------

async function createMailboxRoute(request, env) {
  const now = Date.now();
  const ip = clientIp(request);
  if (await rateLimitExceeded(env, `create:${ip}`, CREATE_MAX_PER_IP, CREATE_WINDOW_MS, now)) {
    return err(429, "建立郵箱太頻密，請稍後再試");
  }
  const body = await readJson(request);
  if (!body) return err(400, "請求格式錯誤");
  const domains = configuredDomains(env);
  const domain = String(body.domain ?? "").toLowerCase();
  if (!domains.includes(domain)) return err(400, "未有呢個域名");
  const days = validateDays(body.retentionDays, DEFAULT_RETENTION_DAYS);
  if (days === null) return err(400, "保存日數唔正確");

  await rateLimitHit(env, `create:${ip}`, CREATE_WINDOW_MS, now);
  const accessCode = generateAccessCode();
  const codeHash = await accessCodeHash(accessCode);
  const mb = await createMailbox(env, {
    domain, codeHash, createdAt: now, expiresAt: computeExpiresAt(now, days),
  });
  const session = await startSession(env, { id: mb.id, expires_at: mb.expiresAt }, request);
  return json(
    { address: mb.address, accessCode, expiresAt: mb.expiresAt, retentionDays: days },
    201,
    { "Set-Cookie": session.cookie }
  );
}

async function loginRoute(request, env) {
  const now = Date.now();
  const ip = clientIp(request);
  const body = await readJson(request);
  if (!body?.address || !body?.accessCode) return err(400, "請輸入電郵地址同存取碼");
  const address = String(body.address).trim().toLowerCase();
  const addrKey = `login-addr:${address}`;
  const ipKey = `login-ip:${ip}`;

  if (
    (await rateLimitExceeded(env, addrKey, LOGIN_MAX_PER_ADDRESS, LOGIN_WINDOW_MS, now)) ||
    (await rateLimitExceeded(env, ipKey, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS, now))
  ) {
    return err(429, "登入失敗次數太多，請 15 分鐘後再試");
  }

  const mb = await getLiveMailboxByAddress(env, address, now);
  const givenHash = await accessCodeHash(String(body.accessCode));
  if (!mb || !timingSafeEqualHex(givenHash, mb.code_hash)) {
    await rateLimitHit(env, addrKey, LOGIN_WINDOW_MS, now);
    await rateLimitHit(env, ipKey, LOGIN_WINDOW_MS, now);
    return err(401, "地址或者存取碼唔正確"); // generic on purpose
  }

  await rateLimitReset(env, addrKey);
  const session = await startSession(env, mb, request);
  return json(mailboxView(mb, now), 200, { "Set-Cookie": session.cookie });
}

// ---------- authenticated routes ----------

async function messageList(env, mb) {
  const { results } = await env.DB.prepare(
    `SELECT id, from_addr, subject, received_at, otp_codes, has_attachments, size_bytes,
            substr(text_body, 1, 140) AS snippet
     FROM messages WHERE mailbox_id = ? ORDER BY received_at DESC LIMIT 200`
  ).bind(mb.id).all();
  return results.map((r) => ({
    id: r.id, from: r.from_addr, subject: r.subject, receivedAt: r.received_at,
    otpCodes: JSON.parse(r.otp_codes || "[]"), hasAttachments: !!r.has_attachments,
    sizeBytes: r.size_bytes, snippet: r.snippet,
  }));
}

async function messageDetail(env, mb, id, url) {
  const msg = await env.DB.prepare("SELECT * FROM messages WHERE id = ? AND mailbox_id = ?")
    .bind(id, mb.id).first();
  if (!msg) return err(404, "搵唔到呢封信");
  const { results: atts } = await env.DB.prepare(
    "SELECT id, filename, content_type, size_bytes FROM attachments WHERE message_id = ?"
  ).bind(id).all();
  const allowImages = url.searchParams.get("images") === "1";
  return json({
    id: msg.id, from: msg.from_addr, to: msg.to_addr, subject: msg.subject,
    receivedAt: msg.received_at, textBody: msg.text_body,
    htmlDocument: msg.html_body
      ? emailHtmlDocument(sanitizeEmailHtml(msg.html_body, { allowRemoteImages: allowImages }), { allowRemoteImages: allowImages })
      : "",
    otpCodes: JSON.parse(msg.otp_codes || "[]"),
    attachments: atts.map((a) => ({
      id: a.id, filename: a.filename, contentType: a.content_type, sizeBytes: a.size_bytes,
      url: `/api/attachments/${a.id}`,
    })),
    rawUrl: msg.raw_r2_key ? `/api/messages/${msg.id}/raw` : null,
  });
}

async function download(env, key, filename, contentType) {
  if (!env.MAIL_BUCKET || !key) return err(404, "檔案唔存在");
  const obj = await env.MAIL_BUCKET.get(key);
  if (!obj) return err(404, "檔案唔存在");
  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;
  const now = Date.now();

  if (path === "/api/domains" && method === "GET") {
    return json({ domains: configuredDomains(env) });
  }
  if (path === "/api/mailboxes" && method === "POST") return createMailboxRoute(request, env);
  if (path === "/api/login" && method === "POST") return loginRoute(request, env);
  if (path === "/api/logout" && method === "POST") {
    await endSession(env, request);
    return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(request) });
  }

  // Everything below requires a live session for a live mailbox.
  const mb = await currentMailbox(env, request);
  if (!mb) return err(401, "未登入或者登入已過期");

  if (path === "/api/me" && method === "GET") return json(mailboxView(mb, now));

  if (path === "/api/messages" && method === "GET") return json({ messages: await messageList(env, mb) });

  const detailMatch = path.match(/^\/api\/messages\/([\w-]+)$/);
  if (detailMatch && method === "GET") return messageDetail(env, mb, detailMatch[1], url);
  if (detailMatch && method === "DELETE") {
    const ok = await deleteMessageFully(env, mb.id, detailMatch[1]);
    return ok ? json({ ok: true }) : err(404, "搵唔到呢封信");
  }

  const rawMatch = path.match(/^\/api\/messages\/([\w-]+)\/raw$/);
  if (rawMatch && method === "GET") {
    const msg = await env.DB.prepare("SELECT raw_r2_key FROM messages WHERE id = ? AND mailbox_id = ?")
      .bind(rawMatch[1], mb.id).first();
    if (!msg) return err(404, "搵唔到呢封信");
    return download(env, msg.raw_r2_key, `${rawMatch[1]}.eml`, "message/rfc822");
  }

  const attMatch = path.match(/^\/api\/attachments\/([\w-]+)$/);
  if (attMatch && method === "GET") {
    const att = await env.DB.prepare(
      `SELECT a.* FROM attachments a JOIN messages m ON m.id = a.message_id
       WHERE a.id = ? AND m.mailbox_id = ?`
    ).bind(attMatch[1], mb.id).first();
    if (!att) return err(404, "搵唔到呢個附件");
    return download(env, att.r2_key, att.filename, att.content_type);
  }

  if (path === "/api/mailbox/extend" && method === "POST") {
    const body = await readJson(request);
    const days = validateDays(body?.days, null);
    if (days === null || !EXTEND_DAYS.includes(days)) return err(400, "延長日數唔正確");
    const result = computeExtendedExpiry(mb.expires_at, days, now);
    if (!result.changed) return err(409, "已經去到最遠到期日（今日起計 365 日），冇得再延長");
    await env.DB.prepare(
      "UPDATE mailboxes SET expires_at = ?, extended_count = extended_count + 1, last_extended_at = ? WHERE id = ?"
    ).bind(result.expiresAt, now, mb.id).run();
    return json({
      previousExpiresAt: mb.expires_at, expiresAt: result.expiresAt,
      appliedDays: result.appliedDays, capped: result.capped,
    });
  }

  if (path === "/api/mailbox/rotate-code" && method === "POST") {
    const accessCode = generateAccessCode();
    const codeHash = await accessCodeHash(accessCode);
    await env.DB.prepare("UPDATE mailboxes SET code_hash = ? WHERE id = ?").bind(codeHash, mb.id).run();
    const keep = await currentTokenHash(request);
    if (keep) await deleteOtherSessions(env, mb.id, keep); // this device stays logged in
    return json({ accessCode });
  }

  if (path === "/api/mailbox" && method === "DELETE") {
    await deleteMailboxFully(env, mb.id);
    return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(request) });
  }

  return err(404, "唔存在呢個 API");
}
