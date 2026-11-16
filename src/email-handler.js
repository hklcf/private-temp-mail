// Inbound mail: invoked by Cloudflare Email Routing's catch-all rule
// for every message sent to a configured apex domain.
//
// Only mailboxes that were created through the web UI (and have not
// expired) receive mail. Anything else is rejected at SMTP time —
// a random address that nobody created is not a mailbox.

import PostalMime from "postal-mime";
import { getLiveMailboxByAddress } from "./db.js";
import { extractOtpCodes, htmlToText } from "./lib/otp.js";

function attachmentBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(String(content ?? ""));
}

function safeFilename(name) {
  return String(name ?? "attachment").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "attachment";
}

export async function handleEmail(message, env) {
  const now = Date.now();
  const mailbox = await getLiveMailboxByAddress(env, message.to, now);
  if (!mailbox) {
    message.setReject("Mailbox not found or expired");
    return;
  }

  const rawBuffer = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(rawBuffer);

  const messageId = crypto.randomUUID();
  let rawKey = null;
  if (env.MAIL_BUCKET) {
    rawKey = `raw/${mailbox.id}/${messageId}.eml`;
    await env.MAIL_BUCKET.put(rawKey, rawBuffer, {
      httpMetadata: { contentType: "message/rfc822" },
    });
  }

  const attachments = parsed.attachments ?? [];
  // OTP detection and the inbox preview both read the text body, but some
  // senders (Meta included) send HTML-only mail: parsed.text is empty and
  // the code only exists in the HTML part. Fall back to the HTML part's
  // visible text when there is no text part, so those codes are still
  // detected and the message still gets a preview. When a text part
  // exists it is used unchanged.
  const textBody = (parsed.text ?? "").trim()
    ? parsed.text
    : htmlToText(parsed.html ?? "");
  const otpCodes = extractOtpCodes([parsed.subject ?? "", textBody].join("\n"));

  await env.DB.prepare(
    `INSERT INTO messages (id, mailbox_id, from_addr, to_addr, subject, text_body, html_body, raw_r2_key, size_bytes, otp_codes, has_attachments, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      messageId,
      mailbox.id,
      parsed.from?.address ?? message.from ?? "",
      message.to,
      parsed.subject ?? "",
      textBody,
      parsed.html ?? "",
      rawKey,
      rawBuffer.byteLength,
      JSON.stringify(otpCodes),
      attachments.length ? 1 : 0,
      now
    )
    .run();

  for (const att of attachments) {
    const attId = crypto.randomUUID();
    const bytes = attachmentBytes(att.content);
    const key = `att/${messageId}/${attId}`;
    if (env.MAIL_BUCKET) {
      await env.MAIL_BUCKET.put(key, bytes, {
        httpMetadata: { contentType: att.mimeType || "application/octet-stream" },
      });
    }
    await env.DB.prepare(
      "INSERT INTO attachments (id, message_id, filename, content_type, size_bytes, r2_key) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(attId, messageId, safeFilename(att.filename), att.mimeType || "application/octet-stream", bytes.byteLength, key)
      .run();
  }
}
